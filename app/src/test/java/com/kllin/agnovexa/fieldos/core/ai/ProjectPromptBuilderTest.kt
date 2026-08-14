package com.kllin.agnovexa.fieldos.core.ai

import com.kllin.agnovexa.fieldos.domain.FieldTask
import com.kllin.agnovexa.fieldos.domain.Issue
import com.kllin.agnovexa.fieldos.domain.Project
import com.kllin.agnovexa.fieldos.domain.Server
import com.kllin.agnovexa.fieldos.domain.TechnologyCatalog
import com.kllin.agnovexa.fieldos.domain.WorkspaceSnapshot
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProjectPromptBuilderTest {
    @Test
    fun `只聚合所选项目资料与技术栈`() {
        val now = 1L
        val selected = Project("p1", "国产化平台", "KYLIN", "离线部署", "ACTIVE", 60, "机房", now, now)
        val other = Project("p2", "无关项目", "OTHER", "不应进入上下文", "ACTIVE", 10, "异地", now, now)
        val workspace = WorkspaceSnapshot(
            projects = listOf(selected, other),
            tasks = listOf(
                FieldTask("t1", "p1", "部署 RabbitMQ", "处理启动报错", "TODO", "P1", now, now),
                FieldTask("t2", "p2", "秘密任务", "不应出现", "TODO", "P1", now, now),
            ),
            issues = listOf(Issue("i1", "p1", null, "服务异常", "无法启动", "待分析", "", "", "OPEN", "P1", now, now)),
            servers = listOf(Server("s1", "p1", "应用节点", "192.0.2.8", 22, "ops", "银河麒麟 V10 SP3 ARM64", "生产", "Java 17", now, now)),
            projectTechnologyIds = mapOf("p1" to setOf(TechnologyCatalog.idForInput("Java 17"), TechnologyCatalog.idForInput("银河麒麟 V10 SP3 ARM64"))),
        )

        val prompt = ProjectPromptBuilder.systemPrompt("p1", workspace)

        assertTrue(prompt.contains("国产化平台"))
        assertTrue(prompt.contains("Java 17"))
        assertTrue(prompt.contains("部署 RabbitMQ"))
        assertTrue(prompt.contains("服务异常"))
        assertFalse(prompt.contains("无关项目"))
        assertFalse(prompt.contains("秘密任务"))
        assertFalse(prompt.contains("192.0.2.8"))
        assertFalse(prompt.contains("ops"))
    }
}
