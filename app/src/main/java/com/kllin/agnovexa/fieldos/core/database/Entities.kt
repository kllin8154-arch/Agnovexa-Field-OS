package com.kllin.agnovexa.fieldos.core.database

import androidx.room.Entity
import androidx.room.Fts4
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "projects", indices = [Index("status"), Index("updatedAt")])
data class ProjectEntity(
    @PrimaryKey val id: String,
    val name: String,
    val code: String,
    val description: String,
    val status: String,
    val progress: Int,
    val location: String,
    val createdAt: Long,
    val updatedAt: Long,
)

@Entity(
    tableName = "project_technologies",
    primaryKeys = ["projectId", "technologyId"],
    indices = [Index("projectId"), Index("technologyId")],
)
data class ProjectTechnologyEntity(
    val projectId: String,
    val technologyId: String,
)

@Entity(tableName = "tasks", indices = [Index("projectId"), Index("status"), Index("updatedAt")])
data class TaskEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val title: String,
    val description: String,
    val status: String,
    val priority: String,
    val createdAt: Long,
    val updatedAt: Long,
)

@Entity(tableName = "issues", indices = [Index("projectId"), Index("serverId"), Index("status")])
data class IssueEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val serverId: String?,
    val title: String,
    val symptom: String,
    val cause: String,
    val solution: String,
    val verification: String,
    val status: String,
    val priority: String,
    val createdAt: Long,
    val updatedAt: Long,
)

@Entity(tableName = "servers", indices = [Index("projectId"), Index(value = ["host", "port"], unique = true)])
data class ServerEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val name: String,
    val host: String,
    val port: Int,
    val username: String,
    val osType: String,
    val environment: String,
    val notes: String,
    val createdAt: Long,
    val updatedAt: Long,
)

@Entity(tableName = "commands", indices = [Index("riskLevel"), Index("favorite")])
data class CommandEntity(
    @PrimaryKey val id: String,
    val title: String,
    val command: String,
    val description: String,
    val category: String,
    val riskLevel: String,
    val tags: String,
    val favorite: Boolean,
    val useCount: Int,
    val createdAt: Long,
    val updatedAt: Long,
)

@Entity(tableName = "knowledge", indices = [Index("projectId"), Index("favorite"), Index("updatedAt")])
data class KnowledgeEntity(
    @PrimaryKey val id: String,
    val projectId: String?,
    val title: String,
    val content: String,
    val summary: String,
    val type: String,
    val tags: String,
    val favorite: Boolean,
    val createdAt: Long,
    val updatedAt: Long,
)

@Fts4
@Entity(tableName = "search_fts")
data class SearchFtsEntity(
    val entityId: String,
    val kind: String,
    val title: String,
    val body: String,
    val tags: String,
)

@Entity(tableName = "activity_logs", indices = [Index("projectId"), Index("occurredAt")])
data class ActivityLogEntity(
    @PrimaryKey val id: String,
    val projectId: String?,
    val entityType: String,
    val entityId: String,
    val actionType: String,
    val title: String,
    val description: String,
    val occurredAt: Long,
)

@Entity(tableName = "daily_reports", indices = [Index("dateKey"), Index("projectId")])
data class DailyReportEntity(
    @PrimaryKey val id: String,
    val dateKey: String,
    val projectId: String?,
    val title: String,
    val workContent: String,
    val problems: String,
    val solutions: String,
    val nextPlan: String,
    val risk: String,
    val status: String,
    val createdAt: Long,
    val updatedAt: Long,
)
