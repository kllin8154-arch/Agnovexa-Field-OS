package com.kllin.agnovexa.fieldos.core.backup

import android.content.Context
import android.net.Uri
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
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

@Singleton
class BackupManager @Inject constructor(
    @param:ApplicationContext private val context: Context,
    private val database: FieldDatabase,
    private val dao: FieldDao,
) {
    suspend fun export(uri: Uri) = withContext(Dispatchers.IO) {
        val payload = createPayload()
        context.contentResolver.openOutputStream(uri)?.use { output ->
            ZipOutputStream(output).use { zip ->
                zip.putNextEntry(ZipEntry("manifest.json"))
                zip.write(JSONObject().put("format", "agnovexa-field-os").put("version", 1).put("containsSecrets", false).toString(2).toByteArray())
                zip.closeEntry()
                zip.putNextEntry(ZipEntry("database.json"))
                zip.write(payload.toString(2).toByteArray())
                zip.closeEntry()
            }
        } ?: error("无法打开备份目标")
    }

    suspend fun restore(uri: Uri) = withContext(Dispatchers.IO) {
        var manifest: JSONObject? = null
        var payload: JSONObject? = null
        context.contentResolver.openInputStream(uri)?.use { input ->
            ZipInputStream(input).use { zip ->
                var entry = zip.nextEntry
                while (entry != null) {
                    val text = zip.readBytes().toString(Charsets.UTF_8)
                    when (entry.name) {
                        "manifest.json" -> manifest = JSONObject(text)
                        "database.json" -> payload = JSONObject(text)
                    }
                    entry = zip.nextEntry
                }
            }
        } ?: error("无法打开备份文件")
        require(manifest?.optString("format") == "agnovexa-field-os" && manifest?.optInt("version") == 1) { "备份格式或版本无效" }
        val data = requireNotNull(payload) { "备份缺少 database.json" }
        val projects = data.array("projects") { ProjectEntity(it.s("id"), it.s("name"), it.s("code"), it.s("description"), it.s("status"), it.i("progress"), it.s("location"), it.l("createdAt"), it.l("updatedAt")) }
        val tasks = data.array("tasks") { TaskEntity(it.s("id"), it.s("projectId"), it.s("title"), it.s("description"), it.s("status"), it.s("priority"), it.l("createdAt"), it.l("updatedAt")) }
        val issues = data.array("issues") { IssueEntity(it.s("id"), it.s("projectId"), it.ns("serverId"), it.s("title"), it.s("symptom"), it.s("cause"), it.s("solution"), it.s("verification"), it.s("status"), it.s("priority"), it.l("createdAt"), it.l("updatedAt")) }
        val servers = data.array("servers") { ServerEntity(it.s("id"), it.s("projectId"), it.s("name"), it.s("host"), it.i("port"), it.s("username"), it.s("osType"), it.s("environment"), it.s("notes"), it.l("createdAt"), it.l("updatedAt")) }
        val commands = data.array("commands") { CommandEntity(it.s("id"), it.s("title"), it.s("command"), it.s("description"), it.s("category"), it.s("riskLevel"), it.s("tags"), it.getBoolean("favorite"), it.i("useCount"), it.l("createdAt"), it.l("updatedAt")) }
        val knowledge = data.array("knowledge") { KnowledgeEntity(it.s("id"), it.ns("projectId"), it.s("title"), it.s("content"), it.s("summary"), it.s("type"), it.s("tags"), it.getBoolean("favorite"), it.l("createdAt"), it.l("updatedAt")) }
        val activities = data.array("activities") { ActivityLogEntity(it.s("id"), it.ns("projectId"), it.s("entityType"), it.s("entityId"), it.s("actionType"), it.s("title"), it.s("description"), it.l("occurredAt")) }
        val reports = data.array("reports") { DailyReportEntity(it.s("id"), it.s("dateKey"), it.ns("projectId"), it.s("title"), it.s("workContent"), it.s("problems"), it.s("solutions"), it.s("nextPlan"), it.s("risk"), it.s("status"), it.l("createdAt"), it.l("updatedAt")) }
        val projectTechnologies = data.optionalArray("projectTechnologies") { ProjectTechnologyEntity(it.s("projectId"), it.s("technologyId")) }
        context.filesDir.resolve("restore-snapshot.json").writeText(createPayload().toString(2))
        database.withTransaction {
            dao.clearSearch(); dao.clearReports(); dao.clearActivities(); dao.clearKnowledge(); dao.clearCommands(); dao.clearProjectTechnologies()
            dao.clearServers(); dao.clearIssues(); dao.clearTasks(); dao.clearProjects()
            projects.forEach { dao.upsertProject(it) }; tasks.forEach { dao.upsertTask(it) }
            issues.forEach { dao.upsertIssue(it) }; servers.forEach { dao.upsertServer(it) }
            commands.forEach { dao.upsertCommand(it); dao.index(SearchFtsEntity(it.id, "COMMAND", it.title, "${it.command} ${it.description}", it.tags)) }
            knowledge.forEach { dao.upsertKnowledge(it); dao.index(SearchFtsEntity(it.id, "KNOWLEDGE", it.title, it.content, it.tags)) }
            activities.forEach { dao.upsertActivity(it) }; reports.forEach { dao.upsertReport(it) }
            if (projectTechnologies.isNotEmpty()) dao.upsertProjectTechnologies(projectTechnologies)
        }
    }

    private suspend fun createPayload() = JSONObject().apply {
        put("projects", JSONArray(dao.allProjects().map(::projectJson)))
        put("tasks", JSONArray(dao.allTasks().map(::taskJson)))
        put("issues", JSONArray(dao.allIssues().map(::issueJson)))
        put("servers", JSONArray(dao.allServers().map(::serverJson)))
        put("commands", JSONArray(dao.allCommands().map(::commandJson)))
        put("knowledge", JSONArray(dao.allKnowledge().map(::knowledgeJson)))
        put("activities", JSONArray(dao.allActivities().map(::activityJson)))
        put("reports", JSONArray(dao.allReports().map(::reportJson)))
        put("projectTechnologies", JSONArray(dao.allProjectTechnologies().map(::projectTechnologyJson)))
    }
}

