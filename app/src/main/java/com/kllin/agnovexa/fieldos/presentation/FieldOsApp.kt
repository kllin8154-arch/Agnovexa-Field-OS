package com.kllin.agnovexa.fieldos.presentation

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Android
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Task
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.kllin.agnovexa.fieldos.core.designsystem.AppColors
import com.kllin.agnovexa.fieldos.core.designsystem.AppShapes
import com.kllin.agnovexa.fieldos.core.designsystem.AppSpacing
import com.kllin.agnovexa.fieldos.domain.Command
import com.kllin.agnovexa.fieldos.domain.Issue
import com.kllin.agnovexa.fieldos.domain.ThemeMode
import com.kllin.agnovexa.fieldos.domain.WorkspaceSnapshot
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

private data class NavItem(val route: String, val label: String, val icon: ImageVector)

private val mainNav = listOf(
    NavItem("home", "首页", Icons.Default.Home),
    NavItem("ai", "AI", Icons.Default.SmartToy),
    NavItem("projects", "项目", Icons.Default.Folder),
    NavItem("tools", "运维", Icons.Default.Dashboard),
    NavItem("knowledge", "知识", Icons.Default.Book),
)

@Composable
fun FieldOsApp(state: FieldOsUiState, viewModel: FieldOsViewModel) {
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val snackbar = remember { SnackbarHostState() }
    var showBoot by rememberSaveable { mutableStateOf(true) }
    val currentRoute = backStack?.destination?.route
    val showCommandDock = currentRoute in mainNav.map(NavItem::route) && currentRoute != "ai"
    val density = LocalDensity.current
    val compactNavigation = FieldLayoutPolicy.isCompact(LocalWindowInfo.current.containerSize.width / density.density, density.fontScale)
    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it); viewModel.clearMessage() }
    }
    Box(Modifier.fillMaxSize()) {
        ConceptBackdrop()
        Scaffold(
            containerColor = Color.Transparent,
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = {
                Column {
                    if (showCommandDock) {
                        ConceptCommandDock(enabled = !state.busy) { prompt ->
                            viewModel.sendAiMessage(prompt)
                            navController.navigate("ai") {
                                launchSingleTop = true
                                popUpTo("home") { saveState = false }
                            }
                        }
                    }
                    NavigationBar(containerColor = MaterialTheme.colorScheme.background.copy(alpha = .98f), tonalElevation = 0.dp) {
                        mainNav.forEach { item ->
                            val selected = backStack?.destination?.hierarchy?.any { it.route == item.route } == true
                            NavigationBarItem(
                                selected = selected,
                                alwaysShowLabel = !compactNavigation,
                                onClick = {
                                    if (backStack?.destination?.route != item.route) {
                                        navController.navigate(item.route) {
                                            launchSingleTop = true
                                            popUpTo("home") { saveState = false }
                                            restoreState = false
                                        }
                                    }
                                },
                                icon = { Icon(item.icon, item.label) },
                                label = { Text(item.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                                    selectedTextColor = MaterialTheme.colorScheme.primary,
                                    indicatorColor = MaterialTheme.colorScheme.primary,
                                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                ),
                            )
                        }
                    }
                }
            },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                NavHost(
                    navController = navController,
                    startDestination = "home",
                    enterTransition = { fadeIn(tween(300)) + slideInVertically(tween(330), initialOffsetY = { it / 24 }) },
                    exitTransition = { fadeOut(tween(160)) },
                    popEnterTransition = { fadeIn(tween(240)) },
                    popExitTransition = { fadeOut(tween(140)) },
                ) {
                    composable("home") { ConceptHomeScreen(state, navController::navigate) { showBoot = true } }
                    composable("projects") { CrudModuleScreen("projects", state, viewModel, { navController.popBackStack() }, { navController.navigate("ai") }) }
                    composable("ai") { ConnectedAiScreen(state, viewModel) { navController.navigate("search") } }
                    composable("tools") { ConceptOperationsScreen(state, navController::navigate) }
                    composable("knowledge") { ConceptKnowledgeScreen(state, navController::navigate) }
                    composable("profile") { ProfileSettingsScreen(state, viewModel) }
                    composable("records/{kind}") { entry ->
                        when (val kind = entry.arguments?.getString("kind").orEmpty()) {
                            "commands" -> CommandLibraryScreen(state, viewModel) { navController.popBackStack() }
                            "knowledge" -> KnowledgeLibraryScreen(state, viewModel) { navController.popBackStack() }
                            else -> CrudModuleScreen(kind, state, viewModel, { navController.popBackStack() }, { navController.navigate("ai") })
                        }
                    }
                    composable("search") { SearchScreen(state, viewModel) { navController.popBackStack() } }
                    composable("deployment-import") { DeploymentImportScreen(state, viewModel) { navController.popBackStack() } }
                }
                if (state.busy) {
                    Box(
                        Modifier.fillMaxSize().background(Color.Black.copy(alpha = .48f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
        AnimatedVisibility(
            visible = showBoot,
            enter = fadeIn(tween(180)),
            exit = fadeOut(tween(620)),
        ) {
            AgnovexaBootSequence { showBoot = false }
        }
    }
}

@Composable
private fun HomeScreen(workspace: WorkspaceSnapshot, userName: String, navigate: (String) -> Unit, generateReport: () -> Unit) {
    val openIssues = workspace.issues.count { it.status != "RESOLVED" }
    val openTasks = workspace.tasks.count { it.status != "DONE" && it.status != "CANCELED" }
    LazyColumn(contentPadding = PaddingValues(AppSpacing.md), verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
        item {
            Text("Agnovexa Field OS", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("个人现场工作操作系统", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item {
            AccentCard {
                Text("你好，$userName", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("离线工作区已就绪 · 数据仅保存在本机", color = AppColors.Primary)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
                MetricCard("今日任务", openTasks.toString(), Icons.Default.Task, Modifier.weight(1f))
                MetricCard("待处理问题", openIssues.toString(), Icons.Default.Warning, Modifier.weight(1f))
                MetricCard("离线知识", workspace.knowledge.size.toString(), Icons.Default.Book, Modifier.weight(1f))
            }
        }
        item { SectionTitle("常用模块") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
                Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
                    ModuleButton("项目中心", Icons.Default.Folder, { navigate("projects") }, Modifier.weight(1f))
                    ModuleButton("服务器", Icons.Default.Dns, { navigate("records/servers") }, Modifier.weight(1f))
                    ModuleButton("知识库", Icons.Default.Book, { navigate("records/knowledge") }, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
                    ModuleButton("任务", Icons.Default.Task, { navigate("records/tasks") }, Modifier.weight(1f))
                    ModuleButton("问题", Icons.Default.Error, { navigate("records/issues") }, Modifier.weight(1f))
                    ModuleButton("命令库", Icons.Default.Code, { navigate("records/commands") }, Modifier.weight(1f))
                }
            }
        }
        item { SectionTitle("最近项目") }
        if (workspace.projects.isEmpty()) item { EmptyState("还没有项目", "从项目页创建第一个现场项目") }
        else items(workspace.projects.take(3), key = { it.id }) { project ->
            AccentCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Folder, null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(AppSpacing.sm))
                    Column(Modifier.weight(1f)) {
                        Text(project.name, fontWeight = FontWeight.Bold)
                        Text("${project.location.ifBlank { "未填写地点" }} · ${project.status}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text("${project.progress}%", color = MaterialTheme.colorScheme.primary)
                }
            }
        }
        item { SectionTitle("快捷操作") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
                OutlinedButton({ navigate("records/issues") }, Modifier.weight(1f)) { Text("记录问题") }
                OutlinedButton(generateReport, Modifier.weight(1f)) { Text("生成日报") }
            }
        }
        item { SectionTitle("最近活动") }
        if (workspace.activities.isEmpty()) item { EmptyState("暂无活动", "创建项目或记录现场工作后会自动出现") }
        else items(workspace.activities.take(8), key = { it.id }) { activity ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Box(Modifier.padding(top = 6.dp).size(8.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
                Spacer(Modifier.width(AppSpacing.sm))
                Column {
                    Text(activity.title)
                    Text(activity.description, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun ProjectsScreen(workspace: WorkspaceSnapshot, viewModel: FieldOsViewModel) {
    var showDialog by remember { mutableStateOf(false) }
    Scaffold(
        topBar = { SimpleTopBar("项目中心") },
        floatingActionButton = { FloatingActionButton({ showDialog = true }) { Icon(Icons.Default.Add, "新建项目") } },
    ) { padding ->
        LazyColumn(Modifier.padding(padding), contentPadding = PaddingValues(AppSpacing.md), verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
            if (workspace.projects.isEmpty()) item { EmptyState("还没有项目", "创建项目后即可关联任务、问题和服务器") }
            items(workspace.projects, key = { it.id }) { project ->
                AccentCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Folder, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(38.dp))
                        Spacer(Modifier.width(AppSpacing.md))
                        Column(Modifier.weight(1f)) {
                            Text(project.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text("${project.code.ifBlank { "无项目编码" }} · ${project.location.ifBlank { "未填写地点" }}")
                            Text(project.description.ifBlank { "暂无描述" }, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
                        }
                        Text(project.status, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
    if (showDialog) ProjectDialog(onDismiss = { showDialog = false }) { name, code, desc, location ->
        viewModel.createProject(name, code, desc, location); showDialog = false
    }
}

@Composable
private fun ToolsScreen(state: FieldOsUiState, viewModel: FieldOsViewModel, navigate: (String) -> Unit) {
    val tools = listOf(
        Triple("任务", Icons.Default.Task, "records/tasks"), Triple("现场问题", Icons.Default.Error, "records/issues"),
        Triple("服务器", Icons.Default.Dns, "records/servers"), Triple("命令库", Icons.Default.Code, "records/commands"),
        Triple("知识库", Icons.Default.Book, "records/knowledge"), Triple("日报", Icons.AutoMirrored.Filled.Article, "records/reports"),
        Triple("统一搜索", Icons.Default.Search, "search"), Triple("备份与主题", Icons.Default.Settings, "profile"),
        Triple("导入部署文档", Icons.Default.UploadFile, "deployment-import"),
    )
    LazyColumn(contentPadding = PaddingValues(AppSpacing.md), verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
        item { Text("工具中心", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold); Text("离线工具与工作记录", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item { TechnologyBrandPanel(state) { navigate("projects") } }
        items(tools.chunked(2)) { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                row.forEach { (label, icon, route) -> ModuleButton(label, icon, { navigate(route) }, Modifier.weight(1f)) }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun OfflineAiScreen(openSearch: () -> Unit) {
    LazyColumn(contentPadding = PaddingValues(AppSpacing.md), verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
        item { Text("AI 助手", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold); Text("离线优先", color = MaterialTheme.colorScheme.primary) }
        item {
            AccentCard {
                Icon(Icons.Default.SmartToy, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(42.dp))
                Spacer(Modifier.height(AppSpacing.sm))
                Text("Phase 1 本地助手", style = MaterialTheme.typography.titleLarge)
                Text("当前阶段不连接外部模型。你仍可搜索本地知识和命令、生成日报，并完整使用核心工作流。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(AppSpacing.md))
                Button(openSearch) { Icon(Icons.Default.Search, null); Spacer(Modifier.width(8.dp)); Text("搜索本地工作区") }
            }
        }
        item { EmptyState("AI Provider 尚未启用", "联网模型配置将在 Phase 2 实现，不影响当前离线功能") }
    }
}

@Composable
private fun RecordScreen(kind: String, workspace: WorkspaceSnapshot, viewModel: FieldOsViewModel) {
    var showCreate by remember { mutableStateOf(false) }
    val title = when (kind) { "tasks" -> "任务"; "issues" -> "现场问题"; "servers" -> "服务器"; "commands" -> "命令库"; "knowledge" -> "知识库"; "reports" -> "日报"; else -> "记录" }
    Scaffold(
        topBar = { SimpleTopBar(title) },
        floatingActionButton = {
            if (kind == "reports") FloatingActionButton(viewModel::generateTodayReport) { Icon(Icons.Default.Add, "生成日报") }
            else FloatingActionButton({ showCreate = true }) { Icon(Icons.Default.Add, "新建$title") }
        },
    ) { padding ->
        LazyColumn(Modifier.padding(padding), contentPadding = PaddingValues(AppSpacing.md), verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
            val empty = when (kind) { "tasks" -> workspace.tasks.isEmpty(); "issues" -> workspace.issues.isEmpty(); "servers" -> workspace.servers.isEmpty(); "commands" -> workspace.commands.isEmpty(); "knowledge" -> workspace.knowledge.isEmpty(); "reports" -> workspace.reports.isEmpty(); else -> true }
            if (empty) item { EmptyState("暂无$title", if (workspace.projects.isEmpty() && kind in listOf("tasks", "issues", "servers")) "请先创建项目" else "点击右下角开始记录") }
            when (kind) {
                "tasks" -> items(workspace.tasks, key = { it.id }) { RecordCard(it.title, "${it.priority} · ${it.status}", it.description, Icons.Default.Task) }
                "issues" -> items(workspace.issues, key = { it.id }) { IssueCard(it, viewModel) }
                "servers" -> items(workspace.servers, key = { it.id }) { RecordCard(it.name, "${it.username}@${it.host}:${it.port}", "${it.osType} · ${it.environment}", Icons.Default.Dns) }
                "commands" -> items(workspace.commands, key = { it.id }) { CommandCard(it) }
                "knowledge" -> items(workspace.knowledge, key = { it.id }) { RecordCard(it.title, it.tags.ifBlank { it.type }, it.content, Icons.Default.Book) }
                "reports" -> items(workspace.reports, key = { it.id }) { report ->
                    AccentCard { Text(report.title, fontWeight = FontWeight.Bold); Text("${report.status} · ${report.dateKey}", color = MaterialTheme.colorScheme.primary); Text(report.workContent, maxLines = 5, overflow = TextOverflow.Ellipsis) }
                }
            }
        }
    }
    if (showCreate) when (kind) {
        "tasks" -> TaskDialog(workspace, { showCreate = false }) { project, titleValue, desc, priority -> viewModel.createTask(project, titleValue, desc, priority); showCreate = false }
        "issues" -> IssueDialog(workspace, { showCreate = false }) { project, titleValue, symptom, priority -> viewModel.createIssue(project, null, titleValue, symptom, priority); showCreate = false }
        "servers" -> ServerDialog(workspace, { showCreate = false }) { project, name, host, port, user, os -> viewModel.createServer(project, name, host, port, user, os); showCreate = false }
        "commands" -> CommandDialog({ showCreate = false }) { titleValue, command, desc, category, tags -> viewModel.createCommand(titleValue, command, desc, category, tags); showCreate = false }
        "knowledge" -> KnowledgeDialog(workspace, { showCreate = false }) { project, titleValue, content, tags -> viewModel.createKnowledge(project, titleValue, content, tags); showCreate = false }
    }
}

@Composable
private fun SearchScreen(state: FieldOsUiState, viewModel: FieldOsViewModel, onBack: () -> Unit) {
    var query by remember { mutableStateOf("") }
    LazyColumn(contentPadding = PaddingValues(AppSpacing.md), verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
        item { Row(verticalAlignment = Alignment.CenterVertically) { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") }; Text("统一搜索", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold) } }
        item {
            OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), label = { Text("搜索命令和知识") }, trailingIcon = { IconButton({ viewModel.search(query) }) { Icon(Icons.Default.Search, "搜索") } }, singleLine = true)
        }
        if (query.isNotBlank() && state.searchResults.isEmpty()) item { EmptyState("没有匹配结果", "尝试更短的关键词") }
        items(state.searchResults, key = { it.entityId }) { result -> RecordCard(result.title, result.kind, result.body, if (result.kind == "COMMAND") Icons.Default.Code else Icons.Default.Book) }
    }
}

@Composable
private fun SettingsScreen(state: FieldOsUiState, viewModel: FieldOsViewModel) {
    var name by remember(state.preferences.userName) { mutableStateOf(state.preferences.userName) }
    val themeImport = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { it?.let(viewModel::importTheme) }
    val backupExport = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { it?.let(viewModel::exportBackup) }
    val backupRestore = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { it?.let(viewModel::restoreBackup) }
    LazyColumn(contentPadding = PaddingValues(AppSpacing.md), verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
        item { Text("我的", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold); Text("个人偏好与本地数据", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item {
            AccentCard {
                SectionTitle("个人称呼")
                OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), singleLine = true)
                Spacer(Modifier.height(AppSpacing.xs))
                Button({ viewModel.saveUserName(name) }) { Text("保存称呼") }
            }
        }
        item {
            AccentCard {
                SectionTitle("外观主题")
                Text("当前：${state.preferences.customTheme?.name ?: state.preferences.themeMode.name}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(AppSpacing.xs))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(ThemeMode.SYSTEM to "跟随", ThemeMode.DARK to "深色", ThemeMode.LIGHT to "浅色").forEach { (mode, label) ->
                        OutlinedButton({ viewModel.setThemeMode(mode) }, contentPadding = PaddingValues(horizontal = 12.dp)) { Text(label) }
                    }
                }
                Spacer(Modifier.height(AppSpacing.xs))
                Button({ themeImport.launch(arrayOf("application/json", "text/plain")) }) { Icon(Icons.Default.Palette, null); Spacer(Modifier.width(8.dp)); Text("上传主题 JSON") }
                Text("导入失败会保留当前主题；主题文件只在本机读取。", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        item {
            AccentCard {
                SectionTitle("备份与恢复")
                Text("备份默认排除密码、API Key 和私钥。恢复前会先校验格式。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(AppSpacing.sm))
                Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
                    Button({ backupExport.launch("AgnovexaBackup_${LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmm"))}.zip") }, Modifier.weight(1f)) { Icon(Icons.Default.Backup, null); Text("导出") }
                    OutlinedButton({ backupRestore.launch(arrayOf("application/zip", "application/octet-stream")) }, Modifier.weight(1f)) { Icon(Icons.Default.Restore, null); Text("恢复") }
                }
            }
        }
        item { Text("Agnovexa Field OS · Phase 1", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun IssueCard(issue: Issue, viewModel: FieldOsViewModel) {
    var resolve by remember { mutableStateOf(false) }
    AccentCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(if (issue.status == "RESOLVED") Icons.Default.CheckCircle else Icons.Default.Error, null, tint = if (issue.status == "RESOLVED") AppColors.Success else AppColors.Warning)
            Spacer(Modifier.width(AppSpacing.sm))
            Column(Modifier.weight(1f)) { Text(issue.title, fontWeight = FontWeight.Bold); Text("${issue.priority} · ${issue.status}", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        Text(issue.symptom)
        Row {
            if (issue.status != "RESOLVED") TextButton({ resolve = true }) { Text("填写解决方案") }
            TextButton({ viewModel.convertIssue(issue.id) }) { Text("转为知识") }
        }
    }
    if (resolve) ResolveIssueDialog({ resolve = false }) { cause, solution, verification -> viewModel.resolveIssue(issue.id, cause, solution, verification); resolve = false }
}

@Composable
private fun CommandCard(command: Command) {
    val clipboard = LocalClipboardManager.current
    var confirm by remember { mutableStateOf(false) }
    val riskColor = when (command.riskLevel) { "DANGEROUS" -> AppColors.Danger; "CAUTION" -> AppColors.Warning; else -> AppColors.Success }
    AccentCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Code, null, tint = riskColor)
            Spacer(Modifier.width(AppSpacing.sm))
            Column(Modifier.weight(1f)) { Text(command.title, fontWeight = FontWeight.Bold); Text(command.riskLevel, color = riskColor) }
        }
        Text(command.command, color = MaterialTheme.colorScheme.primary)
        Text(command.description, color = MaterialTheme.colorScheme.onSurfaceVariant)
        TextButton({ if (command.riskLevel == "DANGEROUS") confirm = true else clipboard.setText(AnnotatedString(command.command)) }) { Text("复制命令") }
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false },
        icon = { Icon(Icons.Default.Warning, null, tint = AppColors.Danger) },
        title = { Text("危险命令") },
        text = { Text("该命令可能造成服务中断或数据丢失。仅在确认目标和回退方案后使用。") },
        confirmButton = { Button({ clipboard.setText(AnnotatedString(command.command)); confirm = false }) { Text("确认复制") } },
        dismissButton = { TextButton({ confirm = false }) { Text("取消") } },
    )
}

@Composable
private fun RecordCard(title: String, meta: String, body: String, icon: ImageVector) {
    AccentCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(AppSpacing.sm))
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Bold)
                Text(meta, color = MaterialTheme.colorScheme.primary)
            }
        }
        if (body.isNotBlank()) Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 4, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun AccentCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = AppShapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = Modifier.fillMaxWidth(),
    ) { Column(Modifier.padding(AppSpacing.md), verticalArrangement = Arrangement.spacedBy(AppSpacing.xs), content = content) }
}

@Composable
private fun MetricCard(label: String, value: String, icon: ImageVector, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Column(Modifier.padding(12.dp)) { Icon(icon, null, tint = MaterialTheme.colorScheme.primary); Text(value, style = MaterialTheme.typography.headlineMedium); Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun ModuleButton(label: String, icon: ImageVector, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(modifier.height(100.dp).clickable(onClick = onClick), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(32.dp)); Spacer(Modifier.height(8.dp)); Text(label) }
    }
}

@Composable private fun SectionTitle(value: String) = Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

@Composable
private fun EmptyState(title: String, description: String) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.Android, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(8.dp))
        Text(title, fontWeight = FontWeight.Bold)
        Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SimpleTopBar(title: String) = TopAppBar(title = { Text(title, fontWeight = FontWeight.Bold) }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background))

@Composable
private fun ProjectDialog(onDismiss: () -> Unit, save: (String, String, String, String) -> Unit) {
    var name by remember { mutableStateOf("") }; var code by remember { mutableStateOf("") }; var desc by remember { mutableStateOf("") }; var location by remember { mutableStateOf("") }
    FormDialog("新建项目", onDismiss, name.isNotBlank(), { save(name, code, desc, location) }) {
        Field(name, { name = it }, "项目名称*"); Field(code, { code = it }, "项目编码"); Field(location, { location = it }, "现场地点"); Field(desc, { desc = it }, "项目描述", false)
    }
}

@Composable
private fun TaskDialog(workspace: WorkspaceSnapshot, onDismiss: () -> Unit, save: (String, String, String, String) -> Unit) {
    var title by remember { mutableStateOf("") }; var desc by remember { mutableStateOf("") }; var priority by remember { mutableStateOf("P2") }; val project = workspace.projects.firstOrNull()
    FormDialog("新建任务", onDismiss, project != null && title.isNotBlank(), { save(project!!.id, title, desc, priority) }) {
        ProjectHint(project?.name); Field(title, { title = it }, "任务标题*"); Field(desc, { desc = it }, "任务描述", false); Field(priority, { priority = it }, "优先级 P0-P3")
    }
}

@Composable
private fun IssueDialog(workspace: WorkspaceSnapshot, onDismiss: () -> Unit, save: (String, String, String, String) -> Unit) {
    var title by remember { mutableStateOf("") }; var symptom by remember { mutableStateOf("") }; var priority by remember { mutableStateOf("P1") }; val project = workspace.projects.firstOrNull()
    FormDialog("记录现场问题", onDismiss, project != null && title.isNotBlank(), { save(project!!.id, title, symptom, priority) }) {
        ProjectHint(project?.name); Field(title, { title = it }, "问题标题*"); Field(symptom, { symptom = it }, "现象/报错", false); Field(priority, { priority = it }, "优先级 P0-P3")
    }
}

@Composable
private fun ResolveIssueDialog(onDismiss: () -> Unit, save: (String, String, String) -> Unit) {
    var cause by remember { mutableStateOf("") }; var solution by remember { mutableStateOf("") }; var verification by remember { mutableStateOf("") }
    FormDialog("解决问题", onDismiss, solution.isNotBlank(), { save(cause, solution, verification) }) { Field(cause, { cause = it }, "根因", false); Field(solution, { solution = it }, "解决方案*", false); Field(verification, { verification = it }, "验证结果", false) }
}

@Composable
private fun ServerDialog(workspace: WorkspaceSnapshot, onDismiss: () -> Unit, save: (String, String, String, Int, String, String) -> Unit) {
    var name by remember { mutableStateOf("") }; var host by remember { mutableStateOf("") }; var port by remember { mutableStateOf("22") }; var user by remember { mutableStateOf("") }; var os by remember { mutableStateOf("Linux") }; val project = workspace.projects.firstOrNull()
    FormDialog("添加服务器", onDismiss, project != null && name.isNotBlank() && host.isNotBlank() && port.toIntOrNull() != null, { save(project!!.id, name, host, port.toInt(), user, os) }) {
        ProjectHint(project?.name); Field(name, { name = it }, "服务器名称*"); Field(host, { host = it }, "主机/IP*"); Field(port, { port = it }, "端口"); Field(user, { user = it }, "用户名"); Field(os, { os = it }, "操作系统")
    }
}

@Composable
private fun CommandDialog(onDismiss: () -> Unit, save: (String, String, String, String, String) -> Unit) {
    var title by remember { mutableStateOf("") }; var command by remember { mutableStateOf("") }; var desc by remember { mutableStateOf("") }; var category by remember { mutableStateOf("通用") }; var tags by remember { mutableStateOf("") }
    FormDialog("保存命令", onDismiss, title.isNotBlank() && command.isNotBlank(), { save(title, command, desc, category, tags) }) { Field(title, { title = it }, "标题*"); Field(command, { command = it }, "命令内容*", false); Field(desc, { desc = it }, "说明", false); Field(category, { category = it }, "分类"); Field(tags, { tags = it }, "标签，逗号分隔") }
}

@Composable
private fun KnowledgeDialog(workspace: WorkspaceSnapshot, onDismiss: () -> Unit, save: (String?, String, String, String) -> Unit) {
    var title by remember { mutableStateOf("") }; var content by remember { mutableStateOf("") }; var tags by remember { mutableStateOf("") }; val project = workspace.projects.firstOrNull()
    FormDialog("新增知识", onDismiss, title.isNotBlank() && content.isNotBlank(), { save(project?.id, title, content, tags) }) { ProjectHint(project?.name); Field(title, { title = it }, "标题*"); Field(content, { content = it }, "Markdown / 纯文本正文*", false); Field(tags, { tags = it }, "标签，逗号分隔") }
}

@Composable
private fun FormDialog(title: String, onDismiss: () -> Unit, valid: Boolean, onSave: () -> Unit, fields: @Composable ColumnScope.() -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp), content = fields) },
        confirmButton = { Button(onSave, enabled = valid) { Text("保存") } },
        dismissButton = { TextButton(onDismiss) { Text("取消") } },
    )
}

@Composable
private fun Field(value: String, onChange: (String) -> Unit, label: String, singleLine: Boolean = true) = OutlinedTextField(value, onChange, Modifier.fillMaxWidth(), label = { Text(label) }, singleLine = singleLine, maxLines = if (singleLine) 1 else 5)

@Composable
private fun ProjectHint(name: String?) = Text(if (name == null) "请先创建项目" else "关联最近项目：$name", color = if (name == null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
