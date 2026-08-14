package com.kllin.agnovexa.fieldos.domain

import javax.inject.Inject

class FieldUseCases @Inject constructor(private val repository: FieldRepository) {
    val workspace = repository.workspace
    suspend fun createProject(name: String, code: String, description: String, location: String) = repository.createProject(name, code, description, location)
    suspend fun updateProject(value: Project) = repository.updateProject(value)
    suspend fun saveProjectWithTechnologies(value: Project, technologyIds: Set<String>) = repository.saveProjectWithTechnologies(value, technologyIds)
    suspend fun setProjectTechnologies(projectId: String, technologyIds: Set<String>) = repository.setProjectTechnologies(projectId, technologyIds)
    suspend fun deleteProject(id: String) = repository.deleteProject(id)
    suspend fun createTask(projectId: String, title: String, description: String, priority: String) = repository.createTask(projectId, title, description, priority)
    suspend fun updateTask(value: FieldTask) = repository.updateTask(value)
    suspend fun deleteTask(id: String) = repository.deleteTask(id)
    suspend fun createIssue(projectId: String, serverId: String?, title: String, symptom: String, priority: String) = repository.createIssue(projectId, serverId, title, symptom, priority)
    suspend fun updateIssue(value: Issue) = repository.updateIssue(value)
    suspend fun deleteIssue(id: String) = repository.deleteIssue(id)
    suspend fun resolveIssue(issueId: String, cause: String, solution: String, verification: String) = repository.resolveIssue(issueId, cause, solution, verification)
    suspend fun createServer(projectId: String, name: String, host: String, port: Int, username: String, osType: String) = repository.createServer(projectId, name, host, port, username, osType)
    suspend fun updateServer(value: Server) = repository.updateServer(value)
    suspend fun deleteServer(id: String) = repository.deleteServer(id)
    suspend fun createCommand(title: String, command: String, description: String, category: String, tags: String) = repository.createCommand(title, command, description, category, tags)
    suspend fun updateCommand(value: Command) = repository.updateCommand(value)
    suspend fun deleteCommand(id: String) = repository.deleteCommand(id)
    suspend fun createKnowledge(projectId: String?, title: String, content: String, tags: String) = repository.createKnowledge(projectId, title, content, tags)
    suspend fun updateKnowledge(value: Knowledge) = repository.updateKnowledge(value)
    suspend fun deleteKnowledge(id: String) = repository.deleteKnowledge(id)
    suspend fun convertIssueToKnowledge(issueId: String) = repository.convertIssueToKnowledge(issueId)
    suspend fun search(query: String) = repository.search(query)
    suspend fun generateDailyReport(dateKey: String, start: Long, end: Long) = repository.generateDailyReport(dateKey, start, end)
    suspend fun saveDailyReport(value: DailyReport) = repository.saveDailyReport(value)
    suspend fun deleteDailyReport(id: String) = repository.deleteDailyReport(id)
    suspend fun importDeploymentDocument(draft: DeploymentImportDraft, projectId: String?, importCommands: Boolean) =
        repository.importDeploymentDocument(draft, projectId, importCommands)
    suspend fun installDeploymentExample() = repository.installDeploymentExample()
    suspend fun seedBuiltinCommands() = repository.seedBuiltinCommands()
}
