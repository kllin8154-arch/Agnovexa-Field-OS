package com.kllin.agnovexa.fieldos.presentation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kllin.agnovexa.fieldos.domain.Command
import com.kllin.agnovexa.fieldos.domain.Knowledge
import com.kllin.agnovexa.fieldos.domain.Project
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommandLibraryScreen(state: FieldOsUiState, viewModel: FieldOsViewModel, onBack: () -> Unit) {
    var query by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("全部") }
    var favoritesOnly by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Command?>(null) }
    var showEditor by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<Command?>(null) }
    var deleting by remember { mutableStateOf<Command?>(null) }
    var pendingCopy by remember { mutableStateOf<Command?>(null) }
    val clipboard = LocalClipboardManager.current
    val commands = state.workspace.commands
    val categories = remember(commands) {
        listOf("全部", "命令包") + commands.map { it.category }.filter { it.isNotBlank() && it != "命令包" }.distinct().sorted()
    }
    val visible = remember(commands, query, category, favoritesOnly) {
        commands.filter { command ->
            val textMatch = query.isBlank() || listOf(command.title, command.command, command.description, command.tags, command.category)
                .any { it.contains(query.trim(), ignoreCase = true) }
            val categoryMatch = category == "全部" || command.category == category || (category == "命令包" && command.isBundle())
            textMatch && categoryMatch && (!favoritesOnly || command.favorite)
        }
    }
    fun copyNow(command: Command) {
        clipboard.setText(AnnotatedString(command.command))
    }
    fun requestCopy(command: Command) {
        if (command.riskLevel == "SAFE" && !command.isBundle()) copyNow(command) else pendingCopy = command
    }

    Scaffold(
        topBar = { LibraryTopBar("命令工作台", "搜索、筛选、收藏与整包复制", onBack) },
        floatingActionButton = { FloatingActionButton({ editing = null; showEditor = true }) { Icon(Icons.Default.Add, "新增命令") } },
    ) { padding ->
        LazyColumn(
            Modifier.padding(padding),
            contentPadding = PaddingValues(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                LibraryOverview(
                    icon = Icons.Default.Terminal,
                    title = "${commands.size} 条可用命令",
                    subtitle = "${commands.count(Command::isBundle)} 个可整包发送电脑端 · ${commands.count { it.favorite }} 个收藏",
                    accent = MaterialTheme.colorScheme.primary,
                )
            }
            item {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("搜索标题、命令、标签或技术栈") },
                    leadingIcon = { Icon(Icons.Default.Search, null) },
                    trailingIcon = { if (query.isNotBlank()) IconButton({ query = "" }) { Icon(Icons.Default.Clear, "清空") } },
                    singleLine = true,
                )
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    item {
                        FilterChip(
                            selected = favoritesOnly,
                            onClick = { favoritesOnly = !favoritesOnly },
                            label = { Text("收藏") },
                            leadingIcon = { Icon(if (favoritesOnly) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, null, Modifier.size(16.dp)) },
                        )
                    }
                    items(categories, key = { it }) { value ->
                        FilterChip(selected = category == value, onClick = { category = value }, label = { Text(value) })
                    }
                }
            }
            if (visible.isEmpty()) {
                item { LibraryEmpty(Icons.Default.Terminal, "没有匹配的命令", "调整关键词或筛选条件，也可以新增现场命令。") }
            } else {
                items(visible, key = { it.id }) { command ->
                    CommandWorkbenchCard(
                        command = command,
                        onCopy = { requestCopy(command) },
                        onDetail = { detail = command },
                        onFavorite = { viewModel.updateCommand(command.copy(favorite = !command.favorite)) },
                        onEdit = { editing = command; showEditor = true },
                        onDelete = { deleting = command },
                    )
                }
            }
            item { Spacer(Modifier.height(72.dp)) }
        }
    }

    if (showEditor) {
        CommandEditorDialog(editing, { showEditor = false }) { value ->
            viewModel.updateCommand(value)
            showEditor = false
        }
    }
    detail?.let { command ->
        CommandDetailDialog(command, { detail = null }) { requestCopy(command) }
    }
    deleting?.let { command ->
        LibraryDeleteDialog("命令“${command.title}”", { deleting = null }) {
            viewModel.deleteCommand(command.id)
            deleting = null
        }
    }
    pendingCopy?.let { command ->
        AlertDialog(
            onDismissRequest = { pendingCopy = null },
            title = { Text(if (command.isBundle()) "确认复制整包命令" else "确认复制 ${riskLabel(command.riskLevel)}命令") },
            text = {
                Text(
                    if (command.isBundle()) "整包会作为多行脚本发送到剪贴板。请先核对操作系统、权限、占位符、目标主机和回退条件，再交给电脑端执行。"
                    else "该命令不是纯安全级别。请先核对变量、目标和影响范围。App 只复制，不会直接执行。",
                )
            },
            confirmButton = { Button({ copyNow(command); pendingCopy = null }) { Text("确认复制") } },
            dismissButton = { TextButton({ pendingCopy = null }) { Text("取消") } },
        )
    }
}

