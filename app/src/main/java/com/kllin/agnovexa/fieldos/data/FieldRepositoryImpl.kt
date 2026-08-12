package com.kllin.agnovexa.fieldos.data

import androidx.room.withTransaction
import com.kllin.agnovexa.fieldos.core.database.ActivityLogEntity
import com.kllin.agnovexa.fieldos.core.database.CommandEntity
import com.kllin.agnovexa.fieldos.core.database.DailyReportEntity
import com.kllin.agnovexa.fieldos.core.database.FieldDao
import com.kllin.agnovexa.fieldos.core.database.FieldDatabase
import com.kllin.agnovexa.fieldos.core.database.IssueEntity
import com.kllin.agnovexa.fieldos.core.database.KnowledgeEntity
import com.kllin.agnovexa.fieldos.core.database.ProjectEntity
import com.kllin.agnovexa.fieldos.core.database.ProjectTechnologyEntity
import com.kllin.agnovexa.fieldos.core.database.SearchFtsEntity
import com.kllin.agnovexa.fieldos.core.database.ServerEntity
import com.kllin.agnovexa.fieldos.core.database.TaskEntity
import com.kllin.agnovexa.fieldos.domain.Activity
import com.kllin.agnovexa.fieldos.domain.Command
import com.kllin.agnovexa.fieldos.domain.CommandRiskClassifier
import com.kllin.agnovexa.fieldos.domain.DailyReport
import com.kllin.agnovexa.fieldos.domain.DailyReportComposer
import com.kllin.agnovexa.fieldos.domain.DeploymentImportDraft
import com.kllin.agnovexa.fieldos.domain.FieldRepository
import com.kllin.agnovexa.fieldos.domain.FieldTask
import com.kllin.agnovexa.fieldos.domain.Issue
import com.kllin.agnovexa.fieldos.domain.Knowledge
import com.kllin.agnovexa.fieldos.domain.Project
import com.kllin.agnovexa.fieldos.domain.SearchResult
import com.kllin.agnovexa.fieldos.domain.Server
import com.kllin.agnovexa.fieldos.domain.TechnologyCatalog
import com.kllin.agnovexa.fieldos.domain.WorkspaceSnapshot
import java.util.UUID
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.combine

