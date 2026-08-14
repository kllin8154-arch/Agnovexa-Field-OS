package com.kllin.agnovexa.fieldos.presentation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kllin.agnovexa.fieldos.R
import com.kllin.agnovexa.fieldos.domain.Command
import com.kllin.agnovexa.fieldos.domain.DailyReport
import com.kllin.agnovexa.fieldos.domain.FieldTask
import com.kllin.agnovexa.fieldos.domain.Issue
import com.kllin.agnovexa.fieldos.domain.Knowledge
import com.kllin.agnovexa.fieldos.domain.Project
import com.kllin.agnovexa.fieldos.domain.ProjectTechnologyDefaults
import com.kllin.agnovexa.fieldos.domain.Server
import com.kllin.agnovexa.fieldos.domain.TechnologyCatalog
import com.kllin.agnovexa.fieldos.domain.WorkspaceSnapshot
import java.time.LocalDate

@Composable
fun CrudModuleScreen(
    kind: String,
    state: FieldOsUiState,
    viewModel: FieldOsViewModel,
    onBack: () -> Unit,
    onOpenAi: () -> Unit,
    onOpenNavigation: (() -> Unit)? = null,
) {
    val workspace = state.workspace
    var editing by remember(kind) { mutableStateOf<Any?>(null) }
    var showEditor by remember(kind) { mutableStateOf(false) }
    var deleting by remember(kind) { mutableStateOf<Pair<String, String>?>(null) }
    var query by remember(kind) { mutableStateOf("") }
    val clipboard = LocalClipboardManager.current
    val title = moduleTitle(kind)
    fun match(vararg values: String) = query.isBlank() || values.any { it.contains(query.trim(), ignoreCase = true) }
    val projects = workspace.projects.filter { match(it.name, it.code, it.location, it.description, it.status) }
    val tasks = workspace.tasks.filter { match(it.title, it.description, it.priority, it.status) }
    val issues = workspace.issues.filter { match(it.title, it.symptom, it.cause, it.solution, it.priority, it.status) }
    val servers = workspace.servers.filter { match(it.name, it.host, it.username, it.osType, it.environment, it.notes) }
    val commands = workspace.commands.filter { match(it.title, it.command, it.description, it.category, it.tags) }
    val knowledge = workspace.knowledge.filter { match(it.title, it.content, it.summary, it.type, it.tags) }
    val reports = workspace.reports.filter { match(it.title, it.workContent, it.problems, it.solutions, it.nextPlan, it.risk, it.status) }
    val visibleCount = when (kind) {
        "projects" -> projects.size; "tasks" -> tasks.size; "issues" -> issues.size; "servers" -> servers.size
        "commands" -> commands.size; "knowledge" -> knowledge.size; "reports" -> reports.size; else -> 0
    }
    Scaffold(
        topBar = { ModuleTopBar(title, onBack, if (kind == "reports") onOpenAi else null, onOpenNavigation) },
        floatingActionButton = {
            FloatingActionButton({ editing = null; showEditor = true }) { Icon(Icons.Default.Add, "新增$title") }
        },
    ) { padding ->
        LazyColumn(
            Modifier.padding(padding),
            contentPadding = PaddingValues(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item { ModuleOverviewCard(kind, workspace) }
            if (itemCount(kind, workspace) > 0) {
                item {
                    OutlinedTextField(
                        query, { query = it }, Modifier.fillMaxWidth(),
                        label = { Text("搜索$title") },
                        leadingIcon = { Icon(Icons.Default.Search, null) },
                        trailingIcon = { if (query.isNotBlank()) IconButton({ query = "" }) { Icon(Icons.Default.Clear, "清空") } },
                        singleLine = true,
                    )
                }
            }
            if (itemCount(kind, workspace) == 0) {
                item { ContextEmptyState(moduleIcon(kind), "暂无$title", emptyHint(kind)) }
            } else if (visibleCount == 0) {
                item { ContextEmptyState(Icons.Default.Search, "没有匹配结果", "换一个关键词再试试") }
            }
            when (kind) {
                "projects" -> items(projects, key = { it.id }) { value ->
                    val technologies = TechnologyCatalog.names(workspace.projectTechnologyIds[value.id].orEmpty()).joinToString(" · ")
                    ProjectWorkspaceCard(
                        project = value,
                        technologies = technologies,
                        onEdit = { editing = value; showEditor = true },
                        onDelete = { deleting = value.id to value.name },
                    )
                }
                "tasks" -> items(tasks, key = { it.id }) { value ->
                    CrudCard(value.title, "${value.priority} · ${value.status}", value.description, Icons.Default.TaskAlt, { editing = value; showEditor = true }, { deleting = value.id to value.title })
                }
                "issues" -> items(issues, key = { it.id }) { value ->
                    CrudCard(value.title, "${value.priority} · ${value.status}", value.symptom, Icons.Default.ErrorOutline, { editing = value; showEditor = true }, { deleting = value.id to value.title }, "转为知识") { viewModel.convertIssue(value.id) }
                }
                "servers" -> items(servers, key = { it.id }) { value ->
                    CrudCard(value.name, "${value.osType} · ${value.host}:${value.port}", value.notes, Icons.Default.Dns, { editing = value; showEditor = true }, { deleting = value.id to value.name })
                }
                "commands" -> items(commands, key = { it.id }) { value ->
                    CrudCard(value.title, "${value.category} · ${value.riskLevel}", value.command, Icons.Default.Terminal, { editing = value; showEditor = true }, { deleting = value.id to value.title }, "复制") { clipboard.setText(AnnotatedString(value.command)) }
                }
                "knowledge" -> items(knowledge, key = { it.id }) { value ->
                    CrudCard(value.title, value.tags.ifBlank { value.type }, value.content, Icons.Default.Book, { editing = value; showEditor = true }, { deleting = value.id to value.title }, "复制") { clipboard.setText(AnnotatedString(value.content)) }
                }
                "reports" -> items(reports, key = { it.id }) { value ->
                    CrudCard(value.title, "${value.dateKey} · ${value.status}", value.workContent, Icons.AutoMirrored.Filled.Article, { editing = value; showEditor = true }, { deleting = value.id to value.title }, "一键复制") { clipboard.setText(AnnotatedString(reportText(value))) }
                }
            }
        }
    }
    if (showEditor) {
        UnifiedEditor(kind, editing, workspace, state.preferences.selectedTechnologyIds, { showEditor = false }) { value, technologyIds ->
            saveItem(kind, value, technologyIds, viewModel)
            showEditor = false
        }
    }
    deleting?.let { (id, name) ->
        DeleteDialog("$title“$name”", { deleting = null }) {
            deleteItem(kind, id, viewModel)
            deleting = null
        }
    }
}

@Composable
private fun ProjectWorkspaceCard(
    project: Project,
    technologies: String,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val coverIndex = (project.id.hashCode() and Int.MAX_VALUE) % 6
    val cover = when (coverIndex) {
        0 -> R.drawable.project_cover_mountain
        1 -> R.drawable.project_cover_crystal
        2 -> R.drawable.project_cover_geology_map
        3 -> R.drawable.project_cover_core_tray
        4 -> R.drawable.project_cover_ore_body
        else -> R.drawable.project_cover_remote_sensing
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .75f)),
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
    ) {
        Column {
            Box(Modifier.fillMaxWidth().height(132.dp)) {
                Image(
                    painter = painterResource(cover),
                    contentDescription = "${project.name} 项目背景",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, MaterialTheme.colorScheme.surface.copy(alpha = .94f)),
                            ),
                        ),
                )
                LazyRow(
                    Modifier.align(Alignment.TopStart).fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    item { ProjectBadge(project.code.ifBlank { "FIELD" }) }
                    item { ProjectBadge(project.status) }
                }
                Text(
                    project.name,
                    modifier = Modifier.align(Alignment.BottomStart).padding(horizontal = 16.dp, vertical = 12.dp),
                    fontWeight = FontWeight.Bold,
                    fontSize = 21.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text(
                    project.location.ifBlank { "未填写项目地点" },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 11.sp,
                )
                if (project.description.isNotBlank()) {
                    Text(project.description, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
                }
                if (technologies.isNotBlank()) {
                    Text(technologies, color = MaterialTheme.colorScheme.secondary, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    LinearProgressIndicator(
                        progress = { project.progress.coerceIn(0, 100) / 100f },
                        modifier = Modifier.weight(1f).height(5.dp).clip(RoundedCornerShape(99.dp)),
                        color = MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.outline.copy(alpha = .5f),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text("${project.progress.coerceIn(0, 100)}%", fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Spacer(Modifier.weight(1f))
                    TextButton(onEdit) {
                        Icon(Icons.Default.Edit, null, Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("编辑")
                    }
                    IconButton(onDelete) { Icon(Icons.Default.Delete, "删除") }
                }
            }
        }
    }
}

@Composable
private fun ProjectBadge(label: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Color.Black.copy(alpha = .55f))
            .padding(horizontal = 9.dp, vertical = 5.dp),
    ) {
        Text(label, color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ModuleTopBar(title: String, onBack: () -> Unit, onAi: (() -> Unit)?, onOpenNavigation: (() -> Unit)?) = TopAppBar(
    title = { Text(title, fontWeight = FontWeight.Bold, maxLines = 1) },
    navigationIcon = {
        if (onOpenNavigation != null) IconButton(onOpenNavigation) { Icon(Icons.Default.Menu, "打开功能栏") }
        else IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回上一模块") }
    },
    actions = { if (onAi != null) IconButton(onAi) { Icon(Icons.Default.AutoAwesome, "使用 AI 生成") } },
    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
)

@Composable
private fun CrudCard(
    title: String,
    meta: String,
    body: String,
    icon: ImageVector,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    secondaryLabel: String? = null,
    onSecondary: (() -> Unit)? = null,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .75f)),
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)).background(MaterialTheme.colorScheme.primary.copy(alpha = .13f)), contentAlignment = Alignment.Center) {
                    Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(23.dp))
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(meta, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            if (body.isNotBlank()) Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 4, overflow = TextOverflow.Ellipsis)
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    if (secondaryLabel != null && onSecondary != null) {
                        TextButton(onSecondary) {
                            if (secondaryLabel.contains("复制")) Icon(Icons.Default.ContentCopy, null, Modifier.size(16.dp))
                            Text(secondaryLabel, maxLines = 1)
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    if (compact) {
                        IconButton(onEdit) { Icon(Icons.Default.Edit, "编辑") }
                    } else {
                        TextButton(onEdit) { Icon(Icons.Default.Edit, null, Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text("编辑") }
                    }
                    IconButton(onDelete) { Icon(Icons.Default.Delete, "删除") }
                }
            }
        }
    }
}

