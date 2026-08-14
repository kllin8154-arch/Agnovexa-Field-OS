package com.kllin.agnovexa.fieldos.presentation

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kllin.agnovexa.fieldos.core.backup.BackupManager
import com.kllin.agnovexa.fieldos.core.ai.OpenAiCompatibleClient
import com.kllin.agnovexa.fieldos.core.ai.ProjectPromptBuilder
import com.kllin.agnovexa.fieldos.core.datastore.AppPreferences
import com.kllin.agnovexa.fieldos.core.importer.DeploymentDocumentReader
import com.kllin.agnovexa.fieldos.domain.AiChatMessage
import com.kllin.agnovexa.fieldos.domain.AiProvider
import com.kllin.agnovexa.fieldos.domain.Command
import com.kllin.agnovexa.fieldos.domain.DailyReport
import com.kllin.agnovexa.fieldos.domain.DeploymentContext
import com.kllin.agnovexa.fieldos.domain.DeploymentImportDraft
import com.kllin.agnovexa.fieldos.domain.FieldUseCases
import com.kllin.agnovexa.fieldos.domain.FieldTask
import com.kllin.agnovexa.fieldos.domain.Issue
import com.kllin.agnovexa.fieldos.domain.Knowledge
import com.kllin.agnovexa.fieldos.domain.Project
import com.kllin.agnovexa.fieldos.domain.SearchResult
import com.kllin.agnovexa.fieldos.domain.Server
import com.kllin.agnovexa.fieldos.domain.ThemeMode
import com.kllin.agnovexa.fieldos.domain.UserPreferences
import com.kllin.agnovexa.fieldos.domain.WorkspaceSnapshot
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class FieldOsUiState(
    val workspace: WorkspaceSnapshot = WorkspaceSnapshot(),
    val preferences: UserPreferences = UserPreferences(),
    val busy: Boolean = false,
    val message: String? = null,
    val searchResults: List<SearchResult> = emptyList(),
    val aiMessages: List<AiChatMessage> = emptyList(),
    val aiStreamingText: String = "",
    val aiBusy: Boolean = false,
    val aiConversationProjectId: String? = null,
    val deploymentImportDraft: DeploymentImportDraft? = null,
)