private fun JSONObject.base(id: String, createdAt: Long, updatedAt: Long) = put("id", id).put("createdAt", createdAt).put("updatedAt", updatedAt)
private fun projectJson(v: ProjectEntity) = JSONObject().base(v.id, v.createdAt, v.updatedAt).put("name", v.name).put("code", v.code).put("description", v.description).put("status", v.status).put("progress", v.progress).put("location", v.location)
private fun taskJson(v: TaskEntity) = JSONObject().base(v.id, v.createdAt, v.updatedAt).put("projectId", v.projectId).put("title", v.title).put("description", v.description).put("status", v.status).put("priority", v.priority)
private fun issueJson(v: IssueEntity) = JSONObject().base(v.id, v.createdAt, v.updatedAt).put("projectId", v.projectId).put("serverId", v.serverId).put("title", v.title).put("symptom", v.symptom).put("cause", v.cause).put("solution", v.solution).put("verification", v.verification).put("status", v.status).put("priority", v.priority)
private fun serverJson(v: ServerEntity) = JSONObject().base(v.id, v.createdAt, v.updatedAt).put("projectId", v.projectId).put("name", v.name).put("host", v.host).put("port", v.port).put("username", v.username).put("osType", v.osType).put("environment", v.environment).put("notes", v.notes)
private fun commandJson(v: CommandEntity) = JSONObject().base(v.id, v.createdAt, v.updatedAt).put("title", v.title).put("command", v.command).put("description", v.description).put("category", v.category).put("riskLevel", v.riskLevel).put("tags", v.tags).put("favorite", v.favorite).put("useCount", v.useCount)
private fun knowledgeJson(v: KnowledgeEntity) = JSONObject().base(v.id, v.createdAt, v.updatedAt).put("projectId", v.projectId).put("title", v.title).put("content", v.content).put("summary", v.summary).put("type", v.type).put("tags", v.tags).put("favorite", v.favorite)
private fun activityJson(v: ActivityLogEntity) = JSONObject().put("id", v.id).put("projectId", v.projectId).put("entityType", v.entityType).put("entityId", v.entityId).put("actionType", v.actionType).put("title", v.title).put("description", v.description).put("occurredAt", v.occurredAt)
private fun reportJson(v: DailyReportEntity) = JSONObject().base(v.id, v.createdAt, v.updatedAt).put("dateKey", v.dateKey).put("projectId", v.projectId).put("title", v.title).put("workContent", v.workContent).put("problems", v.problems).put("solutions", v.solutions).put("nextPlan", v.nextPlan).put("risk", v.risk).put("status", v.status)
private fun projectTechnologyJson(v: ProjectTechnologyEntity) = JSONObject().put("projectId", v.projectId).put("technologyId", v.technologyId)
private fun JSONObject.s(key: String) = getString(key)
private fun JSONObject.ns(key: String) = if (isNull(key)) null else getString(key)
private fun JSONObject.i(key: String) = getInt(key)
private fun JSONObject.l(key: String) = getLong(key)
private fun <T> JSONObject.array(key: String, transform: (JSONObject) -> T): List<T> = getJSONArray(key).let { array -> (0 until array.length()).map { transform(array.getJSONObject(it)) } }
private fun <T> JSONObject.optionalArray(key: String, transform: (JSONObject) -> T): List<T> = optJSONArray(key)?.let { array ->
    (0 until array.length()).map { transform(array.getJSONObject(it)) }
}.orEmpty()
