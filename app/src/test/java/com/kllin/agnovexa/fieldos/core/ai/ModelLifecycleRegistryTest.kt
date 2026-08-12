package com.kllin.agnovexa.fieldos.core.ai

import com.kllin.agnovexa.fieldos.domain.AiProvider
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

    private fun provider(baseUrl: String, model: String) = AiProvider(
        id = "test",
        name = "测试",
        baseUrl = baseUrl,
        model = model,
        createdAt = 0L,
        updatedAt = 0L,
    )
}
