package com.kllin.agnovexa.fieldos.core.ai

import com.kllin.agnovexa.fieldos.core.security.SecretStore
import com.kllin.agnovexa.fieldos.domain.AiChatMessage
import com.kllin.agnovexa.fieldos.domain.AiProvider
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

@Singleton
class OpenAiCompatibleClient @Inject constructor(private val secrets: SecretStore) {
    suspend fun chat(
        provider: AiProvider,
        messages: List<AiChatMessage>,
        onDelta: (String) -> Unit = {},
    ): String = withContext(Dispatchers.IO) {
        ModelLifecycleRegistry.blockingReason(provider)?.let { throw AiApiException(it) }
        val apiKey = secrets.get(secretId(provider.id)) ?: throw AiApiException("该 Provider 尚未填写 API Key")
        val body = buildRequestBody(provider, messages)
        val client = OkHttpClient.Builder()
            .connectTimeout(provider.timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .readTimeout(provider.timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .writeTimeout(provider.timeoutSeconds.toLong(), TimeUnit.SECONDS)
            .build()
        val request = Request.Builder()
            .url(resolveEndpoint(provider.baseUrl))
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        try {
            client.newCall(request).execute().use { response ->
                val responseBody = response.body ?: throw AiApiException("服务返回了空响应")
                if (!response.isSuccessful) throw mapHttpError(response.code, responseBody.string())
                if (!provider.streamingEnabled) {
                    return@withContext parseMessage(responseBody.string()).also(onDelta)
                }
                val result = StringBuilder()
                responseBody.source().use { source ->
                    while (!source.exhausted()) {
                        val line = source.readUtf8Line() ?: break
                        if (!line.startsWith("data:")) continue
                        val data = line.removePrefix("data:").trim()
                        if (data == "[DONE]") break
                        val delta = parseDelta(data)
                        if (delta.isNotEmpty()) {
                            result.append(delta)
                            onDelta(delta)
                        }
                    }
                }
                result.toString().ifBlank { throw AiApiException("模型未返回文本内容") }
            }
        } catch (error: SocketTimeoutException) {
            throw AiApiException("请求超时，请检查网络或增大超时时间")
        } catch (error: IOException) {
            throw AiApiException("无法连接 AI 服务：${error.message ?: "网络不可用"}")
        }
    }

    private fun parseMessage(json: String): String = extractContent(json, "message")
        .ifBlank { throw AiApiException("模型未返回文本内容") }

    private fun parseDelta(json: String): String = parseDeltaContent(json)

    private fun mapHttpError(code: Int, body: String): AiApiException {
        val detail = runCatching { JSONObject(body).optJSONObject("error")?.optString("message") }.getOrNull()
            ?.take(180).orEmpty()
        val message = when (code) {
            401, 403 -> "鉴权失败，请检查 API Key"
            404 -> "接口或模型不存在，请检查 Base URL 与模型名"
            408 -> "服务请求超时"
            429 -> "请求过于频繁或额度不足"
            in 500..599 -> "AI 服务暂时不可用（$code）"
            else -> "AI 请求失败（$code）"
        }
        return AiApiException(if (detail.isBlank()) message else "$message：$detail")
    }

    companion object {
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
        fun secretId(providerId: String) = "ai_provider_$providerId"
        fun parseDeltaContent(json: String): String = extractContent(json, "delta")

        fun buildRequestBody(provider: AiProvider, messages: List<AiChatMessage>): JSONObject {
            val policy = requestParameterPolicy(provider)
            return JSONObject().apply {
                put("model", provider.model)
                if (policy.includeTemperature) put("temperature", provider.temperature)
                if (policy.sendThinkingToggle && policy.thinkingEnabled != null) {
                    put("thinking", JSONObject().put("type", if (policy.thinkingEnabled) "enabled" else "disabled"))
                }
                put("stream", provider.streamingEnabled)
                put("messages", JSONArray().apply {
                    messages.forEach { message ->
                        put(JSONObject().put("role", message.role).put("content", message.content))
                    }
                })
            }
        }

        fun requestParameterPolicy(provider: AiProvider): AiRequestParameterPolicy {
            val capability = ModelLifecycleRegistry.inspect(provider)
            val thinkingEnabled = provider.thinkingEnabled ?: capability?.thinkingDefaultEnabled
            val includeTemperature = capability?.temperature != CapabilitySupport.UNSUPPORTED &&
                !(thinkingEnabled == true && capability?.temperatureWhenThinking == CapabilitySupport.UNSUPPORTED)
            return AiRequestParameterPolicy(
                thinkingEnabled = thinkingEnabled,
                sendThinkingToggle = capability?.providerFamily == "DeepSeek" && thinkingEnabled != null,
                includeTemperature = includeTemperature,
            )
        }

        private fun extractContent(json: String, container: String): String = runCatching {
            Json.parseToJsonElement(json).jsonObject["choices"]?.jsonArray?.firstOrNull()?.jsonObject
                ?.get(container)?.jsonObject?.get("content")?.jsonPrimitive?.contentOrNull.orEmpty()
        }.getOrDefault("")

        fun resolveEndpoint(baseUrl: String): String {
            val normalized = baseUrl.trim().trimEnd('/')
            require(normalized.startsWith("https://") || normalized.startsWith("http://")) { "Base URL 必须以 http:// 或 https:// 开头" }
            return when {
                normalized.endsWith("/chat/completions") -> normalized
                Regex("/v\\d+$").containsMatchIn(normalized) -> "$normalized/chat/completions"
                else -> "$normalized/v1/chat/completions"
            }
        }
    }
}

data class AiRequestParameterPolicy(
    val thinkingEnabled: Boolean?,
    val sendThinkingToggle: Boolean,
    val includeTemperature: Boolean,
)

class AiApiException(message: String) : IllegalStateException(message)
