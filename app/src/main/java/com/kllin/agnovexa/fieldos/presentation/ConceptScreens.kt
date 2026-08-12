package com.kllin.agnovexa.fieldos.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.saveable.rememberSaveable
import com.kllin.agnovexa.fieldos.domain.FieldTask
import com.kllin.agnovexa.fieldos.domain.Project
import com.kllin.agnovexa.fieldos.domain.Server
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val ConceptCardShape = RoundedCornerShape(26.dp)
private val ConceptInnerShape = RoundedCornerShape(17.dp)

@Composable
fun ConceptBackdrop() {
    val gridColor = MaterialTheme.colorScheme.onBackground.copy(alpha = .018f)
    val glowColor = MaterialTheme.colorScheme.secondary.copy(alpha = .055f)
    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val grid = 52.dp.toPx()
            var x = 0f
            while (x <= size.width) {
                drawLine(gridColor, Offset(x, 0f), Offset(x, size.height), 1f)
                x += grid
            }
            var y = 0f
            while (y <= size.height) {
                drawLine(gridColor, Offset(0f, y), Offset(size.width, y), 1f)
                y += grid
            }
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(glowColor, Color.Transparent),
                    center = Offset(size.width * .88f, size.height * .08f),
                    radius = size.minDimension * .9f,
                ),
                radius = size.minDimension * .9f,
                center = Offset(size.width * .88f, size.height * .08f),
            )
        }
    }
}

@Composable
fun ConceptCommandDock(enabled: Boolean, onSend: (String) -> Unit) {
    var value by rememberSaveable { androidx.compose.runtime.mutableStateOf("") }
    fun send() {
        val prompt = value.trim()
        if (prompt.isNotBlank() && enabled) {
            onSend(prompt)
            value = ""
        }
    }
    Row(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background.copy(alpha = .97f))
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = { value = it },
            modifier = Modifier.weight(1f).height(50.dp),
            enabled = enabled,
            placeholder = { Text("询问 Agnovexa…", maxLines = 1, fontSize = 11.sp) },
            leadingIcon = { Icon(Icons.Default.Terminal, null, modifier = Modifier.size(18.dp)) },
            singleLine = true,
            shape = RoundedCornerShape(18.dp),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { send() }),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                focusedIndicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = .65f),
                unfocusedIndicatorColor = MaterialTheme.colorScheme.outline.copy(alpha = .7f),
            ),
        )
        Spacer(Modifier.width(8.dp))
        IconButton(
            onClick = ::send,
            enabled = enabled && value.isNotBlank(),
            modifier = Modifier.size(44.dp).background(MaterialTheme.colorScheme.primary, RoundedCornerShape(15.dp)),
        ) {
            Icon(Icons.AutoMirrored.Filled.Send, "发送给 AI", tint = MaterialTheme.colorScheme.onPrimary)
        }
    }
}