@Composable
private fun CommandWorkbenchCard(
    command: Command,
    onCopy: () -> Unit,
    onDetail: () -> Unit,
    onFavorite: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val bundle = command.isBundle()
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, if (bundle) MaterialTheme.colorScheme.secondary.copy(alpha = .55f) else MaterialTheme.colorScheme.outline.copy(alpha = .75f)),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(40.dp).clip(RoundedCornerShape(11.dp))
                        .background((if (bundle) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary).copy(alpha = .14f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(if (bundle) Icons.Default.Inventory2 else Icons.Default.Terminal, null, tint = if (bundle) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary)
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(command.title, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        item { LibraryPill(if (bundle) "整包命令" else command.category.ifBlank { "通用" }, if (bundle) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary) }
                        item { RiskPill(command.riskLevel) }
                    }
                }
                IconButton(onFavorite) { Icon(if (command.favorite) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, if (command.favorite) "取消收藏" else "收藏", tint = MaterialTheme.colorScheme.primary) }
            }
            if (command.description.isNotBlank()) {
                Text(command.description, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(9.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .55f)).padding(10.dp)) {
                Text(command.command, fontFamily = FontFamily.Monospace, fontSize = 11.sp, maxLines = if (bundle) 8 else 4, overflow = TextOverflow.Ellipsis)
            }
            TagPills(command.tags)
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .45f))
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                if (compact) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Button(onCopy, Modifier.fillMaxWidth()) {
                            Icon(Icons.Default.ContentCopy, null, Modifier.size(17.dp))
                            Spacer(Modifier.width(5.dp))
                            Text(if (bundle) "复制整包" else "复制", maxLines = 1)
                        }
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            TextButton(onDetail) { Icon(Icons.Default.Visibility, null, Modifier.size(17.dp)); Spacer(Modifier.width(4.dp)); Text("查看") }
                            Spacer(Modifier.weight(1f))
                            IconButton(onEdit) { Icon(Icons.Default.Edit, "编辑") }
                            IconButton(onDelete) { Icon(Icons.Default.Delete, "删除") }
                        }
                    }
                } else {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Button(onCopy) {
                            Icon(Icons.Default.ContentCopy, null, Modifier.size(17.dp))
                            Spacer(Modifier.width(5.dp))
                            Text(if (bundle) "复制整包" else "复制", maxLines = 1)
                        }
                        TextButton(onDetail) { Icon(Icons.Default.Visibility, null, Modifier.size(17.dp)); Spacer(Modifier.width(4.dp)); Text("查看") }
                        Spacer(Modifier.weight(1f))
                        IconButton(onEdit) { Icon(Icons.Default.Edit, "编辑") }
                        IconButton(onDelete) { Icon(Icons.Default.Delete, "删除") }
                    }
                }
            }
        }
    }
}

