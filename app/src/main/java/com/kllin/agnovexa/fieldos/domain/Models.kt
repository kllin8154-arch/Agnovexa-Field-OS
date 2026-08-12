package com.kllin.agnovexa.fieldos.domain

data class Project(
    val id: String,
    val name: String,
    val code: String,
    val description: String,
    val status: String,
    val progress: Int,
    val location: String,
    val createdAt: Long,
    val updatedAt: Long,
)

data class FieldTask(
    val id: String,
    val projectId: String,
    val title: String,
    val description: String,
    val status: String,
    val priority: String,
    val createdAt: Long,
    val updatedAt: Long,
)

data class Issue(
    val id: String,
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

data class Server(
    val id: String,
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

data class Command(
    val id: String,
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

data class Knowledge(
    val id: String,
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

data class Activity(
    val id: String,
    val projectId: String?,
    val entityType: String,
    val entityId: String,
    val actionType: String,
    val title: String,
    val description: String,
    val occurredAt: Long,
)

data class DailyReport(
    val id: String,
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

data class WorkspaceSnapshot(
    val projects: List<Project> = emptyList(),
    val tasks: List<FieldTask> = emptyList(),
    val issues: List<Issue> = emptyList(),
    val servers: List<Server> = emptyList(),
    val commands: List<Command> = emptyList(),
    val knowledge: List<Knowledge> = emptyList(),
    val activities: List<Activity> = emptyList(),
    val reports: List<DailyReport> = emptyList(),
    val projectTechnologyIds: Map<String, Set<String>> = emptyMap(),
)

data class SearchResult(
    val entityId: String,
    val kind: String,
    val title: String,
    val body: String,
)

data class ThemeTokens(
    val name: String,
    val background: Long,
    val surface: Long,
    val surfaceElevated: Long,
    val primary: Long,
    val secondary: Long,
    val success: Long,
    val warning: Long,
    val danger: Long,
    val textPrimary: Long,
    val textSecondary: Long,
    val outline: Long,
)

data class ThemePreset(
    val id: String,
    val tokens: ThemeTokens,
    val sourceJson: String,
    val createdAt: Long,
    val updatedAt: Long,
)

data class AiProvider(
    val id: String,
    val name: String,
    val baseUrl: String,
    val model: String,
    val temperature: Double = 0.3,
    val timeoutSeconds: Int = 60,
    val streamingEnabled: Boolean = true,
    val hasApiKey: Boolean = false,
    val createdAt: Long,
    val updatedAt: Long,
)

data class AiChatMessage(
    val role: String,
    val content: String,
)

data class DeploymentContext(
    val siteName: String = "",
    val deploymentGoal: String = "",
    val architecture: String = "",
    val operatingSystems: String = "",
    val serverTopology: String = "",
    val networkAccess: String = "",
    val baseDirectory: String = "",
    val filesAndServices: String = "",
    val runtimeAndVersions: String = "",
    val dataAndBackup: String = "",
    val constraints: String = "",
    val updatedAt: Long = 0L,
) {
    val completedFields: Int
        get() = listOf(
            deploymentGoal,
            architecture,
            operatingSystems,
            serverTopology,
            networkAccess,
            baseDirectory,
            filesAndServices,
            runtimeAndVersions,
            dataAndBackup,
            constraints,
        ).count { it.isNotBlank() }

    val isEmpty: Boolean
        get() = completedFields == 0 && siteName.isBlank()

    fun fillMissingFrom(other: DeploymentContext): DeploymentContext = copy(
        siteName = siteName.ifBlank { other.siteName },
        deploymentGoal = deploymentGoal.ifBlank { other.deploymentGoal },
        architecture = architecture.ifBlank { other.architecture },
        operatingSystems = operatingSystems.ifBlank { other.operatingSystems },
        serverTopology = serverTopology.ifBlank { other.serverTopology },
        networkAccess = networkAccess.ifBlank { other.networkAccess },
        baseDirectory = baseDirectory.ifBlank { other.baseDirectory },
        filesAndServices = filesAndServices.ifBlank { other.filesAndServices },
        runtimeAndVersions = runtimeAndVersions.ifBlank { other.runtimeAndVersions },
        dataAndBackup = dataAndBackup.ifBlank { other.dataAndBackup },
        constraints = constraints.ifBlank { other.constraints },
    )
}

data class ImportedCommand(
    val title: String,
    val command: String,
    val description: String = "",
    val category: String = "部署导入",
    val tags: String = "AI Agent,部署,待验证",
)

data class DeploymentImportDraft(
    val sourceName: String,
    val title: String,
    val rawContent: String,
    val context: DeploymentContext,
    val commands: List<ImportedCommand>,
    val warnings: List<String> = emptyList(),
)

enum class ThemeMode { SYSTEM, DARK, LIGHT, CUSTOM }

data class UserPreferences(
    val userName: String = "现场工程师",
    val themeMode: ThemeMode = ThemeMode.DARK,
    val customTheme: ThemeTokens? = null,
    val themePresets: List<ThemePreset> = emptyList(),
    val selectedThemeId: String? = null,
    val aiProviders: List<AiProvider> = emptyList(),
    val selectedAiProviderId: String? = null,
    val selectedTechnologyIds: Set<String> = emptySet(),
    val deploymentContext: DeploymentContext = DeploymentContext(),
)
