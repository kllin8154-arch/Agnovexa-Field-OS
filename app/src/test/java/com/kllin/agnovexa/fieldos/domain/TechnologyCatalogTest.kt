package com.kllin.agnovexa.fieldos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TechnologyCatalogTest {
    @Test
    fun `自定义国产系统名称可逆保存`() {
        val name = "银河麒麟 V10 SP3 64位 ARM/aarch64"
        val id = TechnologyCatalog.idForInput(name)

        assertTrue(TechnologyCatalog.isValidId(id))
        assertEquals(listOf(name), TechnologyCatalog.names(setOf(id)))
        assertEquals("system", TechnologyCatalog.visualKey(id))
    }

    @Test
    fun `内置名称不会重复创建自定义项`() {
        assertEquals("openjdk", TechnologyCatalog.idForInput("OpenJDK"))
        assertEquals("docker", TechnologyCatalog.idForInput("DOCKER"))
    }

    @Test
    fun `批量输入支持混合 Java 版本`() {
        val ids = TechnologyCatalog.idsForInput("Java 1.8，Java 17\nKylin-Server-V10-SP3-2403-Release-20240426-X86_64")
        val names = TechnologyCatalog.names(ids)

        assertEquals(3, ids.size)
        assertTrue("Java 1.8" in names)
        assertTrue("Java 17" in names)
        assertTrue(ids.all(TechnologyCatalog::isValidId))
    }

    @Test
    fun `伪造自定义 ID 会被拒绝`() {
        assertFalse(TechnologyCatalog.isValidId("custom:not-valid-base64%%%"))
    }

    @Test
    fun `自定义 Java 自动匹配 OpenJDK 图标`() {
        val id = TechnologyCatalog.idForInput("Java 17")

        assertEquals("openjdk", TechnologyCatalog.visualKey(id))
    }
}