@Singleton
class FieldRepositoryImpl @Inject constructor(
    private val database: FieldDatabase,
    private val dao: FieldDao,
) : FieldRepository {
    private data class CoreLists(
        val projects: List<ProjectEntity>, val tasks: List<TaskEntity>,
        val issues: List<IssueEntity>, val servers: List<ServerEntity>,
    )
    private data class ContentLists(
        val commands: List<CommandEntity>, val knowledge: List<KnowledgeEntity>,
        val activities: List<ActivityLogEntity>, val reports: List<DailyReportEntity>,
    )

    override val workspace = combine(
        combine(dao.observeProjects(), dao.observeTasks(), dao.observeIssues(), dao.observeServers(), ::CoreLists),
        combine(dao.observeCommands(), dao.observeKnowledge(), dao.observeActivities(), dao.observeReports(), ::ContentLists),
        dao.observeProjectTechnologies(),
    ) { core, content, technologies ->
        WorkspaceSnapshot(
            projects = core.projects.map(ProjectEntity::toDomain),
            tasks = core.tasks.map(TaskEntity::toDomain),
            issues = core.issues.map(IssueEntity::toDomain),
            servers = core.servers.map(ServerEntity::toDomain),
            commands = content.commands.map(CommandEntity::toDomain),
            knowledge = content.knowledge.map(KnowledgeEntity::toDomain),
            activities = content.activities.map(ActivityLogEntity::toDomain),
            reports = content.reports.map(DailyReportEntity::toDomain),
            projectTechnologyIds = technologies.groupBy(ProjectTechnologyEntity::projectId)
                .mapValues { (_, values) -> values.mapTo(linkedSetOf(), ProjectTechnologyEntity::technologyId) },
        )
    }

    override suspend fun createProject(name: String, code: String, description: String, location: String) {
        require(name.isNotBlank()) { "项目名称不能为空" }
        val now = System.currentTimeMillis()
        val id = UUID.randomUUID().toString()
        database.withTransaction {
            dao.upsertProject(ProjectEntity(id, name.trim(), code.trim(), description.trim(), "ACTIVE", 0, location.trim(), now, now))
            log(id, "PROJECT", id, "CREATED", "创建项目：${name.trim()}", description.trim(), now)
        }
    }

    override suspend fun updateProject(value: Project) {
        require(value.name.isNotBlank()) { "项目名称不能为空" }
        val now = System.currentTimeMillis()
        val isNew = value.id.isBlank()
        val normalized = value.copy(id = value.id.ifBlank { UUID.randomUUID().toString() }, createdAt = value.createdAt.takeIf { it > 0 } ?: now, updatedAt = now)
        database.withTransaction {
            dao.upsertProject(normalized.toEntity(now))
            if (isNew) log(normalized.id, "PROJECT", normalized.id, "CREATED", "创建项目：${normalized.name}", normalized.description, now)
        }
    }

    override suspend fun saveProjectWithTechnologies(value: Project, technologyIds: Set<String>) {
        require(value.name.isNotBlank()) { "项目名称不能为空" }
        validateTechnologyIds(technologyIds)
        val now = System.currentTimeMillis()
        val isNew = value.id.isBlank()
        val normalized = value.copy(
            id = value.id.ifBlank { UUID.randomUUID().toString() },
            createdAt = value.createdAt.takeIf { it > 0 } ?: now,
            updatedAt = now,
        )
        database.withTransaction {
            dao.upsertProject(normalized.toEntity(now))
            dao.deleteProjectTechnologies(normalized.id)
            if (technologyIds.isNotEmpty()) {
                dao.upsertProjectTechnologies(technologyIds.sorted().map { ProjectTechnologyEntity(normalized.id, it) })
            }
            log(
                normalized.id,
                "PROJECT",
                normalized.id,
                if (isNew) "CREATED" else "UPDATED",
                if (isNew) "创建项目：${normalized.name}" else "更新项目：${normalized.name}",
                "技术栈 ${technologyIds.size} 项",
                now,
            )
        }
    }

    override suspend fun setProjectTechnologies(projectId: String, technologyIds: Set<String>) {
        require(dao.allProjects().any { it.id == projectId }) { "项目不存在" }
        validateTechnologyIds(technologyIds)
        val now = System.currentTimeMillis()
        database.withTransaction {
            dao.deleteProjectTechnologies(projectId)
            if (technologyIds.isNotEmpty()) {
                dao.upsertProjectTechnologies(technologyIds.sorted().map { ProjectTechnologyEntity(projectId, it) })
            }
            log(projectId, "PROJECT_TECHNOLOGY", projectId, "UPDATED", "更新项目技术选型", "已选择 ${technologyIds.size} 项技术", now)
        }
    }

    override suspend fun deleteProject(id: String) {
        val linked = dao.allTasks().any { it.projectId == id } || dao.allIssues().any { it.projectId == id } ||
            dao.allServers().any { it.projectId == id } || dao.allKnowledge().any { it.projectId == id }
        require(!linked) { "该项目仍关联任务、问题、服务器或知识，请先处理关联数据" }
        database.withTransaction {
            dao.deleteProjectTechnologies(id)
            dao.deleteProject(id)
        }
    }

    override suspend fun createTask(projectId: String, title: String, description: String, priority: String) {
        require(projectId.isNotBlank() && title.isNotBlank()) { "请选择项目并填写任务标题" }
        val now = System.currentTimeMillis()
        val id = UUID.randomUUID().toString()
        database.withTransaction {
            dao.upsertTask(TaskEntity(id, projectId, title.trim(), description.trim(), "TODO", priority, now, now))
            log(projectId, "TASK", id, "CREATED", "新增任务：${title.trim()}", description.trim(), now)
        }
    }

    override suspend fun updateTask(value: FieldTask) {
        require(value.projectId.isNotBlank() && value.title.isNotBlank()) { "请选择项目并填写任务标题" }
        val now = System.currentTimeMillis()
        val isNew = value.id.isBlank()
        val normalized = value.copy(id = value.id.ifBlank { UUID.randomUUID().toString() }, createdAt = value.createdAt.takeIf { it > 0 } ?: now, updatedAt = now)
        database.withTransaction {
            dao.upsertTask(normalized.toEntity(now))
            if (isNew) log(normalized.projectId, "TASK", normalized.id, "CREATED", "新增任务：${normalized.title}", normalized.description, now)
        }
    }

    override suspend fun deleteTask(id: String) = dao.deleteTask(id)

    override suspend fun createIssue(projectId: String, serverId: String?, title: String, symptom: String, priority: String) {
        require(projectId.isNotBlank() && title.isNotBlank()) { "请选择项目并填写问题标题" }
        val now = System.currentTimeMillis()
        val id = UUID.randomUUID().toString()
        database.withTransaction {
            dao.upsertIssue(IssueEntity(id, projectId, serverId, title.trim(), symptom.trim(), "", "", "", "OPEN", priority, now, now))
            log(projectId, "ISSUE", id, "CREATED", "记录问题：${title.trim()}", symptom.trim(), now)
        }
    }

    override suspend fun updateIssue(value: Issue) {
        require(value.projectId.isNotBlank() && value.title.isNotBlank()) { "请选择项目并填写问题标题" }
        val now = System.currentTimeMillis()
        val isNew = value.id.isBlank()
        val normalized = value.copy(id = value.id.ifBlank { UUID.randomUUID().toString() }, createdAt = value.createdAt.takeIf { it > 0 } ?: now, updatedAt = now)
        database.withTransaction {
            dao.upsertIssue(normalized.toEntity(now))
            if (isNew) log(normalized.projectId, "ISSUE", normalized.id, "CREATED", "记录问题：${normalized.title}", normalized.symptom, now)
        }
    }

    override suspend fun deleteIssue(id: String) = dao.deleteIssue(id)

    override suspend fun resolveIssue(issueId: String, cause: String, solution: String, verification: String) {
        val issue = dao.allIssues().firstOrNull { it.id == issueId } ?: error("问题不存在")
        val now = System.currentTimeMillis()
        database.withTransaction {
            dao.upsertIssue(issue.copy(cause = cause.trim(), solution = solution.trim(), verification = verification.trim(), status = "RESOLVED", updatedAt = now))
            log(issue.projectId, "ISSUE", issue.id, "RESOLVED", "解决问题：${issue.title}", solution.trim(), now)
        }
    }

    override suspend fun createServer(projectId: String, name: String, host: String, port: Int, username: String, osType: String) {
        require(projectId.isNotBlank() && name.isNotBlank() && host.isNotBlank()) { "服务器名称、地址和项目不能为空" }
        require(port in 1..65535) { "端口必须在 1 到 65535 之间" }
        val now = System.currentTimeMillis()
        val id = UUID.randomUUID().toString()
        database.withTransaction {
            dao.upsertServer(ServerEntity(id, projectId, name.trim(), host.trim(), port, username.trim(), osType, "现场环境", "", now, now))
            log(projectId, "SERVER", id, "CREATED", "添加服务器：${name.trim()}", "$host:$port", now)
        }
    }

    override suspend fun updateServer(value: Server) {
        require(value.projectId.isNotBlank() && value.name.isNotBlank() && value.host.isNotBlank()) { "服务器名称、地址和项目不能为空" }
        require(value.port in 1..65535) { "端口必须在 1 到 65535 之间" }
        val now = System.currentTimeMillis()
        val isNew = value.id.isBlank()
        val normalized = value.copy(id = value.id.ifBlank { UUID.randomUUID().toString() }, createdAt = value.createdAt.takeIf { it > 0 } ?: now, updatedAt = now)
        database.withTransaction {
            dao.upsertServer(normalized.toEntity(now))
            if (isNew) log(normalized.projectId, "SERVER", normalized.id, "CREATED", "添加服务器：${normalized.name}", "${normalized.host}:${normalized.port}", now)
        }
    }

    override suspend fun deleteServer(id: String) = dao.deleteServer(id)

    override suspend fun createCommand(title: String, command: String, description: String, category: String, tags: String) {
        require(title.isNotBlank() && command.isNotBlank()) { "命令标题和内容不能为空" }
        val now = System.currentTimeMillis()
        val id = UUID.randomUUID().toString()
        val risk = CommandRiskClassifier.classify(command)
        database.withTransaction {
            dao.upsertCommand(CommandEntity(id, title.trim(), command.trim(), description.trim(), category.trim(), risk, tags.trim(), false, 0, now, now))
            dao.index(SearchFtsEntity(id, "COMMAND", title.trim(), "$command $description", tags.trim()))
            log(null, "COMMAND", id, "CREATED", "保存命令：${title.trim()}", "风险等级：$risk", now)
        }
    }

    override suspend fun updateCommand(value: Command) {
        require(value.title.isNotBlank() && value.command.isNotBlank()) { "命令标题和内容不能为空" }
        val now = System.currentTimeMillis()
        val isNew = value.id.isBlank()
        val updated = value.copy(
            id = value.id.ifBlank { UUID.randomUUID().toString() },
            riskLevel = CommandRiskClassifier.classify(value.command),
            createdAt = value.createdAt.takeIf { it > 0 } ?: now,
            updatedAt = now,
        )
        database.withTransaction {
            dao.upsertCommand(updated.toEntity())
            if (!isNew) dao.deleteIndex(value.id)
            dao.index(SearchFtsEntity(updated.id, "COMMAND", updated.title, "${updated.command} ${updated.description}", updated.tags))
            if (isNew) log(null, "COMMAND", updated.id, "CREATED", "保存命令：${updated.title}", "风险等级：${updated.riskLevel}", now)
        }
    }

    override suspend fun deleteCommand(id: String) {
        database.withTransaction { dao.deleteCommand(id); dao.deleteIndex(id) }
    }

    override suspend fun createKnowledge(projectId: String?, title: String, content: String, tags: String) {
        require(title.isNotBlank() && content.isNotBlank()) { "知识标题和正文不能为空" }
        val now = System.currentTimeMillis()
        val id = UUID.randomUUID().toString()
        database.withTransaction {
            dao.upsertKnowledge(KnowledgeEntity(id, projectId, title.trim(), content.trim(), content.take(120), "NOTE", tags.trim(), false, now, now))
            dao.index(SearchFtsEntity(id, "KNOWLEDGE", title.trim(), content.trim(), tags.trim()))
            log(projectId, "KNOWLEDGE", id, "CREATED", "新增知识：${title.trim()}", tags.trim(), now)
        }
    }

    override suspend fun updateKnowledge(value: Knowledge) {
        require(value.title.isNotBlank() && value.content.isNotBlank()) { "知识标题和正文不能为空" }
        val now = System.currentTimeMillis()
        val isNew = value.id.isBlank()
        val updated = value.copy(
            id = value.id.ifBlank { UUID.randomUUID().toString() },
            summary = value.content.take(120),
            createdAt = value.createdAt.takeIf { it > 0 } ?: now,
            updatedAt = now,
        )
        database.withTransaction {
            dao.upsertKnowledge(updated.toEntity())
            if (!isNew) dao.deleteIndex(value.id)
            dao.index(SearchFtsEntity(updated.id, "KNOWLEDGE", updated.title, updated.content, updated.tags))
            if (isNew) log(updated.projectId, "KNOWLEDGE", updated.id, "CREATED", "新增知识：${updated.title}", updated.tags, now)
        }
    }

    override suspend fun deleteKnowledge(id: String) {
        database.withTransaction { dao.deleteKnowledge(id); dao.deleteIndex(id) }
    }

    override suspend fun convertIssueToKnowledge(issueId: String) {
        val issue = dao.allIssues().firstOrNull { it.id == issueId } ?: error("问题不存在")
        val content = buildString {
            appendLine("## 现象"); appendLine(issue.symptom)
            appendLine("## 原因"); appendLine(issue.cause.ifBlank { "待补充" })
            appendLine("## 解决方案"); appendLine(issue.solution.ifBlank { "待补充" })
            appendLine("## 验证"); appendLine(issue.verification.ifBlank { "待补充" })
        }
        val now = System.currentTimeMillis()
        val id = UUID.randomUUID().toString()
        database.withTransaction {
            dao.upsertKnowledge(KnowledgeEntity(id, issue.projectId, issue.title, content, content.take(120), "TROUBLESHOOTING", "现场问题,故障复盘", false, now, now))
            dao.index(SearchFtsEntity(id, "KNOWLEDGE", issue.title, content, "现场问题,故障复盘"))
            log(issue.projectId, "KNOWLEDGE", id, "CREATED", "问题转为故障复盘：${issue.title}", issue.solution.take(120), now)
        }
    }

    override suspend fun search(query: String, limit: Int): List<SearchResult> {
        if (query.isBlank()) return emptyList()
        val ftsQuery = query.trim().split(Regex("\\s+")).joinToString(" AND ") { "\"${it.replace("\"", "") }\"*" }
        return dao.search(ftsQuery, limit).map { SearchResult(it.entityId, it.kind, it.title, it.body) }
    }

    override suspend fun generateDailyReport(dateKey: String, start: Long, end: Long): DailyReport {
        val activities = dao.activitiesBetween(start, end).map(ActivityLogEntity::toDomain)
        val draft = DailyReportComposer.compose(activities)
        val now = System.currentTimeMillis()
        val entity = DailyReportEntity(
            id = UUID.randomUUID().toString(), dateKey = dateKey, projectId = null,
            title = "$dateKey 工作日报", workContent = draft.workContent, problems = draft.problems,
            solutions = draft.solutions, nextPlan = draft.nextPlan, risk = draft.risk,
            status = "DRAFT", createdAt = now, updatedAt = now,
        )
        database.withTransaction {
            dao.upsertReport(entity)
            log(null, "DAILY_REPORT", entity.id, "GENERATED", "生成日报：${entity.title}", "汇总 ${activities.size} 条活动", now)
        }
        return entity.toDomain()
    }

    override suspend fun saveDailyReport(value: DailyReport) {
        require(value.title.isNotBlank()) { "日报标题不能为空" }
        val now = System.currentTimeMillis()
        val normalized = value.copy(
            id = value.id.ifBlank { UUID.randomUUID().toString() },
            dateKey = value.dateKey.ifBlank { java.time.LocalDate.now().toString() },
            createdAt = value.createdAt.takeIf { it > 0 } ?: now,
            updatedAt = now,
        )
        database.withTransaction {
            dao.upsertReport(normalized.toEntity())
            log(normalized.projectId, "DAILY_REPORT", normalized.id, "SAVED", "保存日报：${normalized.title}", normalized.workContent.take(120), now)
        }
    }

    override suspend fun deleteDailyReport(id: String) = dao.deleteReport(id)

    override suspend fun importDeploymentDocument(draft: DeploymentImportDraft, projectId: String?, importCommands: Boolean) {
        require(draft.rawContent.isNotBlank()) { "部署文档内容为空" }
        if (projectId != null) require(dao.allProjects().any { it.id == projectId }) { "关联项目不存在" }
        val now = System.currentTimeMillis()
        val fingerprint = sha256("${draft.sourceName}\n${draft.rawContent}").take(32)
        val knowledgeId = "deployment-$fingerprint"
        val summary = "来源：${draft.sourceName}；识别现场字段 ${draft.context.completedFields}/10；识别命令 ${draft.commands.size} 条"
        database.withTransaction {
            val knowledge = KnowledgeEntity(
                id = knowledgeId,
                projectId = projectId,
                title = draft.title.trim(),
                content = draft.rawContent,
                summary = summary,
                type = "DEPLOYMENT_DOCUMENT",
                tags = "部署文档,AI Agent,导入",
                favorite = false,
                createdAt = now,
                updatedAt = now,
            )
            dao.upsertKnowledge(knowledge)
            dao.deleteIndex(knowledgeId)
            dao.index(SearchFtsEntity(knowledgeId, "KNOWLEDGE", knowledge.title, knowledge.content, knowledge.tags))
            if (importCommands) {
                draft.commands.take(30).forEachIndexed { index, command ->
                    val id = "deployment-command-$fingerprint-$index"
                    val risk = CommandRiskClassifier.classify(command.command)
                    val entity = CommandEntity(
                        id, command.title.trim(), command.command.trim(), command.description.trim(),
                        command.category.trim().ifBlank { "部署导入" }, risk, command.tags.trim(), false, 0, now, now,
                    )
                    dao.upsertCommand(entity)
                    dao.deleteIndex(id)
                    dao.index(SearchFtsEntity(id, "COMMAND", entity.title, "${entity.command} ${entity.description}", entity.tags))
                }
            }
            log(projectId, "DEPLOYMENT_DOCUMENT", knowledgeId, "IMPORTED", "导入部署文档：${draft.title}", summary, now)
        }
    }

    override suspend fun seedBuiltinCommands() {
        val existing = dao.allCommands().mapTo(hashSetOf()) { it.id }
        builtinCommands().filterNot { it.id in existing }.forEach { command ->
            dao.upsertCommand(command)
            dao.index(SearchFtsEntity(command.id, "COMMAND", command.title, "${command.command} ${command.description}", command.tags))
        }
    }

    private suspend fun log(projectId: String?, entityType: String, entityId: String, action: String, title: String, description: String, at: Long) {
        dao.upsertActivity(ActivityLogEntity(UUID.randomUUID().toString(), projectId, entityType, entityId, action, title, description, at))
    }

    private fun validateTechnologyIds(ids: Set<String>) {
        require(ids.size <= 60) { "单个项目最多保存 60 项技术" }
        require(ids.all(TechnologyCatalog::isValidId)) { "包含无效的技术选型" }
    }
}