@HiltViewModel
class FieldOsViewModel @Inject constructor(
    private val useCases: FieldUseCases,
    private val preferences: AppPreferences,
    private val backupManager: BackupManager,
    private val aiClient: OpenAiCompatibleClient,
    private val deploymentDocumentReader: DeploymentDocumentReader,
    @param:ApplicationContext private val context: Context,
) : ViewModel() {
    private val transient = MutableStateFlow(FieldOsUiState())

    init {
        viewModelScope.launch { runCatching { useCases.seedBuiltinCommands() } }
    }

    val state: StateFlow<FieldOsUiState> = combine(useCases.workspace, preferences.values, transient) { workspace, prefs, local ->
        local.copy(workspace = workspace, preferences = prefs)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), FieldOsUiState())

    fun clearMessage() = transient.update { it.copy(message = null) }

    fun createProject(name: String, code: String, description: String, location: String) = execute("项目已创建") {
        useCases.createProject(name, code, description, location)
    }

    fun updateProject(value: Project) = execute("项目已更新") { useCases.updateProject(value) }
    fun saveProjectWithTechnologies(value: Project, technologyIds: Set<String>) = execute("项目与技术选型已保存") {
        useCases.saveProjectWithTechnologies(value, technologyIds)
    }
    fun setProjectTechnologies(projectId: String, technologyIds: Set<String>) = execute("项目技术选型已更新") {
        useCases.setProjectTechnologies(projectId, technologyIds)
    }
    fun deleteProject(id: String) = execute("项目已删除") { useCases.deleteProject(id) }

    fun createTask(projectId: String, title: String, description: String, priority: String) = execute("任务已保存") {
        useCases.createTask(projectId, title, description, priority)
    }

    fun updateTask(value: FieldTask) = execute("任务已更新") { useCases.updateTask(value) }
    fun deleteTask(id: String) = execute("任务已删除") { useCases.deleteTask(id) }

    fun createIssue(projectId: String, serverId: String?, title: String, symptom: String, priority: String) = execute("问题已记录") {
        useCases.createIssue(projectId, serverId, title, symptom, priority)
    }

    fun updateIssue(value: Issue) = execute("问题已更新") { useCases.updateIssue(value) }
    fun deleteIssue(id: String) = execute("问题已删除") { useCases.deleteIssue(id) }

    fun resolveIssue(id: String, cause: String, solution: String, verification: String) = execute("问题已解决并写入活动") {
        useCases.resolveIssue(id, cause, solution, verification)
    }

    fun convertIssue(id: String) = execute("问题已转为知识") { useCases.convertIssueToKnowledge(id) }

    fun createServer(projectId: String, name: String, host: String, port: Int, username: String, osType: String) = execute("服务器已添加") {
        useCases.createServer(projectId, name, host, port, username, osType)
    }

    fun updateServer(value: Server) = execute("服务器已更新") { useCases.updateServer(value) }
    fun deleteServer(id: String) = execute("服务器已删除") { useCases.deleteServer(id) }

    fun createCommand(title: String, command: String, description: String, category: String, tags: String) = execute("命令已保存并完成风险识别") {
        useCases.createCommand(title, command, description, category, tags)
    }

    fun updateCommand(value: Command) = execute("命令已更新并重新检查风险") { useCases.updateCommand(value) }
    fun deleteCommand(id: String) = execute("命令已删除") { useCases.deleteCommand(id) }

    fun createKnowledge(projectId: String?, title: String, content: String, tags: String) = execute("知识已保存并建立全文索引") {
        useCases.createKnowledge(projectId, title, content, tags)
    }

    fun updateKnowledge(value: Knowledge) = execute("知识已更新") { useCases.updateKnowledge(value) }
    fun deleteKnowledge(id: String) = execute("知识已删除") { useCases.deleteKnowledge(id) }

    fun saveDailyReport(value: DailyReport) = execute("日报已保存") { useCases.saveDailyReport(value) }
    fun deleteDailyReport(id: String) = execute("日报已删除") { useCases.deleteDailyReport(id) }

    fun generateTodayReport() = execute("今日活动已汇总为日报草稿") {
        val zone = ZoneId.systemDefault()
        val date = LocalDate.now(zone)
        val start = date.atStartOfDay(zone).toInstant().toEpochMilli()
        val end = date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli() - 1
        useCases.generateDailyReport(date.toString(), start, end)
    }

    fun search(query: String) = execute(null) {
        val results = useCases.search(query)
        transient.update { it.copy(searchResults = results) }
    }

    fun setThemeMode(mode: ThemeMode) = execute("主题已切换") { preferences.setThemeMode(mode) }

    fun saveUserName(value: String) = execute("称呼已保存") { preferences.setUserName(value) }

    fun importTheme(uri: Uri) = execute("自定义主题已导入并启用") {
        val json = withContext(Dispatchers.IO) {
            context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                ?: error("无法读取主题文件")
        }
        preferences.importTheme(json)
    }

    fun updateTheme(id: String, json: String) = execute("主题修改已保存") { preferences.updateTheme(id, json) }

    fun selectTheme(id: String) = execute("主题已切换") { preferences.selectTheme(id) }

    fun deleteTheme(id: String) = execute("主题已删除") { preferences.deleteTheme(id) }

    fun saveAiProvider(provider: AiProvider, apiKey: String) = execute("AI Provider 已安全保存") {
        preferences.saveProvider(provider, apiKey)
    }

    fun selectAiProvider(id: String) = execute("默认 AI Provider 已切换") { preferences.selectProvider(id) }

    fun selectAiProject(id: String) {
        if (state.value.workspace.projects.none { it.id == id }) {
            transient.update { it.copy(message = "所选项目不存在，请重新选择") }
            return
        }
        if (transient.value.busy) return
        viewModelScope.launch {
            runCatching { preferences.selectAiProject(id) }
                .onSuccess {
                    transient.update {
                        it.copy(
                            message = "已切换项目，AI 将读取该项目的最新资料",
                            aiMessages = emptyList(),
                            aiStreamingText = "",
                            aiConversationProjectId = id,
                        )
                    }
                }
                .onFailure { error -> transient.update { it.copy(message = error.message ?: "项目切换失败") } }
        }
    }

    fun ensureAiProjectSelected(id: String) {
        if (state.value.preferences.selectedAiProjectId == null && state.value.workspace.projects.any { it.id == id }) {
            viewModelScope.launch { runCatching { preferences.selectAiProject(id) } }
        }
    }

    fun clearAiConversation() = transient.update {
        it.copy(message = "已开始新对话", aiMessages = emptyList(), aiStreamingText = "")
    }

    fun deleteAiProvider(id: String) = execute("AI Provider 已删除") { preferences.deleteProvider(id) }

    fun setTechnologyEnabled(id: String, enabled: Boolean) = execute(null) { preferences.setTechnologyEnabled(id, enabled) }

    fun saveDeploymentContext(value: DeploymentContext) = execute("现场部署信息已保存并会自动提供给 AI") {
        preferences.saveDeploymentContext(value)
    }

    fun clearDeploymentContext() = execute("现场部署信息已清空") { preferences.clearDeploymentContext() }

    fun previewDeploymentDocument(uri: Uri) = execute("部署文档解析完成，请确认后入库") {
        val draft = deploymentDocumentReader.read(uri)
        transient.update { it.copy(deploymentImportDraft = draft) }
    }

    fun clearDeploymentImportDraft() = transient.update { it.copy(deploymentImportDraft = null) }

    fun importDeploymentDocument(projectId: String?, importCommands: Boolean, mergeContext: Boolean) =
        execute("部署文档已入库") {
            val draft = transient.value.deploymentImportDraft ?: error("请先选择部署文档")
            useCases.importDeploymentDocument(draft, projectId, importCommands)
            if (mergeContext && draft.context.completedFields > 0) {
                val merged = state.value.preferences.deploymentContext.fillMissingFrom(draft.context)
                preferences.saveDeploymentContext(merged)
            }
            transient.update { it.copy(deploymentImportDraft = null) }
        }

    fun installDeploymentExample() = execute("脱敏部署示例已载入，可在项目和运维模块查看") {
        useCases.installDeploymentExample()
    }

    fun testAiProvider(provider: AiProvider) = execute("连接测试成功") {
        aiClient.chat(provider, listOf(AiChatMessage("user", "这是连接测试，请只回复 OK。")))
    }

    fun sendAiMessage(prompt: String) {
        if (prompt.isBlank() || transient.value.busy) return
        val prefs = state.value.preferences
        val provider = prefs.aiProviders.firstOrNull { it.id == prefs.selectedAiProviderId }
        if (provider == null) {
            transient.update { it.copy(message = "请先在侧边栏“AI 接口”中配置并选择 Provider") }
            return
        }
        val workspace = state.value.workspace
        val selectedProjectId = prefs.selectedAiProjectId
            ?.takeIf { id -> workspace.projects.any { it.id == id } }
            ?: workspace.projects.firstOrNull()?.id
        if (selectedProjectId == null) {
            transient.update { it.copy(message = "请先创建并选择一个项目，AI 才能读取项目上下文") }
            return
        }
        val userMessage = AiChatMessage("user", prompt.trim())
        val previousMessages = transient.value.aiMessages.takeIf {
            transient.value.aiConversationProjectId == null || transient.value.aiConversationProjectId == selectedProjectId
        }.orEmpty()
        val history = (previousMessages + userMessage).takeLast(12)
        val projectPrompt = ProjectPromptBuilder.systemPrompt(selectedProjectId, workspace)
        viewModelScope.launch {
            transient.update {
                it.copy(
                    busy = true,
                    aiBusy = true,
                    message = null,
                    aiMessages = history,
                    aiStreamingText = "",
                    aiConversationProjectId = selectedProjectId,
                )
            }
            runCatching {
                aiClient.chat(
                    provider = provider,
                    messages = listOf(AiChatMessage("system", projectPrompt)) + history,
                    onDelta = { delta -> transient.update { current -> current.copy(aiStreamingText = current.aiStreamingText + delta) } },
                )
            }.onSuccess { answer ->
                transient.update { it.copy(busy = false, aiBusy = false, aiMessages = history + AiChatMessage("assistant", answer), aiStreamingText = "") }
            }.onFailure { error ->
                transient.update { it.copy(busy = false, aiBusy = false, message = error.message ?: "AI 调用失败", aiStreamingText = "") }
            }
        }
    }

    fun saveAiAsCommand(content: String) = execute("AI 命令已入库，使用前请核对变量和目标环境") {
        val command = Regex("```(?:[A-Za-z0-9_+-]+)?\\s*([\\s\\S]*?)```").find(content)?.groupValues?.get(1)?.trim()
            ?: error("回答中没有可识别的代码块")
        val title = content.lineSequence().firstOrNull { it.isNotBlank() && !it.startsWith("```") }?.removePrefix("#")?.trim()?.take(50)
            ?: "AI 建议命令"
        useCases.createCommand(title, command, "由 AI 生成，执行前必须结合现场环境验证。", "AI 建议", "AI,待验证")
    }

    fun saveAiAsKnowledge(content: String) = execute("AI 回答已存入知识库") {
        val title = content.lineSequence().firstOrNull { it.isNotBlank() }?.removePrefix("#")?.trim()?.take(50) ?: "AI 现场建议"
        useCases.createKnowledge(null, title, content, "AI,待验证")
    }

    fun saveAiAsReport(content: String) = execute("AI 回答已存为日报草稿，可在日报中继续编辑") {
        val now = System.currentTimeMillis()
        val date = LocalDate.now().toString()
        useCases.saveDailyReport(
            DailyReport("", date, null, "$date AI 日报草稿", content, "", "", "", "AI 内容需人工确认", "DRAFT", now, now),
        )
    }

    fun askAiForDailyReport() {
        val today = LocalDate.now().toString()
        val snapshot = state.value
        val projectId = snapshot.preferences.selectedAiProjectId
            ?.takeIf { id -> snapshot.workspace.projects.any { it.id == id } }
            ?: snapshot.workspace.projects.firstOrNull()?.id
        val activities = snapshot.workspace.activities.filter { it.projectId == projectId }.take(20)
            .joinToString("\n") { "- ${it.title}：${it.description}" }
            .ifBlank { "- 暂无自动活动，请生成可填写的日报结构" }
        sendAiMessage(
            "请根据以下本地活动生成 $today 的中文工作日报草稿。必须保留事实，不得虚构完成状态；按今日工作、问题处理、风险、下一步计划分节。\n$activities",
        )
    }

    fun exportBackup(uri: Uri) = execute("本地备份已导出，且不包含密码、API Key 或私钥") { backupManager.export(uri) }

    fun restoreBackup(uri: Uri) = execute("备份恢复完成") { backupManager.restore(uri) }

    private fun execute(successMessage: String?, block: suspend () -> Unit) {
        if (transient.value.busy) return
        viewModelScope.launch {
            transient.update { it.copy(busy = true, message = null) }
            runCatching { block() }
                .onSuccess { transient.update { state -> state.copy(busy = false, message = successMessage) } }
                .onFailure { error -> transient.update { state -> state.copy(busy = false, message = error.message ?: "操作失败") } }
        }
    }
}