@Composable
private fun CommandEditorDialog(existing: Command?, onDismiss: () -> Unit, onSave: (Command) -> Unit) {
    var title by remember(existing) { mutableStateOf(existing?.title.orEmpty()) }
    var command by remember(existing) { mutableStateOf(existing?.command.orEmpty()) }
    var description by remember(existing) { mutableStateOf(existing?.description.orEmpty()) }
    var category by remember(existing) { mutableStateOf(existing?.category ?: "通用") }
    var tags by remember(existing) { mutableStateOf(existing?.tags.orEmpty()) }
    val now = System.currentTimeMillis()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "新增命令" else "编辑命令") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item { OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(), label = { Text("标题*") }, singleLine = true) }
                item { OutlinedTextField(command, { command = it }, Modifier.fillMaxWidth(), label = { Text("命令或多行命令包*") }, minLines = 5, maxLines = 14, textStyle = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Monospace)) }
                item { OutlinedTextField(description, { description = it }, Modifier.fillMaxWidth(), label = { Text("用途、前置条件和验证说明") }, minLines = 2, maxLines = 5) }
                item { OutlinedTextField(category, { category = it }, Modifier.fillMaxWidth(), label = { Text("分类；整包请填写“命令包”") }, singleLine = true) }
                item { OutlinedTextField(tags, { tags = it }, Modifier.fillMaxWidth(), label = { Text("标签，逗号分隔") }, singleLine = true) }
                item { Text("风险等级由本机根据命令内容重新识别。多行内容可以作为整体复制给电脑端。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp) }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        Command(
                            existing?.id.orEmpty(), title, command, description, category,
                            existing?.riskLevel ?: "SAFE", tags, existing?.favorite ?: false,
                            existing?.useCount ?: 0, existing?.createdAt ?: now, now,
                        ),
                    )
                },
                enabled = title.isNotBlank() && command.isNotBlank(),
            ) { Text("保存") }
        },
        dismissButton = { TextButton(onDismiss) { Text("取消") } },
    )
}