private fun ProjectEntity.toDomain() = Project(id, name, code, description, status, progress, location, createdAt, updatedAt)
private fun TaskEntity.toDomain() = FieldTask(id, projectId, title, description, status, priority, createdAt, updatedAt)
private fun IssueEntity.toDomain() = Issue(id, projectId, serverId, title, symptom, cause, solution, verification, status, priority, createdAt, updatedAt)
private fun ServerEntity.toDomain() = Server(id, projectId, name, host, port, username, osType, environment, notes, createdAt, updatedAt)
private fun CommandEntity.toDomain() = Command(id, title, command, description, category, riskLevel, tags, favorite, useCount, createdAt, updatedAt)
private fun KnowledgeEntity.toDomain() = Knowledge(id, projectId, title, content, summary, type, tags, favorite, createdAt, updatedAt)
private fun ActivityLogEntity.toDomain() = Activity(id, projectId, entityType, entityId, actionType, title, description, occurredAt)
private fun DailyReportEntity.toDomain() = DailyReport(id, dateKey, projectId, title, workContent, problems, solutions, nextPlan, risk, status, createdAt, updatedAt)
private fun Project.toEntity(now: Long) = ProjectEntity(id, name.trim(), code.trim(), description.trim(), status, progress.coerceIn(0, 100), location.trim(), createdAt, now)
private fun FieldTask.toEntity(now: Long) = TaskEntity(id, projectId, title.trim(), description.trim(), status, priority, createdAt, now)
private fun Issue.toEntity(now: Long) = IssueEntity(id, projectId, serverId, title.trim(), symptom.trim(), cause.trim(), solution.trim(), verification.trim(), status, priority, createdAt, now)
private fun Server.toEntity(now: Long) = ServerEntity(id, projectId, name.trim(), host.trim(), port, username.trim(), osType, environment, notes, createdAt, now)
private fun Command.toEntity() = CommandEntity(id, title.trim(), command.trim(), description.trim(), category.trim(), riskLevel, tags.trim(), favorite, useCount, createdAt, updatedAt)
private fun Knowledge.toEntity() = KnowledgeEntity(id, projectId, title.trim(), content.trim(), summary, type, tags.trim(), favorite, createdAt, updatedAt)
private fun DailyReport.toEntity() = DailyReportEntity(id, dateKey, projectId, title.trim(), workContent.trim(), problems.trim(), solutions.trim(), nextPlan.trim(), risk.trim(), status, createdAt, updatedAt)

