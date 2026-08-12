package com.kllin.agnovexa.fieldos.core.ai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class OpenAiCompatibleClientTest {
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
}