@Composable
private fun ModuleOverviewCard(kind: String, workspace: WorkspaceSnapshot) {
    val total = itemCount(kind, workspace)
    val detail = when (kind) {
        "projects" -> "${workspace.projects.count { it.status == "ACTIVE" }} 个进行中 · ${workspace.projectTechnologyIds.values.flatten().distinct().size} 种技术"
        "tasks" -> "${workspace.tasks.count { it.status != "DONE" && it.status != "CANCELED" }} 个待完成"
        "issues" -> "${workspace.issues.count { it.status != "RESOLVED" }} 个待处理"
        "servers" -> "关联 ${workspace.servers.map { it.projectId }.distinct().size} 个项目"
        "reports" -> "${workspace.reports.count { it.status == "DRAFT" }} 份草稿"
        else -> "本机离线保存"
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = .08f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .28f)),
        shape = RoundedCornerShape(14.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.primary.copy(alpha = .15f)), contentAlignment = Alignment.Center) {
                Icon(moduleIcon(kind), null, tint = MaterialTheme.colorScheme.primary)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("$total 条${moduleTitle(kind)}记录", fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun ContextEmptyState(icon: ImageVector, title: String, hint: String) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 70.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary.copy(alpha = .72f), modifier = Modifier.size(58.dp))
        Spacer(Modifier.height(12.dp))
        Text(title, fontWeight = FontWeight.Bold)
        Text(hint, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
private fun UnifiedEditor(
    kind: String,
    existing: Any?,
    workspace: WorkspaceSnapshot,
    legacyTechnologyIds: Set<String>,
    close: () -> Unit,
    save: (Any, Set<String>?) -> Unit,
) {
    val initial = remember(kind, existing) { formValues(kind, existing) }
    var a by remember(initial) { mutableStateOf(initial[0]) }
    var b by remember(initial) { mutableStateOf(initial[1]) }
    var c by remember(initial) { mutableStateOf(initial[2]) }
    var d by remember(initial) { mutableStateOf(initial[3]) }
    var e by remember(initial) { mutableStateOf(initial[4]) }
    var f by remember(initial) { mutableStateOf(initial[5]) }
    var g by remember(initial) { mutableStateOf(initial[6]) }
    var h by remember(initial) { mutableStateOf(initial[7]) }
    var projectId by remember(kind, existing) { mutableStateOf(linkedProjectId(existing) ?: workspace.projects.firstOrNull()?.id) }
    var projectMenuExpanded by remember { mutableStateOf(false) }
    val historyProject = remember(workspace.projects, workspace.projectTechnologyIds) {
        workspace.projects.firstOrNull { workspace.projectTechnologyIds[it.id].orEmpty().isNotEmpty() }
    }
    val initialTechnologyIds = remember(kind, existing, workspace.projects, workspace.projectTechnologyIds, legacyTechnologyIds) {
        if (kind != "projects") emptySet() else ProjectTechnologyDefaults.resolve(
            editingProjectId = (existing as? Project)?.id,
            projects = workspace.projects,
            selections = workspace.projectTechnologyIds,
            legacySelection = legacyTechnologyIds,
        )
    }
    var technologyIds by remember(initialTechnologyIds) { mutableStateOf(initialTechnologyIds) }
    val valid = when (kind) {
        "projects" -> a.isNotBlank()
        "commands", "knowledge" -> a.isNotBlank() && b.isNotBlank()
        "reports" -> b.isNotBlank()
        "servers" -> a.isNotBlank() && b.isNotBlank() && !projectId.isNullOrBlank()
        else -> a.isNotBlank() && !projectId.isNullOrBlank()
    }
    AlertDialog(
        onDismissRequest = close,
        title = { Text(if (existing == null) "新增${moduleTitle(kind)}" else "编辑${moduleTitle(kind)}") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (kind in setOf("tasks", "issues", "servers", "knowledge")) {
                    item {
                        Box {
                            OutlinedButton({ projectMenuExpanded = true }, Modifier.fillMaxWidth(), enabled = workspace.projects.isNotEmpty()) {
                                Text("关联项目：${workspace.projects.firstOrNull { it.id == projectId }?.name ?: "请先创建项目"}", modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            DropdownMenu(projectMenuExpanded, { projectMenuExpanded = false }) {
                                workspace.projects.forEach { project ->
                                    DropdownMenuItem(text = { Text(project.name) }, onClick = { projectId = project.id; projectMenuExpanded = false })
                                }
                            }
                        }
                    }
                }
                when (kind) {
                    "projects" -> {
                        item { FormField(a, { a = it }, "项目名称*") }; item { FormField(b, { b = it }, "项目编码") }
                        item { FormField(c, { c = it }, "地点") }; item { FormField(d, { d = it }, "状态 ACTIVE/PAUSED/COMPLETED") }
                        item { FormField(e, { e = it }, "进度 0-100") }; item { FormField(f, { f = it }, "描述", false) }
                        if (existing == null && historyProject != null) {
                            item {
                                Text(
                                    "已沿用最近项目“${historyProject.name}”的 ${initialTechnologyIds.size} 项技术选型，可在下方增删。",
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                        item {
                            TechnologySelectionEditor(
                                selected = technologyIds,
                                knownTechnologyIds = workspace.projectTechnologyIds.values.flatten().toSet(),
                                onChange = { technologyIds = it },
                            )
                        }
                    }
                    "tasks" -> {
                        item { FormField(a, { a = it }, "标题*") }; item { FormField(b, { b = it }, "描述", false) }
                        item { FormField(c, { c = it }, "优先级 P0-P3") }; item { FormField(d, { d = it }, "状态 TODO/DOING/BLOCKED/DONE") }
                    }
                    "issues" -> {
                        item { FormField(a, { a = it }, "标题*") }; item { FormField(b, { b = it }, "现象/报错", false) }
                        item { FormField(c, { c = it }, "优先级 P0-P3") }; item { FormField(d, { d = it }, "状态 OPEN/RESOLVED") }
                        item { FormField(e, { e = it }, "原因", false) }; item { FormField(f, { f = it }, "解决方案", false) }
                        item { FormField(g, { g = it }, "验证结果", false) }
                    }
                    "servers" -> {
                        item { FormField(a, { a = it }, "名称*") }; item { FormField(b, { b = it }, "主机/IP*") }
                        item { FormField(c, { c = it }, "端口") }; item { FormField(d, { d = it }, "用户名") }
                        item { FormField(e, { e = it }, "操作系统") }; item { FormField(f, { f = it }, "备注", false) }
                        item { FormField(g, { g = it }, "环境，如：生产/测试/现场") }
                    }
                    "commands" -> {
                        item { FormField(a, { a = it }, "标题*") }; item { FormField(b, { b = it }, "命令内容*", false) }
                        item { FormField(c, { c = it }, "说明", false) }; item { FormField(d, { d = it }, "分类") }
                        item { FormField(e, { e = it }, "标签") }
                    }
                    "knowledge" -> {
                        item { FormField(a, { a = it }, "标题*") }; item { FormField(b, { b = it }, "正文*", false) }
                        item { FormField(c, { c = it }, "标签") }
                    }
                    "reports" -> {
                        item { FormField(a, { a = it }, "日期 YYYY-MM-DD") }; item { FormField(b, { b = it }, "标题*") }
                        item { FormField(c, { c = it }, "今日工作", false) }; item { FormField(d, { d = it }, "问题", false) }
                        item { FormField(e, { e = it }, "解决方案", false) }; item { FormField(f, { f = it }, "风险", false) }
                        item { FormField(g, { g = it }, "下一步", false) }; item { FormField(h, { h = it }, "状态 DRAFT/COMPLETED") }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { save(buildItem(kind, existing, projectId, listOf(a, b, c, d, e, f, g, h)), technologyIds.takeIf { kind == "projects" }) },
                enabled = valid,
            ) { Text("保存") }
        },
        dismissButton = { TextButton(close) { Text("取消") } },
    )
}

@Composable
private fun FormField(value: String, change: (String) -> Unit, label: String, single: Boolean = true) =
    OutlinedTextField(value, change, Modifier.fillMaxWidth(), label = { Text(label) }, singleLine = single, maxLines = if (single) 1 else 6)

private fun formValues(kind: String, value: Any?): List<String> = when (kind) {
    "projects" -> (value as? Project)?.let { listOf(it.name, it.code, it.location, it.status, it.progress.toString(), it.description, "", "") } ?: listOf("", "", "", "ACTIVE", "0", "", "", "")
    "tasks" -> (value as? FieldTask)?.let { listOf(it.title, it.description, it.priority, it.status, "", "", "", "") } ?: listOf("", "", "P2", "TODO", "", "", "", "")
    "issues" -> (value as? Issue)?.let { listOf(it.title, it.symptom, it.priority, it.status, it.cause, it.solution, it.verification, "") } ?: listOf("", "", "P1", "OPEN", "", "", "", "")
    "servers" -> (value as? Server)?.let { listOf(it.name, it.host, it.port.toString(), it.username, it.osType, it.notes, it.environment, "") } ?: listOf("", "", "22", "", "Linux", "", "现场环境", "")
    "commands" -> (value as? Command)?.let { listOf(it.title, it.command, it.description, it.category, it.tags, "", "", "") } ?: listOf("", "", "", "通用", "", "", "", "")
    "knowledge" -> (value as? Knowledge)?.let { listOf(it.title, it.content, it.tags, "", "", "", "", "") } ?: listOf("", "", "", "", "", "", "", "")
    "reports" -> (value as? DailyReport)?.let { listOf(it.dateKey, it.title, it.workContent, it.problems, it.solutions, it.risk, it.nextPlan, it.status) } ?: listOf(LocalDate.now().toString(), "${LocalDate.now()} 工作日报", "", "", "", "", "", "DRAFT")
    else -> List(8) { "" }
}

private fun buildItem(kind: String, old: Any?, projectId: String?, v: List<String>): Any {
    val now = System.currentTimeMillis()
    return when (kind) {
        "projects" -> Project((old as? Project)?.id.orEmpty(), v[0], v[1], v[5], v[3], v[4].toIntOrNull()?.coerceIn(0, 100) ?: 0, v[2], (old as? Project)?.createdAt ?: now, now)
        "tasks" -> FieldTask((old as? FieldTask)?.id.orEmpty(), projectId.orEmpty(), v[0], v[1], v[3], v[2], (old as? FieldTask)?.createdAt ?: now, now)
        "issues" -> Issue((old as? Issue)?.id.orEmpty(), projectId.orEmpty(), (old as? Issue)?.serverId, v[0], v[1], v[4], v[5], v[6], v[3], v[2], (old as? Issue)?.createdAt ?: now, now)
        "servers" -> Server((old as? Server)?.id.orEmpty(), projectId.orEmpty(), v[0], v[1], v[2].toIntOrNull() ?: 22, v[3], v[4], v[6].ifBlank { "现场环境" }, v[5], (old as? Server)?.createdAt ?: now, now)
        "commands" -> Command((old as? Command)?.id.orEmpty(), v[0], v[1], v[2], v[3], (old as? Command)?.riskLevel ?: "SAFE", v[4], (old as? Command)?.favorite ?: false, (old as? Command)?.useCount ?: 0, (old as? Command)?.createdAt ?: now, now)
        "knowledge" -> Knowledge((old as? Knowledge)?.id.orEmpty(), projectId, v[0], v[1], v[1].take(120), (old as? Knowledge)?.type ?: "NOTE", v[2], (old as? Knowledge)?.favorite ?: false, (old as? Knowledge)?.createdAt ?: now, now)
        "reports" -> DailyReport((old as? DailyReport)?.id.orEmpty(), v[0], (old as? DailyReport)?.projectId, v[1], v[2], v[3], v[4], v[6], v[5], v[7], (old as? DailyReport)?.createdAt ?: now, now)
        else -> error("不支持的记录类型")
    }
}

private fun linkedProjectId(value: Any?): String? = when (value) {
    is FieldTask -> value.projectId
    is Issue -> value.projectId
    is Server -> value.projectId
    is Knowledge -> value.projectId
    else -> null
}

private fun saveItem(kind: String, value: Any, technologyIds: Set<String>?, vm: FieldOsViewModel) {
    when (kind) {
        "projects" -> vm.saveProjectWithTechnologies(value as Project, technologyIds.orEmpty())
        "tasks" -> vm.updateTask(value as FieldTask)
        "issues" -> vm.updateIssue(value as Issue)
        "servers" -> vm.updateServer(value as Server)
        "commands" -> vm.updateCommand(value as Command)
        "knowledge" -> vm.updateKnowledge(value as Knowledge)
        "reports" -> vm.saveDailyReport(value as DailyReport)
    }
}

@Composable
private fun TechnologySelectionEditor(
    selected: Set<String>,
    knownTechnologyIds: Set<String>,
    onChange: (Set<String>) -> Unit,
) {
    var showPicker by remember { mutableStateOf(false) }
    val selectedOptions = TechnologyCatalog.selectedOptions(selected)
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .38f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("项目技术选型", fontWeight = FontWeight.SemiBold)
                    Text(
                        if (selectedOptions.isEmpty()) "尚未选择，可搜索或自行填写" else "已选 ${selectedOptions.size} 项 · 每个项目独立保存",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp,
                    )
                }
                OutlinedButton({ showPicker = true }) { Text(if (selectedOptions.isEmpty()) "选择" else "管理") }
            }
            if (selectedOptions.isNotEmpty()) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    items(selectedOptions, key = { it.id }) { technology ->
                        val accent = technologyAccent(technology.id)
                        Row(
                            Modifier
                                .background(accent.copy(alpha = .11f), RoundedCornerShape(9.dp))
                                .border(1.dp, accent.copy(alpha = .38f), RoundedCornerShape(9.dp))
                                .padding(horizontal = 8.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            TechnologyIcon(technology.id, null, Modifier.size(17.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(technology.name, fontSize = 10.sp, maxLines = 1)
                        }
                    }
                }
            }
        }
    }
    if (showPicker) {
        TechnologyPickerDialog(
            selected = selected,
            knownTechnologyIds = knownTechnologyIds + selected,
            onChange = onChange,
            onDismiss = { showPicker = false },
        )
    }
}

@Composable
private fun TechnologyPickerDialog(
    selected: Set<String>,
    knownTechnologyIds: Set<String>,
    onChange: (Set<String>) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var customInput by remember { mutableStateOf("") }
    var inputError by remember { mutableStateOf<String?>(null) }
    val available = remember(knownTechnologyIds) { TechnologyCatalog.availableOptions(knownTechnologyIds) }
    val filtered = remember(available, query) {
        val keyword = query.trim()
        if (keyword.isBlank()) available else available.filter { it.name.contains(keyword, true) || it.group.contains(keyword, true) }
    }
    fun addCustom() {
        runCatching {
            val added = TechnologyCatalog.idsForInput(customInput)
            require(added.isNotEmpty()) { "请输入至少一项技术或版本" }
            require((selected + added).size <= 60) { "单个项目最多保存 60 项技术" }
            onChange(selected + added)
        }.onSuccess {
            customInput = ""
            inputError = null
        }.onFailure { inputError = it.message ?: "无法添加" }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("管理项目技术栈") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("已选择 ${selected.size} 项", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("搜索常用技术") },
                    leadingIcon = { Icon(Icons.Default.Search, null) },
                    trailingIcon = { if (query.isNotBlank()) IconButton({ query = "" }) { Icon(Icons.Default.Clear, "清空搜索") } },
                    singleLine = true,
                )
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 220.dp)) {
                    if (filtered.isEmpty()) {
                        item { Text("没有匹配项，可在下方直接填写。", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 18.dp)) }
                    } else {
                        filtered.groupBy { it.group }.forEach { (group, options) ->
                            item(group) {
                                Text(group, color = MaterialTheme.colorScheme.primary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 7.dp, bottom = 3.dp))
                            }
                            items(options, key = { it.id }) { technology ->
                                val checked = technology.id in selected
                                Row(
                                    Modifier.fillMaxWidth().clickable {
                                        if (checked) {
                                            onChange(selected - technology.id)
                                        } else if (selected.size < 60) {
                                            onChange(selected + technology.id)
                                        } else {
                                            inputError = "单个项目最多保存 60 项技术"
                                        }
                                    }.padding(vertical = 5.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(
                                        Modifier.size(36.dp).background(technologyAccent(technology.id).copy(alpha = .1f), RoundedCornerShape(10.dp)),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        TechnologyIcon(technology.id, null, Modifier.size(21.dp))
                                    }
                                    Spacer(Modifier.width(9.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(technology.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        if (technology.group == "自定义") Text("自定义项目技术", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp)
                                    }
                                    Checkbox(checked = checked, onCheckedChange = null)
                                }
                            }
                        }
                    }
                }
                Text("自定义技术或完整版本", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                OutlinedTextField(
                    value = customInput,
                    onValueChange = { customInput = it; inputError = null },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("如：银河麒麟 V10 SP3 ARM64，Java 8，Java 17") },
                    supportingText = { Text(inputError ?: "可用逗号或换行一次添加多项，图标会自动识别") },
                    isError = inputError != null,
                    minLines = 1,
                    maxLines = 2,
                )
                Button(onClick = ::addCustom, enabled = customInput.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.Add, null)
                    Spacer(Modifier.width(6.dp))
                    Text("添加自定义技术")
                }
            }
        },
        confirmButton = { Button(onDismiss) { Text("完成") } },
        dismissButton = {
            if (selected.isNotEmpty()) TextButton({ onChange(emptySet()) }) { Text("清空") }
        },
    )
}