@Composable
fun ConceptHomeScreen(
    state: FieldOsUiState,
    navigate: (String) -> Unit,
    onReplayBoot: () -> Unit,
) {
    val workspace = state.workspace
    val activeTasks = workspace.tasks.filter { it.status != "DONE" && it.status != "CANCELED" }
    val openIssues = workspace.issues.count { it.status != "RESOLVED" }

    ConceptPageEnter {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 15.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp),
        ) {
            item { ConceptBrandHeader(onReplayBoot = onReplayBoot, onProfile = { navigate("profile") }) }
            item {
                val today = remember { LocalDate.now() }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    ConceptEyebrow("SYSTEM READY / ${today.format(DateTimeFormatter.ofPattern("MM.dd"))} BRIEFING")
                    Text("你好，${state.preferences.userName}", style = MaterialTheme.typography.headlineMedium)
                    Text("这里只保留今天最需要处理的内容。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            item {
                BriefingCard(workspace.projects.size, activeTasks.size, openIssues, { navigate("records/tasks") }, { navigate("projects") })
            }
            if (activeTasks.isNotEmpty()) {
                item { ActiveMissionsCard(activeTasks.take(3), workspace.projects, onOpen = { navigate("records/tasks") }) }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
private fun ConceptBrandHeader(onReplayBoot: () -> Unit, onProfile: () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("AGNOVEXA", fontWeight = FontWeight.Bold, fontSize = 20.sp, letterSpacing = 1.7.sp, maxLines = 1)
                Text(
                    if (compact) "FIELD OS · LOCAL CORE" else "FIELD OPERATING SYSTEM · V0.1",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp,
                    letterSpacing = if (compact) .7.sp else 1.1.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (!compact) {
                Box(
                    Modifier
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = .06f), RoundedCornerShape(14.dp))
                        .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .14f), RoundedCornerShape(14.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(7.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
                        Spacer(Modifier.width(7.dp))
                        Text("LOCAL CORE", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, letterSpacing = .7.sp)
                    }
                }
            }
            IconButton(onReplayBoot) { Icon(Icons.Default.Refresh, "重播启动动画", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
            IconButton(onProfile) { Icon(Icons.Default.Person, "打开设置", tint = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}

@Composable
private fun BriefingCard(
    projects: Int,
    tasks: Int,
    issues: Int,
    onStart: () -> Unit,
    onProjects: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ConceptCard(modifier = modifier) {
        Box(
            Modifier
                .fillMaxWidth()
                .background(
                    Brush.radialGradient(
                        listOf(MaterialTheme.colorScheme.primary.copy(alpha = .1f), Color.Transparent),
                        radius = 620f,
                    ),
                ),
        ) {
            Column(
                Modifier.fillMaxWidth().padding(19.dp),
                verticalArrangement = Arrangement.spacedBy(15.dp),
            ) {
                ConceptCardHead("TODAY'S PRIORITIES", "REAL DATA")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    HomeMetric("项目", projects, Modifier.weight(1f))
                    HomeMetric("待办", tasks, Modifier.weight(1f))
                    HomeMetric("问题", issues, Modifier.weight(1f), issues > 0)
                }
                if (tasks == 0 && issues == 0) {
                    Text(
                        "目前没有待处理事项，可以继续维护项目资料或记录现场知识。",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Text("优先处理 $tasks 项待办和 $issues 个现场问题。", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                    if (compact) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = onStart, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                                Icon(Icons.Default.Check, null)
                                Spacer(Modifier.width(6.dp))
                                Text("处理待办")
                            }
                            OutlinedButton(onClick = onProjects, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                                Icon(Icons.Default.FolderOpen, null)
                                Spacer(Modifier.width(6.dp))
                                Text("项目资料")
                            }
                        }
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                            Button(onClick = onStart, modifier = Modifier.weight(1f).height(48.dp)) {
                                Icon(Icons.Default.Check, null)
                                Spacer(Modifier.width(6.dp))
                                Text("处理待办")
                            }
                            OutlinedButton(onClick = onProjects, modifier = Modifier.weight(1f).height(48.dp)) {
                                Icon(Icons.Default.FolderOpen, null)
                                Spacer(Modifier.width(6.dp))
                                Text("项目资料")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeMetric(label: String, value: Int, modifier: Modifier = Modifier, alert: Boolean = false) {
    val color = if (alert) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    Column(
        modifier
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .56f), ConceptInnerShape)
            .padding(horizontal = 11.dp, vertical = 10.dp),
    ) {
        Text(value.toString(), color = color, fontWeight = FontWeight.SemiBold, fontSize = 22.sp)
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
    }
}

@Composable
private fun SystemPulseCard(
    readiness: Int,
    knowledge: Int,
    providerName: String?,
    servers: Int,
    pendingTasks: Int,
    modifier: Modifier = Modifier,
) {
    ConceptCard(modifier = modifier.heightIn(min = 330.dp)) {
        Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
            ConceptCardHead("SYSTEM PULSE", "REAL DATA")
            Box(Modifier.fillMaxWidth().height(142.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = { readiness / 100f },
                    modifier = Modifier.size(132.dp),
                    strokeWidth = 11.dp,
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(readiness.toString(), style = MaterialTheme.typography.headlineLarge)
                    Text("READINESS", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, letterSpacing = 1.5.sp)
                }
            }
            StatusLine("离线知识核心", "$knowledge 条")
            StatusLine("在线模型", providerName ?: "未配置", providerName != null)
            StatusLine("服务器资产", "$servers 台")
            StatusLine("当前待办", "$pendingTasks 项")
        }
    }
}

@Composable
private fun ActiveMissionsCard(tasks: List<FieldTask>, projects: List<Project>, onOpen: () -> Unit) {
    ConceptCard(Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ConceptCardHead("ACTIVE MISSIONS", "${tasks.size} 项")
            if (tasks.isEmpty()) {
                ConceptEmpty("当前没有待办任务", "可以进入任务页创建今天的第一项工作。")
            } else {
                tasks.forEachIndexed { index, task ->
                    if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .55f))
                    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(22.dp).border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(7.dp)))
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(task.title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            val project = projects.firstOrNull { it.id == task.projectId }?.name ?: "未关联项目"
                            Text("$project · ${task.status}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        ConceptPill(task.priority, if (task.priority == "P0") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
}

@Composable
private fun KnowledgeRecallCard(knowledge: Int, commands: Int, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    ConceptCard(modifier.clickable(onClick = onOpen)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            ConceptCardHead("KNOWLEDGE RECALL", "SEARCH")
            Box(
                Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = .18f), ConceptInnerShape)
                    .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .7f), ConceptInnerShape)
                    .padding(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(">", color = MaterialTheme.colorScheme.primary, fontFamily = FontFamily.Monospace)
                    Spacer(Modifier.width(9.dp))
                    Text("搜索历史问题、知识与命令…", color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                }
            }
            Row(verticalAlignment = Alignment.Bottom) {
                Text(knowledge.toString(), style = MaterialTheme.typography.displayMedium)
                Spacer(Modifier.width(8.dp))
                Text("条离线知识", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 6.dp))
                Spacer(Modifier.weight(1f))
                Text("$commands COMMANDS", color = MaterialTheme.colorScheme.primary, fontSize = 9.sp, letterSpacing = 1.sp)
            }
        }
    }
}

@Composable
private fun FieldNodesCard(servers: List<Server>, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    ConceptCard(modifier.clickable(onClick = onOpen)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            ConceptCardHead("FIELD NODES", "ASSETS")
            if (servers.isEmpty()) {
                ConceptEmpty("尚未登记服务器", "服务器页只记录资产，不会主动连接或探测主机。")
            } else {
                servers.chunked(4).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { server ->
                            val label = server.host.substringAfterLast('.').ifBlank { server.name.take(5) }
                            Box(
                                Modifier
                                    .weight(1f)
                                    .height(62.dp)
                                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .55f), ConceptInnerShape)
                                    .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .7f), ConceptInnerShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(Modifier.size(5.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
                                    Spacer(Modifier.height(6.dp))
                                    Text(label, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                                }
                            }
                        }
                        repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
                Text("${servers.size} 台资产 · 未主动探测在线状态", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun RecentTracesCard(state: FieldOsUiState, onOpen: () -> Unit) {
    val activities = state.workspace.activities.take(4)
    ConceptCard(Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
            ConceptCardHead("RECENT TRACES", "全部活动")
            if (activities.isEmpty()) {
                ConceptEmpty("暂无工作轨迹", "创建项目、任务或知识后，这里会显示真实活动。")
            } else {
                activities.forEach { activity ->
                    Row(verticalAlignment = Alignment.Top) {
                        Box(Modifier.padding(top = 6.dp).size(7.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f)) {
                            Text(activity.title, fontWeight = FontWeight.SemiBold)
                            Text(activity.description, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 11.sp)
                        }
                        Text(conceptTime(activity.occurredAt), color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace, fontSize = 9.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun ConceptOperationsScreen(
    state: FieldOsUiState,
    navigate: (String) -> Unit,
) {
    val commands = state.workspace.commands
    val preview = commands.firstOrNull { it.favorite } ?: commands.firstOrNull()
    val runbooks = commands.filter { it.category == "命令包" || it.tags.contains("命令包") || it.command.lineSequence().count(String::isNotBlank) >= 4 }.take(4)
    ConceptPageEnter {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            item {
                ConceptSectionHeader(
                    eyebrow = "OPERATIONS CENTER",
                    title = "把命令、环境和结果\n留在同一条工作链上。",
                    description = "管理服务器资产、命令手册、部署文档、问题和日报。App 只复制命令，不直接执行 Shell。",
                    action = "打开命令工作台",
                    onAction = { navigate("records/commands") },
                )
            }
            item {
                TechnologyBrandPanel(state) { navigate("projects") }
            }
            item {
                ConceptCard {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        ConceptCardHead("COMMAND PREVIEW", preview?.category?.uppercase() ?: "EMPTY")
                        if (preview == null) {
                            ConceptEmpty("命令库尚未就绪", "初始化完成后可在这里预览收藏命令。")
                        } else {
                            Text(preview.title, style = MaterialTheme.typography.titleLarge)
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF050607), ConceptInnerShape)
                                    .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .7f), ConceptInnerShape)
                                    .padding(17.dp),
                            ) {
                                Text(preview.command, color = MaterialTheme.colorScheme.secondary, fontFamily = FontFamily.Monospace, fontSize = 11.sp, maxLines = 12, overflow = TextOverflow.Ellipsis)
                            }
                            Text("风险等级 ${preview.riskLevel} · 使用前核对目标环境与占位符", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                        }
                    }
                }
            }
            item {
                ConceptCard {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        ConceptCardHead("RUNBOOK LIBRARY", runbooks.size.toString().padStart(2, '0'))
                        if (runbooks.isEmpty()) {
                            ConceptEmpty("暂无命令包", "可在命令工作台保存多行巡检或部署命令包。")
                        } else {
                            runbooks.forEachIndexed { index, command ->
                                if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .5f))
                                Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(7.dp).background(MaterialTheme.colorScheme.primary, RoundedCornerShape(2.dp)))
                                    Spacer(Modifier.width(11.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(command.title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text(command.tags.ifBlank { command.category }, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                    Text("${command.command.lineSequence().count(String::isNotBlank)} LINES", color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace, fontSize = 9.sp)
                                }
                            }
                        }
                    }
                }
            }
            item {
                val modules = listOf(
                    ConceptModule("任务", "${state.workspace.tasks.size} 条", Icons.Default.TaskAlt, "records/tasks"),
                    ConceptModule("现场问题", "${state.workspace.issues.size} 条", Icons.Default.ErrorOutline, "records/issues"),
                    ConceptModule("服务器", "${state.workspace.servers.size} 台", Icons.Default.Dns, "records/servers"),
                    ConceptModule("日报", "${state.workspace.reports.size} 份", Icons.AutoMirrored.Filled.Article, "records/reports"),
                    ConceptModule("部署文档", "预览后入库", Icons.Default.UploadFile, "deployment-import"),
                    ConceptModule("统一搜索", "知识与命令", Icons.Default.Search, "search"),
                )
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        ConceptEyebrow("WORKSPACE MODULES")
                        modules.chunked(if (compact) 1 else 2).forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                row.forEach { module -> ConceptModuleCard(module, { navigate(module.route) }, Modifier.weight(1f)) }
                            }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
fun ConceptKnowledgeScreen(state: FieldOsUiState, navigate: (String) -> Unit) {
    val workspace = state.workspace
    val grouped = workspace.knowledge.groupBy { it.projectId }
    ConceptPageEnter {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            item {
                ConceptSectionHeader(
                    eyebrow = "OFFLINE KNOWLEDGE VAULT",
                    title = "文档不是仓库。\n它应该能直接参与工作。",
                    description = "知识、命令、故障复盘和部署文档保存在本机，并通过 Room FTS 统一检索。",
                    action = "进入知识库",
                    onAction = { navigate("records/knowledge") },
                )
            }
            item {
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                    if (compact) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                ConceptMetric("知识条目", workspace.knowledge.size.toString(), Modifier.weight(1f))
                                ConceptMetric("命令索引", workspace.commands.size.toString(), Modifier.weight(1f))
                            }
                            ConceptMetric("关联项目", grouped.keys.filterNotNull().size.toString(), Modifier.fillMaxWidth())
                        }
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            ConceptMetric("知识条目", workspace.knowledge.size.toString(), Modifier.weight(1f))
                            ConceptMetric("命令索引", workspace.commands.size.toString(), Modifier.weight(1f))
                            ConceptMetric("关联项目", grouped.keys.filterNotNull().size.toString(), Modifier.weight(1f))
                        }
                    }
                }
            }
            item {
                ConceptCard {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        ConceptCardHead("KNOWLEDGE STRUCTURE", "${workspace.knowledge.size} ITEMS")
                        if (workspace.knowledge.isEmpty()) {
                            ConceptEmpty("知识库还是空的", "可从现场问题、AI 回答或部署文档创建知识。")
                        } else {
                            workspace.projects.filter { grouped[it.id].orEmpty().isNotEmpty() }.take(5).forEach { project ->
                                KnowledgeTreeRow(project.name, grouped[project.id].orEmpty().size, 0)
                                grouped[project.id].orEmpty().take(2).forEach { knowledge -> KnowledgeTreeRow(knowledge.title, null, 1) }
                            }
                            grouped[null].orEmpty().take(3).forEach { knowledge -> KnowledgeTreeRow(knowledge.title, null, 0) }
                        }
                    }
                }
            }
            item {
                ConceptCard(Modifier.clickable { navigate("search") }) {
                    Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(48.dp).background(MaterialTheme.colorScheme.primary.copy(alpha = .12f), ConceptInnerShape), contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.Search, null, tint = MaterialTheme.colorScheme.primary)
                        }
                        Spacer(Modifier.width(13.dp))
                        Column(Modifier.weight(1f)) {
                            Text("统一检索", style = MaterialTheme.typography.titleMedium)
                            Text("同时查找知识正文、命令、标签和标题", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                        }
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, null, tint = MaterialTheme.colorScheme.primary)
                    }
                }
            }
            if (workspace.knowledge.isNotEmpty()) {
                item { ConceptEyebrow("RECENT KNOWLEDGE") }
                items(workspace.knowledge.take(4), key = { it.id }) { knowledge ->
                    ConceptCard(Modifier.clickable { navigate("records/knowledge") }) {
                        Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text(knowledge.title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(knowledge.summary.ifBlank { knowledge.content }, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 11.sp)
                            Text(knowledge.tags.ifBlank { knowledge.type }, color = MaterialTheme.colorScheme.primary, fontSize = 9.sp, letterSpacing = .5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
private fun ConceptSectionHeader(eyebrow: String, title: String, description: String, action: String, onAction: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(13.dp)) {
        ConceptEyebrow(eyebrow)
        Text(title, style = MaterialTheme.typography.headlineLarge)
        Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
        Button(onClick = onAction, modifier = Modifier.height(50.dp)) { Text(action) }
    }
}

@Composable
private fun ConceptMetric(label: String, value: String, modifier: Modifier = Modifier) {
    ConceptCard(modifier) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 16.dp)) {
            Text(value, style = MaterialTheme.typography.headlineMedium)
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, maxLines = 1)
        }
    }
}

@Composable
private fun KnowledgeTreeRow(title: String, count: Int?, level: Int) {
    Row(Modifier.fillMaxWidth().padding(start = (level * 24).dp, top = 5.dp, bottom = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(if (level == 0) 8.dp else 6.dp)
                .border(1.dp, if (level == 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline, RoundedCornerShape(2.dp)),
        )
        Spacer(Modifier.width(11.dp))
        Text(title, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, color = if (level == 0) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
        if (count != null) Text(count.toString(), color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
    }
}

private data class ConceptModule(val title: String, val subtitle: String, val icon: ImageVector, val route: String)

@Composable
private fun ConceptModuleCard(module: ConceptModule, onClick: () -> Unit, modifier: Modifier = Modifier) {
    ConceptCard(modifier.clickable(onClick = onClick)) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(module.icon, null, tint = MaterialTheme.colorScheme.primary)
            Text(module.title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(module.subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun ConceptCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Card(
        modifier = modifier,
        shape = ConceptCardShape,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .94f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .72f)),
        content = { content() },
    )
}

@Composable
private fun ConceptCardHead(title: String, meta: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        ConceptEyebrow(title, Modifier.weight(1f))
        Text(meta, color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace, fontSize = 9.sp, letterSpacing = .8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun ConceptEyebrow(value: String, modifier: Modifier = Modifier) {
    Text(value, modifier = modifier, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
}

@Composable
private fun StatusLine(label: String, value: String, ready: Boolean = true) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(6.dp).background(if (ready) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline, CircleShape))
        Spacer(Modifier.width(9.dp))
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, modifier = Modifier.weight(1f))
        Text(value, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun ConceptPill(label: String, color: Color) {
    Box(Modifier.background(color.copy(alpha = .12f), RoundedCornerShape(9.dp)).padding(horizontal = 8.dp, vertical = 5.dp)) {
        Text(label, color = color, fontSize = 9.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ConceptEmpty(title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.AutoAwesome, null, tint = MaterialTheme.colorScheme.primary.copy(alpha = .72f))
        Spacer(Modifier.height(9.dp))
        Text(title, fontWeight = FontWeight.SemiBold)
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
private fun ConceptPageEnter(content: @Composable () -> Unit) {
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
    AnimatedVisibility(
        visibleState = visible,
        enter = fadeIn(tween(420)) + slideInVertically(tween(420), initialOffsetY = { it / 18 }),
    ) {
        content()
    }
}

private fun conceptTime(timestamp: Long): String = DateTimeFormatter.ofPattern("HH:mm")
    .format(Instant.ofEpochMilli(timestamp).atZone(ZoneId.systemDefault()))
