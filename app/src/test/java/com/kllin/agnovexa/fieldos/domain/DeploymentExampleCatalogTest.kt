package com.kllin.agnovexa.fieldos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeploymentExampleCatalogTest {
    private val example = DeploymentExampleCatalog.create(now = 1_800_000_000_000L)

    @Test
    fun `示例覆盖完整工作闭环且关联一致`() {
        assertEquals(7, DeploymentExampleCatalog.stages.size)
        assertEquals(7, example.tasks.size)
        assertTrue(example.servers.isNotEmpty())
        assertTrue(example.issues.isNotEmpty())
        assertTrue(example.commands.isNotEmpty())
        assertTrue(example.knowledge.isNotEmpty())
        assertEquals("COMPLETED", example.project.status)
        assertEquals("COMPLETED", example.report.status)
        assertTrue(example.tasks.all { it.projectId == example.project.id && it.status == "DONE" })
        assertTrue(example.issues.all { issue -> issue.projectId == example.project.id && example.servers.any { it.id == issue.serverId } })
        assertTrue(example.technologyIds.all(TechnologyCatalog::isValidId))
    }

    @Test
    fun `示例不包含真实地址组织名称或高风险清理命令`() {
        val text = buildString {
            append(example.project)
            example.servers.forEach(::append)
            example.commands.forEach(::append)
            example.knowledge.forEach(::append)
            example.issues.forEach(::append)
            append(example.report)
        }
        assertFalse(Regex("\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b").containsMatchIn(text))
        assertFalse(Regex("(?i)rm\\s+-rf|kill\\s+-9|iptables\\s+-F|--policy\\s+DROP").containsMatchIn(text))
        assertTrue(example.servers.all { it.host.startsWith("{{") && it.username == "{{ssh_user}}" })
    }

    @Test
    fun `所有现场相关命令都保留可识别占位符或只读采集`() {
        val commandsWithVariables = example.commands.filter { "{{" in it.command }
        assertTrue(commandsWithVariables.size >= 6)
        assertTrue(example.commands.none { "password=" in it.command.lowercase() || "api_key=" in it.command.lowercase() })
    }
}
