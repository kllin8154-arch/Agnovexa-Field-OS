package com.kllin.agnovexa.fieldos.core.ai

import com.kllin.agnovexa.fieldos.domain.TechnologyCatalog
import com.kllin.agnovexa.fieldos.domain.WorkspaceSnapshot

object ProjectPromptBuilder {
    fun systemPrompt(projectId: String, workspace: WorkspaceSnapshot): String {
        val project = workspace.projects.firstOrNull { it.id == projectId }
            ?: throw IllegalArgumentException("所选项目不存在，请重新选择")
        val technologies = TechnologyCatalog.names(workspace.projectTechnologyIds[projectId].orEmpty())
        val servers = workspace.servers.filter { it.projectId == projectId }
        val tasks = workspace.tasks.filter { it.projectId == projectId }
        val issues = workspace.issues.filter { it.projectId == projectId }
        val knowledge = workspace.knowledge.filter { it.projectId == projectId }.take(8)
        val activities = workspace.activities.filter { it.projectId == projectId }.take(10)
        val reports = workspace.reports.filter { it.projectId == projectId }.take(3)

        return buildString {
            appendLine("你是 Agnovexa Field OS 的项目运维助手。只能根据下方所选项目的本地资料和当前对话回答。")
            appendLine("资料缺失或互相矛盾时必须明确指出并先询问，不得把未知内容当成事实。")
            appendLine("不能直接执行命令；涉及变更或高风险操作时，必须提供前置检查、验证、回退和风险提示。")
            appendLine("不要索取或复述密码、Token、API Key、私钥等秘密。服务器账号和地址仅用于理解项目，不要在回答中主动完整复述。")
            appendLine()
            appendLine("【当前项目】")
            appendLine("名称：${project.name}")
            appendLine("编号：${project.code.ifBlank { "未填写" }}")
            appendLine("说明：${project.description.ifBlank { "未填写" }}")
            appendLine("地点：${project.location.ifBlank { "未填写" }}")
            appendLine("状态/进度：${project.status} / ${project.progress}%")
            appendLine("技术栈：${technologies.joinToString().ifBlank { "未配置" }}")
            appendLine()
            appendLine("【服务器（${servers.size}）】")
            appendCollection(servers.take(12).map { "${it.name}｜${it.osType}｜${it.environment}｜${it.notes}" })
            appendLine("【任务（${tasks.size}）】")
            appendCollection(tasks.take(12).map { "[${it.status}/${it.priority}] ${it.title}：${it.description}" })
            appendLine("【问题（${issues.size}）】")
            appendCollection(issues.take(12).map { "[${it.status}/${it.priority}] ${it.title}：现象=${it.symptom}；原因=${it.cause.ifBlank { "待确认" }}；处理=${it.solution.ifBlank { "待处理" }}" })
            appendLine("【知识（${knowledge.size}）】")
            appendCollection(knowledge.map { "${it.title}：${it.summary.ifBlank { it.content }.take(300)}" })
            appendLine("【最近活动（${activities.size}）】")
            appendCollection(activities.map { "${it.title}：${it.description}" })
            appendLine("【最近日报（${reports.size}）】")
            appendCollection(reports.map { "${it.dateKey} ${it.title}：${it.workContent.take(300)}" })
        }.take(MAX_CONTEXT_CHARS)
    }

    fun summary(projectId: String, workspace: WorkspaceSnapshot): String {
        val technologies = workspace.projectTechnologyIds[projectId].orEmpty().size
        val servers = workspace.servers.count { it.projectId == projectId }
        val tasks = workspace.tasks.count { it.projectId == projectId }
        val issues = workspace.issues.count { it.projectId == projectId }
        val knowledge = workspace.knowledge.count { it.projectId == projectId }
        return "$technologies 项技术 · $servers 台服务器 · $tasks 个任务 · $issues 个问题 · $knowledge 篇知识"
    }

    private fun StringBuilder.appendCollection(lines: List<String>) {
        if (lines.isEmpty()) appendLine("- 暂无记录") else lines.forEach { appendLine("- $it") }
    }

    private const val MAX_CONTEXT_CHARS = 24_000
}