@Composable
private fun CommandDetailDialog(command: Command, onDismiss: () -> Unit, onCopy: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(command.title, maxLines = 2, overflow = TextOverflow.Ellipsis) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.heightIn(max = 560.dp)) {
                item { Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { LibraryPill(command.category, MaterialTheme.colorScheme.primary); RiskPill(command.riskLevel) } }
                if (command.description.isNotBlank()) item { Text(command.description, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                item {
                    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(9.dp)).background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .6f)).padding(11.dp)) {
                        Text(command.command, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                    }
                }
                if (command.tags.isNotBlank()) item { TagPills(command.tags) }
                item { Text("App 只负责复制，不会直接执行命令。", color = MaterialTheme.colorScheme.error, fontSize = 10.sp) }
            }
        },
        confirmButton = { Button(onCopy) { Icon(Icons.Default.ContentCopy, null); Spacer(Modifier.width(5.dp)); Text(if (command.isBundle()) "复制整包" else "复制") } },
        dismissButton = { TextButton(onDismiss) { Text("关闭") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KnowledgeLibraryScreen(state: FieldOsUiState, viewModel: FieldOsViewModel, onBack: () -> Unit) {
    var query by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("ALL") }
    var projectId by remember { mutableStateOf<String?>(null) }
    var projectMenu by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Knowledge?>(null) }
    var showEditor by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<Knowledge?>(null) }
    var deleting by remember { mutableStateOf<Knowledge?>(null) }
    val clipboard = LocalClipboardManager.current
    val knowledge = state.workspace.knowledge
    val typeOptions = knowledgeTypes
    val visible = remember(knowledge, query, type, projectId) {
        knowledge.filter { item ->
            val textMatch = query.isBlank() || listOf(item.title, item.content, item.summary, item.tags)
                .any { it.contains(query.trim(), ignoreCase = true) }
            textMatch && (type == "ALL" || item.type == type) && (projectId == null || item.projectId == projectId)
        }
    }

    Scaffold(
        topBar = { LibraryTopBar("知识中心", "项目资料、故障复盘、部署文档与 Runbook", onBack) },
        floatingActionButton = { FloatingActionButton({ editing = null; showEditor = true }) { Icon(Icons.Default.Add, "新增知识") } },
    ) { padding ->
        LazyColumn(
            Modifier.padding(padding),
            contentPadding = PaddingValues(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                LibraryOverview(
                    icon = Icons.AutoMirrored.Filled.MenuBook,
                    title = "${knowledge.size} 篇本地知识",
                    subtitle = "${knowledge.count { it.type == "DEPLOYMENT_DOCUMENT" }} 篇部署文档 · ${knowledge.count { it.favorite }} 个收藏",
                    accent = MaterialTheme.colorScheme.secondary,
                )
            }
            item {
                OutlinedTextField(
                    query, { query = it }, Modifier.fillMaxWidth(),
                    label = { Text("搜索标题、正文或标签") },
                    leadingIcon = { Icon(Icons.Default.Search, null) },
                    trailingIcon = { if (query.isNotBlank()) IconButton({ query = "" }) { Icon(Icons.Default.Clear, "清空") } },
                    singleLine = true,
                )
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    items(typeOptions, key = { it.id }) { value ->
                        FilterChip(selected = type == value.id, onClick = { type = value.id }, label = { Text(value.label) }, leadingIcon = { Icon(value.icon, null, Modifier.size(16.dp)) })
                    }
                }
            }
            item {
                Box {
                    OutlinedButton({ projectMenu = true }, Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.FolderOpen, null, Modifier.size(17.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(state.workspace.projects.firstOrNull { it.id == projectId }?.name ?: "全部项目", Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("▾")
                    }
                    DropdownMenu(projectMenu, { projectMenu = false }) {
                        DropdownMenuItem(text = { Text("全部项目") }, onClick = { projectId = null; projectMenu = false })
                        state.workspace.projects.forEach { project ->
                            DropdownMenuItem(text = { Text(project.name) }, onClick = { projectId = project.id; projectMenu = false })
                        }
                    }
                }
            }
            if (visible.isEmpty()) {
                item { LibraryEmpty(Icons.AutoMirrored.Filled.MenuBook, "没有匹配的知识", "调整关键词、类型或项目筛选，也可以新建一篇资料。") }
            } else {
                items(visible, key = { it.id }) { item ->
                    KnowledgeReadingCard(
                        value = item,
                        project = state.workspace.projects.firstOrNull { it.id == item.projectId },
                        onOpen = { detail = item },
                        onCopy = { clipboard.setText(AnnotatedString(item.content)) },
                        onFavorite = { viewModel.updateKnowledge(item.copy(favorite = !item.favorite)) },
                        onEdit = { editing = item; showEditor = true },
                        onDelete = { deleting = item },
                    )
                }
            }
            item { Spacer(Modifier.height(72.dp)) }
        }
    }

    if (showEditor) {
        KnowledgeEditorDialog(editing, state.workspace.projects, { showEditor = false }) { value ->
            viewModel.updateKnowledge(value)
            showEditor = false
        }
    }
    detail?.let { item ->
        KnowledgeDetailDialog(item, state.workspace.projects.firstOrNull { it.id == item.projectId }, { detail = null }) {
            clipboard.setText(AnnotatedString(item.content))
        }
    }
    deleting?.let { item ->
        LibraryDeleteDialog("知识“${item.title}”", { deleting = null }) {
            viewModel.deleteKnowledge(item.id)
            deleting = null
        }
    }
}

@Composable
private fun KnowledgeReadingCard(
    value: Knowledge,
    project: Project?,
    onOpen: () -> Unit,
    onCopy: () -> Unit,
    onFavorite: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val info = knowledgeType(value.type)
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .72f)),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)).background(info.color.copy(alpha = .14f)), contentAlignment = Alignment.Center) {
                    Icon(info.icon, null, tint = info.color)
                }
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)) {
                    Text(value.title, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text("${info.label} · ${project?.name ?: "通用资料"} · ${libraryTime(value.updatedAt)}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                IconButton(onFavorite) { Icon(if (value.favorite) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, if (value.favorite) "取消收藏" else "收藏", tint = info.color) }
            }
            Text(value.summary.ifBlank { value.content.take(160) }, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 4, overflow = TextOverflow.Ellipsis, fontSize = 12.sp)
            TagPills(value.tags)
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .45f))
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                if (compact) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Button(onOpen, Modifier.fillMaxWidth()) { Icon(Icons.Default.Visibility, null, Modifier.size(17.dp)); Spacer(Modifier.width(5.dp)); Text("阅读") }
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            TextButton(onCopy) { Icon(Icons.Default.ContentCopy, null, Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text("复制") }
                            Spacer(Modifier.weight(1f))
                            IconButton(onEdit) { Icon(Icons.Default.Edit, "编辑") }
                            IconButton(onDelete) { Icon(Icons.Default.Delete, "删除") }
                        }
                    }
                } else {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Button(onOpen) { Icon(Icons.Default.Visibility, null, Modifier.size(17.dp)); Spacer(Modifier.width(5.dp)); Text("阅读") }
                        TextButton(onCopy) { Icon(Icons.Default.ContentCopy, null, Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text("复制") }
                        Spacer(Modifier.weight(1f))
                        IconButton(onEdit) { Icon(Icons.Default.Edit, "编辑") }
                        IconButton(onDelete) { Icon(Icons.Default.Delete, "删除") }
                    }
                }
            }
        }
    }
}

