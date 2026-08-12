package com.kllin.agnovexa.fieldos.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface FieldDao {
    @Query("SELECT * FROM projects ORDER BY updatedAt DESC") fun observeProjects(): Flow<List<ProjectEntity>>
    @Query("SELECT * FROM tasks ORDER BY updatedAt DESC") fun observeTasks(): Flow<List<TaskEntity>>
    @Query("SELECT * FROM issues ORDER BY updatedAt DESC") fun observeIssues(): Flow<List<IssueEntity>>
    @Query("SELECT * FROM servers ORDER BY updatedAt DESC") fun observeServers(): Flow<List<ServerEntity>>
    @Query("SELECT * FROM commands ORDER BY favorite DESC, updatedAt DESC") fun observeCommands(): Flow<List<CommandEntity>>
    @Query("SELECT * FROM knowledge ORDER BY favorite DESC, updatedAt DESC") fun observeKnowledge(): Flow<List<KnowledgeEntity>>
    @Query("SELECT * FROM activity_logs ORDER BY occurredAt DESC LIMIT 100") fun observeActivities(): Flow<List<ActivityLogEntity>>
    @Query("SELECT * FROM daily_reports ORDER BY dateKey DESC, updatedAt DESC") fun observeReports(): Flow<List<DailyReportEntity>>
    @Query("SELECT * FROM project_technologies ORDER BY projectId, technologyId") fun observeProjectTechnologies(): Flow<List<ProjectTechnologyEntity>>

    @Upsert suspend fun upsertProject(value: ProjectEntity)
    @Upsert suspend fun upsertTask(value: TaskEntity)
    @Upsert suspend fun upsertIssue(value: IssueEntity)
    @Upsert suspend fun upsertServer(value: ServerEntity)
    @Upsert suspend fun upsertCommand(value: CommandEntity)
    @Upsert suspend fun upsertKnowledge(value: KnowledgeEntity)
    @Upsert suspend fun upsertActivity(value: ActivityLogEntity)
    @Upsert suspend fun upsertReport(value: DailyReportEntity)
    @Upsert suspend fun upsertProjectTechnologies(values: List<ProjectTechnologyEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun index(value: SearchFtsEntity)
    @Query("DELETE FROM search_fts WHERE entityId = :entityId") suspend fun deleteIndex(entityId: String)
    @Query("DELETE FROM projects WHERE id = :id") suspend fun deleteProject(id: String)
    @Query("DELETE FROM tasks WHERE id = :id") suspend fun deleteTask(id: String)
    @Query("DELETE FROM issues WHERE id = :id") suspend fun deleteIssue(id: String)
    @Query("DELETE FROM servers WHERE id = :id") suspend fun deleteServer(id: String)
    @Query("DELETE FROM commands WHERE id = :id") suspend fun deleteCommand(id: String)
    @Query("DELETE FROM knowledge WHERE id = :id") suspend fun deleteKnowledge(id: String)
    @Query("DELETE FROM daily_reports WHERE id = :id") suspend fun deleteReport(id: String)
    @Query("DELETE FROM project_technologies WHERE projectId = :projectId") suspend fun deleteProjectTechnologies(projectId: String)

    @Query("SELECT * FROM search_fts WHERE search_fts MATCH :query LIMIT :limit")
    suspend fun search(query: String, limit: Int): List<SearchFtsEntity>

    @Query("SELECT * FROM activity_logs WHERE occurredAt BETWEEN :start AND :end ORDER BY occurredAt")
    suspend fun activitiesBetween(start: Long, end: Long): List<ActivityLogEntity>

    @Query("SELECT * FROM projects") suspend fun allProjects(): List<ProjectEntity>
    @Query("SELECT * FROM tasks") suspend fun allTasks(): List<TaskEntity>
    @Query("SELECT * FROM issues") suspend fun allIssues(): List<IssueEntity>
    @Query("SELECT * FROM servers") suspend fun allServers(): List<ServerEntity>
    @Query("SELECT * FROM commands") suspend fun allCommands(): List<CommandEntity>
    @Query("SELECT * FROM knowledge") suspend fun allKnowledge(): List<KnowledgeEntity>
    @Query("SELECT * FROM activity_logs") suspend fun allActivities(): List<ActivityLogEntity>
    @Query("SELECT * FROM daily_reports") suspend fun allReports(): List<DailyReportEntity>
    @Query("SELECT * FROM project_technologies") suspend fun allProjectTechnologies(): List<ProjectTechnologyEntity>

    @Query("DELETE FROM projects") suspend fun clearProjects()
    @Query("DELETE FROM tasks") suspend fun clearTasks()
    @Query("DELETE FROM issues") suspend fun clearIssues()
    @Query("DELETE FROM servers") suspend fun clearServers()
    @Query("DELETE FROM commands") suspend fun clearCommands()
    @Query("DELETE FROM knowledge") suspend fun clearKnowledge()
    @Query("DELETE FROM activity_logs") suspend fun clearActivities()
    @Query("DELETE FROM daily_reports") suspend fun clearReports()
    @Query("DELETE FROM project_technologies") suspend fun clearProjectTechnologies()
    @Query("DELETE FROM search_fts") suspend fun clearSearch()
}
