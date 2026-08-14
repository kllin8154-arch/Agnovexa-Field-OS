package com.kllin.agnovexa.fieldos.core.ai

import com.kllin.agnovexa.fieldos.domain.AiProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class OpenAiCompatibleClientTest {
    @Test
    fun `DeepSeek 默认 Thinking 时不发送温度`() {
        val policy = OpenAiCompatibleClient.requestParameterPolicy(provider())

        assertTrue(policy.thinkingEnabled == true)
        assertTrue(policy.sendThinkingToggle)
        assertFalse(policy.includeTemperature)
    }

    @Test
    fun `DeepSeek 关闭 Thinking 后发送温度`() {
        val policy = OpenAiCompatibleClient.requestParameterPolicy(provider(thinkingEnabled = false))

        assertFalse(policy.thinkingEnabled ?: true)
        assertTrue(policy.sendThinkingToggle)
        assertTrue(policy.includeTemperature)
    }

    @Test
    fun `自定义兼容服务保持发送温度且不注入 Thinking`() {
        val policy = OpenAiCompatibleClient.requestParameterPolicy(
            provider(baseUrl = "https://llm.example.com/v1", model = "local-model"),
        )

        assertFalse(policy.sendThinkingToggle)
        assertTrue(policy.includeTemperature)
    }

    @Test
    fun `流式 content 为 JSON null 时忽略而不是拼接字符串 null`() {
        val json = """{"choices":[{"delta":{"content":null,"reasoning_content":"分析中"}}]}"""

        assertTrue(OpenAiCompatibleClient.parseDeltaContent(json).isEmpty())
    }

    @Test
    fun `流式 content 为普通文本时正确返回`() {
        val json = """{"choices":[{"delta":{"content":"部署前先检查"}}]}"""

        assertEquals("部署前先检查", OpenAiCompatibleClient.parseDeltaContent(json))
    }

    @Test
    fun `缺少 choices 的事件安全忽略`() {
        assertTrue(OpenAiCompatibleClient.parseDeltaContent("{\"usage\":null}").isEmpty())
    }

    @Test
    fun `服务根地址自动补齐兼容端点`() {
        assertEquals(
            "https://example.com/v1/chat/completions",
            OpenAiCompatibleClient.resolveEndpoint("https://example.com"),
        )
    }

    @Test
    fun `v1 地址不会重复拼接`() {
        assertEquals(
            "https://example.com/api/v1/chat/completions",
            OpenAiCompatibleClient.resolveEndpoint("https://example.com/api/v1/"),
        )
    }

    @Test
    fun `完整端点保持不变`() {
        assertEquals(
            "https://example.com/v1/chat/completions",
            OpenAiCompatibleClient.resolveEndpoint("https://example.com/v1/chat/completions"),
        )
    }

    @Test
    fun `国内服务的 v4 地址直接拼接聊天端点`() {
        assertEquals(
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            OpenAiCompatibleClient.resolveEndpoint("https://open.bigmodel.cn/api/paas/v4"),
        )
    }

    @Test
    fun `拒绝非 http 协议`() {
        assertThrows(IllegalArgumentException::class.java) {
            OpenAiCompatibleClient.resolveEndpoint("ftp://example.com")
        }
    }

    private fun provider(
        baseUrl: String = "https://api.deepseek.com/v1",
        model: String = "deepseek-v4-pro",
        thinkingEnabled: Boolean? = null,
    ) = AiProvider(
        id = "test",
        name = "测试",
        baseUrl = baseUrl,
        model = model,
        createdAt = 0L,
        updatedAt = 0L,
        thinkingEnabled = thinkingEnabled,
    )
}
