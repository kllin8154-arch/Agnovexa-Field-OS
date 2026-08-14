package com.kllin.agnovexa.fieldos.core.ai

import com.kllin.agnovexa.fieldos.domain.AiProvider
import java.net.URI
import java.time.LocalDate

enum class CapabilitySupport { SUPPORTED, UNSUPPORTED, UNKNOWN }

enum class ModelLifecycleState { ACTIVE, DYNAMIC, SCHEDULED_RETIREMENT, RETIRED }

enum class StreamTermination { DATA_DONE, TYPED_EVENT, UNKNOWN }

data class ModelCapabilitySnapshot(
    val providerFamily: String,
    val modelId: String,
    val observedSnapshot: String? = null,
    val capabilityVersion: String = ModelLifecycleRegistry.SNAPSHOT_DATE,
    val lifecycleState: ModelLifecycleState,
    val chatCompletions: CapabilitySupport,
    val responses: CapabilitySupport,
    val jsonOutput: CapabilitySupport = CapabilitySupport.UNKNOWN,
    val anthropicMessages: CapabilitySupport = CapabilitySupport.UNKNOWN,
    val toolCalls: CapabilitySupport,
    val thinking: CapabilitySupport,
    val thinkingDefaultEnabled: Boolean? = null,
    val temperature: CapabilitySupport = CapabilitySupport.UNKNOWN,
    val temperatureWhenThinking: CapabilitySupport = CapabilitySupport.UNKNOWN,
    val reasoningContent: CapabilitySupport = CapabilitySupport.UNKNOWN,
    val streamTermination: StreamTermination,
    val responsesStreamTermination: StreamTermination = StreamTermination.UNKNOWN,
    val unsupportedParameters: Set<String> = emptySet(),
    val requiresReasoningContentForToolCalls: Boolean = false,
    val contextWindowTokens: Int? = null,
    val maxOutputTokens: Int? = null,
    val shutdownDate: String? = null,
    val replacement: String? = null,
    val lastVerifiedAt: String = ModelLifecycleRegistry.SNAPSHOT_DATE,
) {
    val isBlocked: Boolean get() = isBlockedAt(LocalDate.now())

    fun isBlockedAt(date: LocalDate): Boolean = lifecycleState == ModelLifecycleState.RETIRED ||
        (lifecycleState == ModelLifecycleState.SCHEDULED_RETIREMENT && shutdownDate?.let(LocalDate::parse)?.let { !date.isBefore(it) } == true)

    val userMessage: String
        get() = when (lifecycleState) {
            ModelLifecycleState.ACTIVE -> observedSnapshot?.let { "实际快照 $it · 核验于 $lastVerifiedAt" }
                ?: "生命周期已核验 · $lastVerifiedAt"
            ModelLifecycleState.DYNAMIC -> "动态快照会持续变化，生产使用建议改为 ${replacement ?: "固定模型"}"
            ModelLifecycleState.SCHEDULED_RETIREMENT -> if (isBlocked) {
                "已于 $shutdownDate 停用，请改为 ${replacement ?: "可用模型"}"
            } else {
                "将于 $shutdownDate 停用，请提前改为 ${replacement ?: "可用模型"}"
            }
            ModelLifecycleState.RETIRED -> "已于 $shutdownDate 停用，请改为 ${replacement ?: "可用模型"}"
        }
}

object ModelLifecycleRegistry {
    const val SNAPSHOT_DATE = "2026-08-14"

    private const val OPENAI = "OpenAI"
    private const val DEEPSEEK = "DeepSeek"
    private const val QWEN = "Qwen"

    private val records = listOf(
        openAiActive("gpt-5.6-sol"),
        openAiActive("gpt-5.6-terra"),
        openAiActive("gpt-5.6-luna"),
        retired(OPENAI, "gpt-5-chat-latest", "2026-07-23", "gpt-5.6-sol"),
        retired(OPENAI, "gpt-5.1-chat-latest", "2026-07-23", "gpt-5.6-sol"),
        retired(OPENAI, "gpt-5.2-chat-latest", "2026-08-10", "gpt-5.6-sol"),
        retired(OPENAI, "gpt-5.3-chat-latest", "2026-08-10", "gpt-5.6-sol"),
        deepSeekActive("deepseek-v4-flash", "DeepSeek-V4-Flash"),
        deepSeekActive("deepseek-v4-pro", "DeepSeek-V4-Pro"),
        retired(DEEPSEEK, "deepseek-chat", "2026-07-24", "deepseek-v4-flash"),
        retired(DEEPSEEK, "deepseek-reasoner", "2026-07-24", "deepseek-v4-flash"),
        qwenActive("qwen3.7-plus"),
        qwenActive("qwen-plus"),
        scheduledRetirement(QWEN, "qwen-turbo", "2026-10-10", "qwen3.7-plus"),
    )

    fun inspect(provider: AiProvider): ModelCapabilitySnapshot? = inspect(provider.baseUrl, provider.model)

