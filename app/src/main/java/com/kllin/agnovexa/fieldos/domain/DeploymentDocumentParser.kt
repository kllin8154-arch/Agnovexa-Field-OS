package com.kllin.agnovexa.fieldos.domain

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

object DeploymentDocumentParser {
    private val json = Json { ignoreUnknownKeys = true }
    private val codeBlock = Regex("```([A-Za-z0-9_+.-]*)\\s*\\n([\\s\\S]*?)```", RegexOption.MULTILINE)
    private val heading = Regex("^\\s{0,3}#{1,6}\\s+(.+?)\\s*$")

    fun parse(sourceName: String, content: String): DeploymentImportDraft {
        require(content.isNotBlank()) { "部署文档内容为空" }
        val normalized = content.replace("\r\n", "\n").replace('\r', '\n').trim()
        val structured = parseJson(normalized)
        val sections = markdownSections(normalized)
        val title = structured?.string("title", "name", "documentTitle")
            ?: normalized.lineSequence().mapNotNull { heading.matchEntire(it)?.groupValues?.get(1) }.firstOrNull()
            ?: sourceName.substringBeforeLast('.').ifBlank { "导入的部署文档" }
        val contextObject = structured?.get("deploymentContext") as? JsonObject ?: structured
        val context = DeploymentContext(
            siteName = contextObject.string("siteName", "projectName", "project") ?: section(sections, "现场", "项目", "project"),
            deploymentGoal = contextObject.string("deploymentGoal", "goal", "objective") ?: section(sections, "部署目标", "目标", "概述", "overview"),
            architecture = contextObject.string("architecture", "serverArchitecture", "cpuArchitecture") ?: section(sections, "服务器架构", "系统架构", "架构", "architecture"),
            operatingSystems = contextObject.string("operatingSystems", "operatingSystem", "os") ?: section(sections, "操作系统", "系统环境", "operating system"),
            serverTopology = contextObject.string("serverTopology", "topology", "servers") ?: section(sections, "服务器拓扑", "节点规划", "拓扑", "topology"),
            networkAccess = contextObject.string("networkAccess", "network", "ports") ?: section(sections, "网络条件", "网络与端口", "网络", "network"),
            baseDirectory = contextObject.string("baseDirectory", "installDirectory", "rootPath") ?: section(sections, "目标根目录", "安装目录", "目录规划", "directory"),
            filesAndServices = contextObject.string("filesAndServices", "files", "services") ?: section(sections, "文件与服务", "服务规划", "文件规划", "services"),
            runtimeAndVersions = contextObject.string("runtimeAndVersions", "runtime", "versions", "technologyStack") ?: section(sections, "运行时与版本", "技术栈", "依赖版本", "versions"),
            dataAndBackup = contextObject.string("dataAndBackup", "backup", "rollback") ?: section(sections, "数据与备份", "备份与回退", "回退方案", "rollback"),
            constraints = contextObject.string("constraints", "risks", "limitations") ?: section(sections, "现场限制", "风险与注意", "限制", "risks"),
        )
        val commands = structuredCommands(structured).ifEmpty { markdownCommands(normalized, title) }
        val warnings = buildList {
            if (context.completedFields == 0) add("未识别到结构化现场字段，原文仍可完整入库")
            if ('\uFFFD' in normalized) add("文档可能包含无法识别的字符，请在预览中核对")
            if (commands.size > 30) add("识别到较多命令，入库时仅保留前 30 条")
        }
        return DeploymentImportDraft(sourceName, title.take(100), normalized, context, commands.take(30), warnings)
    }

    private fun parseJson(content: String): JsonObject? {
        if (!content.startsWith('{')) return null
        return runCatching { json.parseToJsonElement(content).jsonObject }.getOrNull()
    }

    private fun markdownSections(content: String): Map<String, String> {
        val result = linkedMapOf<String, StringBuilder>()
        var current: String? = null
        content.lineSequence().forEach { line ->
            val match = heading.matchEntire(line)
            if (match != null) {
                current = match.groupValues[1].trim().lowercase()
                result.getOrPut(current!!) { StringBuilder() }
            } else if (current != null && !line.trimStart().startsWith("```")) {
                result.getValue(current!!).appendLine(line)
            }
        }
        return result.mapValues { it.value.toString().trim().take(4000) }
    }

    private fun section(sections: Map<String, String>, vararg aliases: String): String = sections.entries
        .firstOrNull { entry -> aliases.any { alias -> entry.key.contains(alias.lowercase()) } }
        ?.value.orEmpty()

    private fun markdownCommands(content: String, documentTitle: String): List<ImportedCommand> = codeBlock.findAll(content).mapIndexed { index, match ->
        val language = match.groupValues[1].ifBlank { "Shell" }
        ImportedCommand(
            title = "$documentTitle · 命令 ${index + 1}",
            command = match.groupValues[2].trim(),
            description = "从 ${language} 代码块导入；执行前必须核对目标、变量、权限和回退条件",
            category = language,
        )
    }.filter { it.command.isNotBlank() }.toList()

    private fun structuredCommands(root: JsonObject?): List<ImportedCommand> {
        val array = root?.get("commands") as? JsonArray ?: return emptyList()
        return array.mapIndexedNotNull { index, element ->
            when (element) {
                is JsonObject -> {
                    val command = element.string("command", "content", "script") ?: return@mapIndexedNotNull null
                    ImportedCommand(
                        title = element.string("title", "name") ?: "导入命令 ${index + 1}",
                        command = command,
                        description = element.string("description", "notes").orEmpty(),
                        category = element.string("category", "language") ?: "部署导入",
                        tags = element.string("tags") ?: "AI Agent,部署,待验证",
                    )
                }
                else -> element.primitiveContent()?.takeIf { it.isNotBlank() }?.let { ImportedCommand("导入命令 ${index + 1}", it) }
            }
        }
    }

    private fun JsonObject?.string(vararg keys: String): String? = this?.let { objectValue ->
        keys.firstNotNullOfOrNull { key -> objectValue[key]?.primitiveContent()?.trim()?.takeIf(String::isNotBlank) }
    }

    private fun JsonElement.primitiveContent(): String? = runCatching { jsonPrimitive.contentOrNull }.getOrNull()
}
