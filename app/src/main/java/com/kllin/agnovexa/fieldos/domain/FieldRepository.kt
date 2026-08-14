package com.kllin.agnovexa.fieldos.domain

import kotlinx.coroutines.flow.Flow

interface FieldRepository {
    val workspace: Flow<WorkspaceSnapshot>
    suspend fun createProject(name: String, code: String, description: String, location: String)
    suspend fun updateProject(value: Project)
    suspend fun saveProjectWithTechnologies(value: Project, technologyIds: Set<String>)
    suspend fun setProjectTechnologies(projectId: String, technologyIds: Set<String>)
    suspend fun deleteProject(id: String)
    suspend fun createTask(projectId: String, title: String, description: String, priority: String)
    suspend fun updateTask(value: FieldTask)
    suspend fun deleteTask(id: String)
    suspend fun createIssue(projectId: String, serverId: String?, title: String, symptom: String, priority: String)
    suspend fun updateIssue(value: Issue)
    suspend fun deleteIssue(id: String)
    suspend fun resolveIssue(issueId: String, cause: String, solution: String, verification: String)
    suspend fun createServer(projectId: String, name: String, host: String, port: Int, username: String, osType: String)
    suspend fun updateServer(value: Server)
    suspend fun deleteServer(id: String)
    suspend fun createCommand(title: String, command: String, description: String, category: String, tags: String)
    suspend fun updateCommand(value: Command)
    suspend fun deleteCommand(id: String)
    suspend fun createKnowledge(projectId: String?, title: String, content: String, tags: String)
    suspend fun updateKnowledge(value: Knowledge)
    suspend fun deleteKnowledge(id: String)
    suspend fun convertIssueToKnowledge(issueId: String)
    suspend fun search(query: String, limit: Int = 30): List<SearchResult>
    suspend fun generateDailyReport(dateKey: String, start: Long, end: Long): DailyReport
    suspend fun saveDailyReport(value: DailyReport)
    suspend fun deleteDailyReport(id: String)
    suspend fun importDeploymentDocument(draft: DeploymentImportDraft, projectId: String?, importCommands: Boolean)
    suspend fun installDeploymentExample()
    suspend fun seedBuiltinCommands()
}