private fun deleteItem(kind: String, id: String, vm: FieldOsViewModel) {
    when (kind) {
        "projects" -> vm.deleteProject(id)
        "tasks" -> vm.deleteTask(id)
        "issues" -> vm.deleteIssue(id)
        "servers" -> vm.deleteServer(id)
        "commands" -> vm.deleteCommand(id)
        "knowledge" -> vm.deleteKnowledge(id)
        "reports" -> vm.deleteDailyReport(id)
    }
}

private fun itemCount(kind: String, w: WorkspaceSnapshot) = when (kind) {
    "projects" -> w.projects.size; "tasks" -> w.tasks.size; "issues" -> w.issues.size
    "servers" -> w.servers.size; "commands" -> w.commands.size; "knowledge" -> w.knowledge.size
    "reports" -> w.reports.size; else -> 0
}

private fun moduleTitle(kind: String) = when (kind) {
    "projects" -> "项目中心"; "tasks" -> "任务"; "issues" -> "现场问题"; "servers" -> "服务器"
    "commands" -> "命令库"; "knowledge" -> "知识库"; "reports" -> "日报"; else -> "记录"
}

private fun moduleIcon(kind: String) = when (kind) {
    "projects" -> Icons.Default.FolderOpen; "tasks" -> Icons.Default.TaskAlt; "issues" -> Icons.Default.ErrorOutline
    "servers" -> Icons.Default.Dns; "commands" -> Icons.Default.Terminal; "knowledge" -> Icons.Default.Book
    "reports" -> Icons.AutoMirrored.Filled.Article; else -> Icons.Default.Inventory2
}

private fun emptyHint(kind: String) = if (kind == "commands") "基础命令正在初始化，也可点击右下角新增" else "点击右下角开始记录"

private fun reportText(r: DailyReport) = "${r.title}\n\n一、今日工作\n${r.workContent}\n\n二、问题\n${r.problems}\n\n三、解决方案\n${r.solutions}\n\n四、风险\n${r.risk}\n\n五、下一步\n${r.nextPlan}"

@Composable
private fun DeleteDialog(name: String, close: () -> Unit, confirm: () -> Unit) = AlertDialog(
    onDismissRequest = close,
    title = { Text("确认删除") },
    text = { Text("删除$name 后无法恢复。") },
    confirmButton = { Button(confirm) { Text("删除") } },
    dismissButton = { TextButton(close) { Text("取消") } },
)