@Composable
private fun KnowledgeEditorDialog(existing: Knowledge?, projects: List<Project>, onDismiss: () -> Unit, onSave: (Knowledge) -> Unit) {
    var title by remember(existing) { mutableStateOf(existing?.title.orEmpty()) }
    var content by remember(existing) { mutableStateOf(existing?.content.orEmpty()) }
    var tags by remember(existing) { mutableStateOf(existing?.tags.orEmpty()) }
    var type by remember(existing) { mutableStateOf(existing?.type ?: "NOTE") }
    var projectId by remember(existing) { mutableStateOf(existing?.projectId) }
    var typeMenu by remember { mutableStateOf(false) }
    var projectMenu by remember { mutableStateOf(false) }
    val typeOptions = knowledgeTypes
    val now = System.currentTimeMillis()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "新增知识" else "编辑知识") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item { OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(), label = { Text("标题*") }, singleLine = true) }
                item {
                    Box {
                        OutlinedButton({ typeMenu = true }, Modifier.fillMaxWidth()) { Text("类型：${knowledgeType(type).label}", Modifier.weight(1f)); Text("▾") }
                        DropdownMenu(typeMenu, { typeMenu = false }) {
                            typeOptions.filterNot { it.id == "ALL" }.forEach { value -> DropdownMenuItem(text = { Text(value.label) }, onClick = { type = value.id; typeMenu = false }) }
                        }
                    }
                }
                item {
                    Box {
                        OutlinedButton({ projectMenu = true }, Modifier.fillMaxWidth()) { Text("项目：${projects.firstOrNull { it.id == projectId }?.name ?: "通用资料"}", Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis); Text("▾") }
                        DropdownMenu(projectMenu, { projectMenu = false }) {
                            DropdownMenuItem(text = { Text("通用资料") }, onClick = { projectId = null; projectMenu = false })
                            projects.forEach { project -> DropdownMenuItem(text = { Text(project.name) }, onClick = { projectId = project.id; projectMenu = false }) }
                        }
                    }
                }
                item { OutlinedTextField(tags, { tags = it }, Modifier.fillMaxWidth(), label = { Text("标签，逗号分隔") }, singleLine = true) }
                item { OutlinedTextField(content, { content = it }, Modifier.fillMaxWidth(), label = { Text("正文*") }, minLines = 10, maxLines = 18) }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        Knowledge(
                            existing?.id.orEmpty(), projectId, title, content, content.take(160), type, tags,
                            existing?.favorite ?: false, existing?.createdAt ?: now, now,
                        ),
                    )
                },
                enabled = title.isNotBlank() && content.isNotBlank(),
            ) { Text("保存") }
        },
        dismissButton = { TextButton(onDismiss) { Text("取消") } },
    )
}