private fun builtinCommands(): List<CommandEntity> {
    val now = 1_700_000_000_000L
    data class Seed(val slug: String, val title: String, val command: String, val description: String, val category: String, val tags: String)
    return listOf(
        Seed("linux-disk", "查看磁盘占用", "df -h", "按易读单位显示文件系统空间", "Linux", "磁盘,巡检"),
        Seed("linux-memory", "查看内存占用", "free -h", "显示内存与交换空间使用情况", "Linux", "内存,巡检"),
        Seed("linux-port", "查看监听端口", "ss -lntup", "列出 TCP/UDP 监听端口与进程", "Linux", "网络,端口"),
        Seed("linux-process", "查看高占用进程", "ps aux --sort=-%cpu | head -n 15", "按 CPU 占用排序显示进程", "Linux", "进程,巡检"),
        Seed("linux-logs", "查看服务日志", "journalctl -u {{service_name}} -n 200 --no-pager", "查看 systemd 服务最近 200 行日志", "Linux", "日志,systemd"),
        Seed("linux-service", "查看服务状态", "systemctl status {{service_name}} --no-pager", "查看 systemd 服务当前状态", "Linux", "服务,systemd"),
        Seed("network-ping", "测试网络连通", "ping -c 4 {{host}}", "向目标主机发送四次 ICMP 探测", "网络", "网络,连通性"),
        Seed("network-dns", "查询 DNS", "nslookup {{domain}}", "查询域名解析记录", "网络", "DNS,域名"),
        Seed("docker-ps", "查看容器状态", "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'", "显示运行中容器、状态和端口", "Docker", "容器,巡检"),
        Seed("docker-logs", "查看容器日志", "docker logs --tail 200 {{container_name}}", "查看容器最近 200 行日志", "Docker", "容器,日志"),
        Seed("nginx-test", "校验 NGINX 配置", "nginx -t", "仅校验配置语法，不重载服务", "NGINX", "Web,配置"),
        Seed(
            "nginx-cve-2026-42533-audit",
            "核验 NGINX CVE-2026-42533",
            """
                echo '=== NGINX VERSION ==='
                nginx -v 2>&1
                echo '=== BUILD OPTIONS ==='
                nginx -V 2>&1
                echo '=== MAP / REGEX LINES ==='
                nginx -T 2>&1 | grep -nE '^[[:space:]]*map[[:space:]]+|~\*?'
            """.trimIndent(),
            "只读采集版本、编译参数及 map/regex 配置线索；0.9.6–1.31.2 需结合实际配置核验，安全版本为 1.30.4+ 或 1.31.3+。",
            "NGINX",
            "NGINX,安全,CVE-2026-42533,只读,待核验",
        ),
        Seed("postgres-ready", "检查 PostgreSQL", "pg_isready -h {{host}} -p {{port}}", "检查 PostgreSQL 是否接受连接", "PostgreSQL", "数据库,巡检"),
        Seed("redis-ping", "检查 Redis", "redis-cli -h {{host}} -p {{port}} PING", "向 Redis 发送健康检查", "Redis", "缓存,巡检"),
        Seed("windows-ip", "查看 Windows 网络配置", "ipconfig /all", "显示 Windows 完整网络配置", "Windows", "网络,Windows"),
        Seed("windows-port", "查看 Windows 监听端口", "Get-NetTCPConnection -State Listen", "通过 PowerShell 查看监听端口", "Windows", "端口,PowerShell"),
        Seed(
            "bundle-linux-inspection",
            "Linux 基础巡检整包",
            """
                echo '=== SYSTEM ==='
                uname -a
                uptime
                echo '=== DISK ==='
                df -h
                echo '=== MEMORY ==='
                free -h
                echo '=== LISTEN PORTS ==='
                ss -lntup
                echo '=== TOP CPU ==='
                ps aux --sort=-%cpu | head -n 15
            """.trimIndent(),
            "只读巡检整包，可一次复制到 Linux 终端；发送电脑前仍需核对现场权限。",
            "命令包",
            "命令包,Linux,只读,巡检",
        ),
        Seed(
            "bundle-docker-inspection",
            "Docker 状态巡检整包",
            """
                echo '=== DOCKER VERSION ==='
                docker version
                echo '=== CONTAINERS ==='
                docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
                echo '=== RESOURCE SNAPSHOT ==='
                docker stats --no-stream
                echo '=== DISK USAGE ==='
                docker system df
            """.trimIndent(),
            "一次收集 Docker 版本、容器、资源和磁盘占用，不执行清理。",
            "命令包",
            "命令包,Docker,只读,巡检",
        ),
        Seed(
            "bundle-nginx-inspection",
            "NGINX 排查整包",
            """
                echo '=== CONFIG TEST ==='
                nginx -t
                echo '=== SERVICE ==='
                systemctl status nginx --no-pager
                echo '=== RECENT LOGS ==='
                journalctl -u nginx -n 100 --no-pager
                echo '=== LISTEN PORTS ==='
                ss -lntp
            """.trimIndent(),
            "校验配置并收集服务、日志和端口信息，不自动重载 NGINX。",
            "命令包",
            "命令包,NGINX,只读,排查",
        ),
        Seed(
            "bundle-windows-inspection",
            "Windows PowerShell 巡检整包",
            """
                Write-Output '=== SYSTEM ==='
                Get-ComputerInfo | Select-Object CsName, WindowsProductName, WindowsVersion, OsArchitecture
                Write-Output '=== VOLUMES ==='
                Get-Volume | Select-Object DriveLetter, FileSystemLabel, SizeRemaining, Size
                Write-Output '=== LISTEN PORTS ==='
                Get-NetTCPConnection -State Listen | Sort-Object LocalPort
                Write-Output '=== TOP CPU ==='
                Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name, Id, CPU
            """.trimIndent(),
            "一次复制到 PowerShell 收集系统、磁盘、端口和进程信息。",
            "命令包",
            "命令包,Windows,PowerShell,只读,巡检",
        ),
    ).map { seed ->
        val risk = CommandRiskClassifier.classify(seed.command)
        CommandEntity("builtin-${seed.slug}", seed.title, seed.command, seed.description, seed.category, risk, seed.tags, false, 0, now, now)
    }
}

private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