    fun inspect(baseUrl: String, modelId: String): ModelCapabilitySnapshot? {
        val family = providerFamily(baseUrl) ?: return null
        val normalizedModel = modelId.trim().lowercase()
        records.firstOrNull { it.providerFamily == family && it.modelId == normalizedModel }?.let { return it }
        if (family == OPENAI && (normalizedModel == "chat-latest" || normalizedModel.endsWith("-chat-latest"))) {
            return ModelCapabilitySnapshot(
                providerFamily = family,
                modelId = normalizedModel,
                lifecycleState = ModelLifecycleState.DYNAMIC,
                chatCompletions = CapabilitySupport.SUPPORTED,
                responses = CapabilitySupport.UNKNOWN,
                toolCalls = CapabilitySupport.UNKNOWN,
                thinking = CapabilitySupport.UNKNOWN,
                streamTermination = StreamTermination.DATA_DONE,
                replacement = "gpt-5.6-sol",
            )
        }
        return null
    }

    fun blockingReason(provider: AiProvider): String? = inspect(provider)?.takeIf(ModelCapabilitySnapshot::isBlocked)?.let { snapshot ->
        "${snapshot.providerFamily} 模型 ${snapshot.modelId} 已于 ${snapshot.shutdownDate} 停用，请改为 ${snapshot.replacement}"
    }

    private fun providerFamily(baseUrl: String): String? {
        val host = runCatching { URI(baseUrl.trim()).host?.lowercase() }.getOrNull()
        return when (host) {
            "api.openai.com" -> OPENAI
            "api.deepseek.com" -> DEEPSEEK
            "dashscope.aliyuncs.com" -> QWEN
            else -> null
        }
    }

    private fun openAiActive(modelId: String) = ModelCapabilitySnapshot(
        providerFamily = OPENAI,
        modelId = modelId,
        lifecycleState = ModelLifecycleState.ACTIVE,
        chatCompletions = CapabilitySupport.SUPPORTED,
        responses = CapabilitySupport.SUPPORTED,
        toolCalls = CapabilitySupport.SUPPORTED,
        thinking = CapabilitySupport.SUPPORTED,
        temperature = CapabilitySupport.SUPPORTED,
        streamTermination = StreamTermination.DATA_DONE,
    )

    private fun deepSeekActive(modelId: String, observedSnapshot: String) = ModelCapabilitySnapshot(
        providerFamily = DEEPSEEK,
        modelId = modelId,
        observedSnapshot = observedSnapshot,
        capabilityVersion = "deepseek-docs-2026-08-14",
        lifecycleState = ModelLifecycleState.ACTIVE,
        chatCompletions = CapabilitySupport.SUPPORTED,
        responses = CapabilitySupport.UNKNOWN,
        jsonOutput = CapabilitySupport.SUPPORTED,
        anthropicMessages = CapabilitySupport.SUPPORTED,
        toolCalls = CapabilitySupport.SUPPORTED,
        thinking = CapabilitySupport.SUPPORTED,
        thinkingDefaultEnabled = true,
        temperature = CapabilitySupport.SUPPORTED,
        temperatureWhenThinking = CapabilitySupport.UNSUPPORTED,
        reasoningContent = CapabilitySupport.SUPPORTED,
        streamTermination = StreamTermination.DATA_DONE,
        requiresReasoningContentForToolCalls = true,
        contextWindowTokens = 1_000_000,
        maxOutputTokens = 384_000,
        lastVerifiedAt = "2026-08-14",
    )

    private fun qwenActive(modelId: String) = ModelCapabilitySnapshot(
        providerFamily = QWEN,
        modelId = modelId,
        lifecycleState = ModelLifecycleState.ACTIVE,
        chatCompletions = CapabilitySupport.SUPPORTED,
        responses = CapabilitySupport.UNKNOWN,
        toolCalls = CapabilitySupport.UNKNOWN,
        thinking = CapabilitySupport.UNKNOWN,
        temperature = CapabilitySupport.UNKNOWN,
        streamTermination = StreamTermination.DATA_DONE,
    )

    private fun scheduledRetirement(providerFamily: String, modelId: String, shutdownDate: String, replacement: String) =
        ModelCapabilitySnapshot(
            providerFamily = providerFamily,
            modelId = modelId,
            lifecycleState = ModelLifecycleState.SCHEDULED_RETIREMENT,
            chatCompletions = CapabilitySupport.SUPPORTED,
            responses = CapabilitySupport.UNKNOWN,
            toolCalls = CapabilitySupport.UNKNOWN,
            thinking = CapabilitySupport.UNKNOWN,
            temperature = CapabilitySupport.UNKNOWN,
            streamTermination = StreamTermination.DATA_DONE,
            shutdownDate = shutdownDate,
            replacement = replacement,
        )

    private fun retired(providerFamily: String, modelId: String, shutdownDate: String, replacement: String) =
        ModelCapabilitySnapshot(
            providerFamily = providerFamily,
            modelId = modelId,
            lifecycleState = ModelLifecycleState.RETIRED,
            chatCompletions = CapabilitySupport.UNSUPPORTED,
            responses = CapabilitySupport.UNSUPPORTED,
            toolCalls = CapabilitySupport.UNSUPPORTED,
            thinking = CapabilitySupport.UNKNOWN,
            streamTermination = StreamTermination.UNKNOWN,
            shutdownDate = shutdownDate,
            replacement = replacement,
        )
}