@Composable
private fun KnowledgeDetailDialog(value: Knowledge, project: Project?, onDismiss: () -> Unit, onCopy: () -> Unit) {
    val info = knowledgeType(value.type)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(value.title, maxLines = 2, overflow = TextOverflow.Ellipsis) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.heightIn(max = 580.dp)) {
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        item { LibraryPill(info.label, info.color) }
                        project?.let { item { LibraryPill(it.name, MaterialTheme.colorScheme.primary) } }
                    }
                }
                if (value.tags.isNotBlank()) item { TagPills(value.tags) }
                item { HorizontalDivider() }
                item { Text(value.content, lineHeight = 21.sp) }
            }
        },
        confirmButton = { Button(onCopy) { Icon(Icons.Default.ContentCopy, null); Spacer(Modifier.width(5.dp)); Text("复制全文") } },
        dismissButton = { TextButton(onDismiss) { Text("关闭") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LibraryTopBar(title: String, subtitle: String, onBack: () -> Unit) = TopAppBar(
    title = { Column { Text(title, fontWeight = FontWeight.Bold); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
    navigationIcon = { IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
)

@Composable
private fun LibraryOverview(icon: ImageVector, title: String, subtitle: String, accent: Color) {
    Card(colors = CardDefaults.cardColors(containerColor = accent.copy(alpha = .09f)), border = BorderStroke(1.dp, accent.copy(alpha = .3f)), shape = RoundedCornerShape(14.dp)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(accent.copy(alpha = .17f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = accent) }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun LibraryEmpty(icon: ImageVector, title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 64.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(68.dp).clip(RoundedCornerShape(20.dp)).background(MaterialTheme.colorScheme.primary.copy(alpha = .1f)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(34.dp))
        }
        Text(title, fontWeight = FontWeight.Bold)
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
private fun RiskPill(risk: String) {
    val color = when (risk) { "DANGEROUS" -> MaterialTheme.colorScheme.error; "CAUTION" -> MaterialTheme.colorScheme.tertiary; else -> MaterialTheme.colorScheme.primary }
    LibraryPill(riskLabel(risk), color)
}

@Composable
private fun LibraryPill(label: String, color: Color) {
    Box(Modifier.clip(RoundedCornerShape(6.dp)).background(color.copy(alpha = .13f)).padding(horizontal = 7.dp, vertical = 3.dp)) {
        Text(label, color = color, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun TagPills(tags: String) {
    val values = tags.split(',', '，').map(String::trim).filter(String::isNotBlank).distinct().take(4)
    if (values.isEmpty()) return
    LazyRow(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        items(values, key = { it }) { tag -> LibraryPill("#$tag", MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun LibraryDeleteDialog(name: String, onDismiss: () -> Unit, onConfirm: () -> Unit) = AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("确认删除") },
    text = { Text("删除$name 后无法恢复。") },
    confirmButton = { Button(onConfirm) { Text("删除") } },
    dismissButton = { TextButton(onDismiss) { Text("取消") } },
)

private data class KnowledgeTypeUi(val id: String, val label: String, val icon: ImageVector, val color: Color)

private val knowledgeTypes
    @Composable get() = listOf(
        KnowledgeTypeUi("ALL", "全部", Icons.AutoMirrored.Filled.MenuBook, MaterialTheme.colorScheme.primary),
        KnowledgeTypeUi("NOTE", "笔记", Icons.AutoMirrored.Filled.Article, MaterialTheme.colorScheme.primary),
        KnowledgeTypeUi("TROUBLESHOOTING", "故障复盘", Icons.Default.Build, MaterialTheme.colorScheme.error),
        KnowledgeTypeUi("RUNBOOK", "Runbook", Icons.Default.Checklist, MaterialTheme.colorScheme.secondary),
        KnowledgeTypeUi("DEPLOYMENT_DOCUMENT", "部署文档", Icons.Default.RocketLaunch, MaterialTheme.colorScheme.tertiary),
    )

@Composable
private fun knowledgeType(type: String): KnowledgeTypeUi = knowledgeTypes.firstOrNull { it.id == type }
    ?: KnowledgeTypeUi(type, type.ifBlank { "其他" }, Icons.AutoMirrored.Filled.MenuBook, MaterialTheme.colorScheme.primary)

private fun Command.isBundle(): Boolean = category == "命令包" || tags.contains("命令包") || command.lineSequence().count { it.isNotBlank() } >= 4
private fun riskLabel(risk: String) = when (risk) { "DANGEROUS" -> "高风险"; "CAUTION" -> "需谨慎"; else -> "安全" }
private fun libraryTime(value: Long): String = DateTimeFormatter.ofPattern("MM-dd HH:mm").format(Instant.ofEpochMilli(value).atZone(ZoneId.systemDefault()))
