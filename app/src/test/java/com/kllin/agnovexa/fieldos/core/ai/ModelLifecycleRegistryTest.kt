package com.kllin.agnovexa.fieldos.core.ai

import com.kllin.agnovexa.fieldos.domain.AiProvider
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelLifecycleRegistryTest {
    @Test
    fun `官方 OpenAI 已停用模型返回替代建议`() {
        val result = ModelLifecycleRegistry.inspect(provider("https://api.openai.com/v1", "gpt-5.3-chat-latest"))

        assertTrue(result?.isBlocked == true)
        assertEquals("2026-08-10", result?.shutdownDate)
        assertEquals("gpt-5.6-sol", result?.replacement)
    }

    @Test
    fun `官方 DeepSeek 旧别名已停用`() {
        val result = ModelLifecycleRegistry.inspect(provider("https://api.deepseek.com/v1", "deepseek-reasoner"))

        assertTrue(result?.isBlocked == true)
        assertEquals("deepseek-v4-flash", result?.replacement)
    }

    @Test
    fun `自定义服务的同名模型不误判为官方模型`() {
        val result = ModelLifecycleRegistry.inspect(provider("https://llm.example.com/v1", "gpt-5.3-chat-latest"))

        assertNull(result)
    }

    @Test
    fun `动态 chat latest 给出生产风险提示但不阻断`() {
        val result = ModelLifecycleRegistry.inspect(provider("https://api.openai.com/v1", "chat-latest"))

        assertEquals(ModelLifecycleState.DYNAMIC, result?.lifecycleState)
        assertFalse(result?.isBlocked ?: true)
        assertEquals("gpt-5.6-sol", result?.replacement)
    }

    @Test
    fun `当前 OpenAI 模型记录 Chat 与 Responses 能力`() {
        val result = ModelLifecycleRegistry.inspect(provider("https://api.openai.com/v1", "gpt-5.6-sol"))

        assertEquals(ModelLifecycleState.ACTIVE, result?.lifecycleState)
        assertEquals(CapabilitySupport.SUPPORTED, result?.chatCompletions)
        assertEquals(CapabilitySupport.SUPPORTED, result?.responses)
        assertEquals(StreamTermination.DATA_DONE, result?.streamTermination)
    }

    @Test
    fun `DeepSeek V4 Pro 只记录官方已证实能力`() {
        val result = ModelLifecycleRegistry.inspect(provider("https://api.deepseek.com/v1", "deepseek-v4-pro"))

        assertEquals("DeepSeek-V4-Pro", result?.observedSnapshot)
        assertEquals("deepseek-docs-2026-08-14", result?.capabilityVersion)
        assertEquals(CapabilitySupport.UNKNOWN, result?.responses)
        assertEquals(CapabilitySupport.SUPPORTED, result?.jsonOutput)
        assertEquals(CapabilitySupport.SUPPORTED, result?.anthropicMessages)
        assertEquals(CapabilitySupport.SUPPORTED, result?.thinking)
        assertTrue(result?.thinkingDefaultEnabled == true)
        assertEquals(CapabilitySupport.UNSUPPORTED, result?.temperatureWhenThinking)
        assertEquals(CapabilitySupport.SUPPORTED, result?.reasoningContent)
        assertEquals(StreamTermination.DATA_DONE, result?.streamTermination)
        assertEquals(StreamTermination.UNKNOWN, result?.responsesStreamTermination)
        assertTrue(result?.requiresReasoningContentForToolCalls == true)
        assertTrue(result?.unsupportedParameters?.isEmpty() == true)
        assertEquals("2026-08-14", result?.lastVerifiedAt)
    }

    @Test
    fun `DeepSeek Flash 与 Pro 记录官方模型版本`() {
        val flash = ModelLifecycleRegistry.inspect(provider("https://api.deepseek.com", "deepseek-v4-flash"))
        val pro = ModelLifecycleRegistry.inspect(provider("https://api.deepseek.com", "deepseek-v4-pro"))

        assertEquals("DeepSeek-V4-Flash", flash?.observedSnapshot)
        assertEquals("DeepSeek-V4-Pro", pro?.observedSnapshot)
    }

    @Test
    fun `百炼 qwen turbo 显示计划停用并保留迁移窗口`() {
        val result = ModelLifecycleRegistry.inspect(provider("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-turbo"))

        assertEquals(ModelLifecycleState.SCHEDULED_RETIREMENT, result?.lifecycleState)
        assertEquals("2026-10-10", result?.shutdownDate)
        assertEquals("qwen3.7-plus", result?.replacement)
        assertFalse(result?.isBlockedAt(LocalDate.of(2026, 8, 14)) ?: true)
        assertTrue(result?.isBlockedAt(LocalDate.of(2026, 10, 10)) == true)
    }

    @Test
    fun `百炼推荐模型保持可用`() {
        val result = ModelLifecycleRegistry.inspect(provider("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen3.7-plus"))

        assertEquals(ModelLifecycleState.ACTIVE, result?.lifecycleState)
        assertFalse(result?.isBlocked ?: true)
    }

    private fun provider(baseUrl: String, model: String) = AiProvider(
        id = "test",
        name = "测试",
        baseUrl = baseUrl,
        model = model,
        createdAt = 0L,
        updatedAt = 0L,
    )
}
