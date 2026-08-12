package com.kllin.agnovexa.fieldos.presentation

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Engineering
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kllin.agnovexa.fieldos.R
import com.kllin.agnovexa.fieldos.core.ai.AiProviderPresets
import com.kllin.agnovexa.fieldos.core.ai.ModelLifecycleRegistry
import com.kllin.agnovexa.fieldos.core.ai.ModelLifecycleState
import com.kllin.agnovexa.fieldos.domain.AiProvider
import com.kllin.agnovexa.fieldos.domain.Project
import com.kllin.agnovexa.fieldos.domain.TechnologyCatalog
import com.kllin.agnovexa.fieldos.domain.ThemeMode
import com.kllin.agnovexa.fieldos.domain.ThemePreset
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlin.math.sin

private val DashboardShape = RoundedCornerShape(14.dp)

@Composable
fun PrototypeHomeScreen(state: FieldOsUiState, navigate: (String) -> Unit, viewModel: FieldOsViewModel) {
    val workspace = state.workspace
    val openTasks = workspace.tasks.count { it.status != "DONE" && it.status != "CANCELED" }
    val openIssues = workspace.issues.count { it.status != "RESOLVED" }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { BrandHeader() }
        item { WorkStatusCard(state.preferences.userName) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                DashboardMetric("今日任务", openTasks.toString(), "当前待办", Icons.Default.TaskAlt, Color(0xFF17DED3), Modifier.weight(1f))
                DashboardMetric("待处理", openIssues.toString(), "尚未解决", Icons.Default.WarningAmber, Color(0xFFFFB84D), Modifier.weight(1f))
                DashboardMetric("离线知识", workspace.knowledge.size.toString(), "本地条目", Icons.Default.Book, Color(0xFF9B6CFF), Modifier.weight(1f))
            }
        }
        item { ModuleGrid(navigate) }
        item {
            SectionHeading("最近项目", "全部项目") { navigate("projects") }
        }
        if (workspace.projects.isEmpty()) {
            item { EmptyProjectCard { navigate("projects") } }
        } else {
            items(workspace.projects.take(3), key = { it.id }) { project ->
                PrototypeProjectCard(project)
            }
        }
        item {
            SectionHeading("快捷操作", null, null)
            Spacer(Modifier.height(7.dp))
            BoxWithConstraints {
                val compact = maxWidth < 350.dp || LocalDensity.current.fontScale > 1.15f
                if (compact) Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    QuickAction("记录问题", "快速记录现场问题", Icons.Default.Edit, Color(0xFF17DED3), { navigate("records/issues") }, Modifier.fillMaxWidth())
                    QuickAction("新建日报", "创建、编辑或 AI 生成", Icons.AutoMirrored.Filled.Article, Color(0xFF27CFA0), { navigate("records/reports") }, Modifier.fillMaxWidth())
                    QuickAction("服务器", "管理远程连接信息", Icons.Default.Dns, Color(0xFF4A8DFF), { navigate("records/servers") }, Modifier.fillMaxWidth())
                } else Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickAction("记录问题", "快速记录现场问题", Icons.Default.Edit, Color(0xFF17DED3), { navigate("records/issues") }, Modifier.weight(1f))
                    QuickAction("新建日报", "创建或 AI 生成", Icons.AutoMirrored.Filled.Article, Color(0xFF27CFA0), { navigate("records/reports") }, Modifier.weight(1f))
                    QuickAction("服务器", "管理远程连接信息", Icons.Default.Dns, Color(0xFF4A8DFF), { navigate("records/servers") }, Modifier.weight(1f))
                }
            }
        }
        item {
            SectionHeading("最近活动", null, null)
            if (workspace.activities.isEmpty()) {
                Text("完成一次现场操作后，活动会自动汇总在这里。", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 14.dp))
            }
        }
        items(workspace.activities.take(5), key = { it.id }) { activity ->
            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.Top) {
                Box(Modifier.padding(top = 6.dp).size(7.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(activity.title, fontWeight = FontWeight.Medium)
                    Text(activity.description, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun BrandHeader() {
    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(62.dp).clip(RoundedCornerShape(16.dp)).background(Color(0xFF071522)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(painterResource(R.drawable.ic_launcher_foreground), null, tint = Color.Unspecified, modifier = Modifier.size(58.dp))
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text("Agnovexa Field OS", fontWeight = FontWeight.Bold, fontSize = 20.sp, letterSpacing = (-0.3).sp)
            Text("个人现场工作操作系统", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        }
        Box(Modifier.size(38.dp).border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .55f), CircleShape), contentAlignment = Alignment.Center) {
            Icon(Icons.Default.NotificationsNone, "通知", modifier = Modifier.size(22.dp))
            Box(Modifier.align(Alignment.TopEnd).size(8.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
        }
    }
}

@Composable
private fun WorkStatusCard(userName: String) {
    Card(
        shape = DashboardShape,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .7f), DashboardShape),
    ) {
        Box(Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(MaterialTheme.colorScheme.primary.copy(alpha = .13f), Color.Transparent)))) {
            TopographicPattern(seed = 13, color = MaterialTheme.colorScheme.primary, modifier = Modifier.matchParentSize())
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(54.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFF1D6E8F), Color(0xFF0B233A)))),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Default.Engineering, null, tint = Color.White, modifier = Modifier.size(32.dp)) }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("早上好，$userName", fontWeight = FontWeight.SemiBold, fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        Spacer(Modifier.width(8.dp))
                        Box(Modifier.size(7.dp).background(Color(0xFF1CE5BE), CircleShape))
                        Spacer(Modifier.width(4.dp))
                        Text("本机可用", color = Color(0xFF1CE5BE), fontSize = 11.sp, maxLines = 1)
                    }
                    Spacer(Modifier.height(5.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LocationOn, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                        Text(" 个人工作区  |  离线优先", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Cloud, null, tint = Color(0xFFBDE4FF), modifier = Modifier.size(23.dp))
                        Spacer(Modifier.width(5.dp)); Text("离线", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                    }
                    Text("核心功能无需网络", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                }
            }
        }
    }
}

@Composable
private fun DashboardMetric(title: String, value: String, delta: String, icon: ImageVector, accent: Color, modifier: Modifier) {
    Card(
        modifier = modifier.height(82.dp).border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .7f), DashboardShape),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = DashboardShape,
    ) {
        Column(Modifier.fillMaxSize().padding(8.dp), verticalArrangement = Arrangement.Center) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(30.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = .14f)).border(1.dp, accent.copy(alpha = .5f), RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
                    Icon(icon, null, tint = accent, modifier = Modifier.size(19.dp))
                }
                Spacer(Modifier.width(5.dp))
                Text(title, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                Text(value, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Spacer(Modifier.width(5.dp))
                Text(delta, color = accent, fontSize = 8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

private data class DashboardModule(val title: String, val subtitle: String, val icon: ImageVector, val route: String, val accent: Color)

@Composable
private fun ModuleGrid(navigate: (String) -> Unit) {
    val modules = listOf(
        DashboardModule("项目中心", "项目管理与进度", Icons.Default.FolderOpen, "projects", Color(0xFF1DE0D1)),
        DashboardModule("部署助手", "快速部署应用", Icons.Default.RocketLaunch, "records/commands", Color(0xFF4A9EFF)),
        DashboardModule("服务器", "连接与管理", Icons.Default.Dns, "records/servers", Color(0xFF42E78A)),
        DashboardModule("知识库", "文档与资料管理", Icons.Default.Book, "records/knowledge", Color(0xFF9B6CFF)),
        DashboardModule("AI 助手", "智能问答与分析", Icons.Default.SmartToy, "ai", Color(0xFF4ED7FF)),
        DashboardModule("日报", "日报记录与统计", Icons.AutoMirrored.Filled.Article, "records/reports", Color(0xFFFFB84D)),
        DashboardModule("命令库", "常用命令与脚本", Icons.Default.Terminal, "records/commands", Color(0xFF27D5C9)),
        DashboardModule("巡检", "设备巡检与上报", Icons.Default.VerifiedUser, "tools", Color(0xFF43A7FF)),
    )
    BoxWithConstraints {
        val columns = if (maxWidth < 370.dp || LocalDensity.current.fontScale > 1.15f) 2 else 4
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .84f)),
            shape = DashboardShape,
            modifier = Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .6f), DashboardShape),
        ) {
            Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                modules.chunked(columns).forEach { rowItems ->
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    rowItems.forEach { item ->
                        Card(
                            modifier = Modifier.weight(1f).height(if (columns == 2) 92.dp else 108.dp).clickable { navigate(item.route) },
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .45f)),
                            shape = RoundedCornerShape(11.dp),
                        ) {
                            Column(Modifier.fillMaxSize().padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                Box(Modifier.size(43.dp).clip(RoundedCornerShape(11.dp)).background(item.accent.copy(alpha = .12f)), contentAlignment = Alignment.Center) {
                                    Icon(item.icon, null, tint = item.accent, modifier = Modifier.size(28.dp))
                                }
                                Spacer(Modifier.height(7.dp))
                                Text(item.title, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(item.subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
        }
    }
    }
}

@Composable
private fun SectionHeading(title: String, action: String?, onAction: (() -> Unit)?) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
        if (action != null && onAction != null) {
            Row(Modifier.clickable(onClick = onAction).padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(action, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                Icon(Icons.AutoMirrored.Filled.ArrowForwardIos, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(12.dp))
            }
        }
    }
}

@Composable
private fun PrototypeProjectCard(project: Project) {
    val coverIndex = (project.id.hashCode() and Int.MAX_VALUE) % 6
    val accent = listOf(Color(0xFF14D7C9), Color(0xFF3D8DFF), Color(0xFFFFB84D), Color(0xFF8C72FF), Color(0xFF18C7A2), Color(0xFF31A7FF))[coverIndex]
    val cover = when (coverIndex) {
        0 -> R.drawable.project_cover_mountain
        1 -> R.drawable.project_cover_crystal
        2 -> R.drawable.project_cover_geology_map
        3 -> R.drawable.project_cover_core_tray
        4 -> R.drawable.project_cover_ore_body
        else -> R.drawable.project_cover_remote_sensing
    }
    Card(
        shape = DashboardShape,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth().heightIn(min = 104.dp).border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .75f), DashboardShape),
    ) {
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(MaterialTheme.colorScheme.surface, MaterialTheme.colorScheme.surface, accent.copy(alpha = .12f))))) {
            TopographicPattern(project.id.hashCode(), accent, Modifier.matchParentSize())
            Row(Modifier.fillMaxSize().padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(cover),
                    contentDescription = "${project.name} 封面",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(66.dp).clip(RoundedCornerShape(11.dp)).border(1.dp, accent.copy(alpha = .55f), RoundedCornerShape(11.dp)),
                )
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f)) {
                    Text(project.name, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LocationOn, null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(" ${project.location.ifBlank { "未填写地点" }}  |  更新于 ${relativeTime(project.updatedAt)}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Spacer(Modifier.height(7.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.heightIn(min = 24.dp).clip(RoundedCornerShape(6.dp)).background(accent.copy(alpha = .12f)).padding(horizontal = 8.dp, vertical = 4.dp), contentAlignment = Alignment.Center) {
                            Text(statusLabel(project.status), color = accent, fontSize = 9.sp, lineHeight = 12.sp, maxLines = 1, softWrap = false)
                        }
                        Spacer(Modifier.width(8.dp))
                        Box(Modifier.weight(1f).height(5.dp).clip(CircleShape).background(MaterialTheme.colorScheme.outline.copy(alpha = .55f))) {
                            Box(Modifier.fillMaxWidth((project.progress.coerceIn(0, 100) / 100f).coerceAtLeast(.02f)).height(5.dp).background(accent, CircleShape))
                        }
                        Spacer(Modifier.width(8.dp)); Text("${project.progress}%", fontSize = 10.sp)
                    }
                }
                Icon(Icons.AutoMirrored.Filled.ArrowForwardIos, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
            }
        }
    }
}

@Composable
private fun TopographicPattern(seed: Int, color: Color, modifier: Modifier) {
    Canvas(modifier) {
        repeat(7) { line ->
            val path = Path()
            val baseY = size.height * (.12f + line * .13f)
            path.moveTo(size.width * .42f, baseY)
            val phase = (seed % 19) * .17f + line * .63f
            for (step in 1..16) {
                val x = size.width * (.42f + step / 27f)
                val y = baseY + sin(step * .72f + phase) * size.height * (.04f + line * .003f)
                path.lineTo(x, y)
            }
            drawPath(path, color.copy(alpha = .08f + line * .009f), style = Stroke(width = 1.dp.toPx(), cap = StrokeCap.Round))
        }
        repeat(12) { dot ->
            drawCircle(color.copy(alpha = .09f), radius = 1.2.dp.toPx(), center = Offset(size.width * (.63f + (dot % 6) * .055f), size.height * (.2f + (dot / 6) * .42f)))
        }
    }
}

@Composable
private fun EmptyProjectCard(openProjects: () -> Unit) {
    Card(
        shape = DashboardShape,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth().clickable(onClick = openProjects).border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .7f), DashboardShape),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Add, null, tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(12.dp))
            Column { Text("创建第一个现场项目", fontWeight = FontWeight.SemiBold); Text("创建后会显示专属封面、状态和进度", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp) }
        }
    }
}

@Composable
private fun QuickAction(title: String, subtitle: String, icon: ImageVector, accent: Color, onClick: () -> Unit, modifier: Modifier) {
    Card(modifier.clickable(onClick = onClick), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(11.dp)) {
        Column(Modifier.height(76.dp).padding(9.dp), verticalArrangement = Arrangement.Center) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(30.dp).clip(RoundedCornerShape(8.dp)).background(accent.copy(alpha = .14f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = accent, modifier = Modifier.size(18.dp)) }
                Spacer(Modifier.width(7.dp)); Text(title, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, maxLines = 1)
            }
            Spacer(Modifier.height(4.dp)); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 8.sp, maxLines = 1)
        }
    }
}

@Composable
fun ConnectedAiScreen(state: FieldOsUiState, viewModel: FieldOsViewModel, openSearch: () -> Unit) {
    var prompt by remember { mutableStateOf("") }
    var editingProvider by remember { mutableStateOf<AiProvider?>(null) }
    var showProviderDialog by remember { mutableStateOf(false) }
    var showDeploymentContext by remember { mutableStateOf(false) }
    val selected = state.preferences.aiProviders.firstOrNull { it.id == state.preferences.selectedAiProviderId }
    val selectedBlocked = selected?.let(ModelLifecycleRegistry::inspect)?.isBlocked == true
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    "AGNOVEXA INTELLIGENCE",
                    color = MaterialTheme.colorScheme.primary,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    fontSize = 9.sp,
                    letterSpacing = 1.8.sp,
                )
                Spacer(Modifier.height(4.dp))
                Text("AI Agent，不只回答问题。", style = MaterialTheme.typography.headlineMedium)
                Text(
                    selected?.let { provider ->
                        if (selectedBlocked) "${provider.name} · ${provider.model} 已停用" else "${provider.name} · ${provider.model}"
                    } ?: "本地能力可用 · 配置 Provider 后启用流式对话",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            IconButton({ editingProvider = null; showProviderDialog = true }) { Icon(Icons.Default.Add, "添加 Provider") }
            IconButton(openSearch) { Icon(Icons.Default.Search, "本地搜索") }
        }
        Spacer(Modifier.height(10.dp))
        ProviderStrip(state, viewModel, onEdit = { editingProvider = it; showProviderDialog = true })
        Spacer(Modifier.height(10.dp))
        DeploymentContextCard(state.preferences.deploymentContext) { showDeploymentContext = true }
        Spacer(Modifier.height(10.dp))
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (state.aiMessages.isEmpty()) {
                item {
                    AiWelcomeCard(selected != null && !selectedBlocked, if (selected != null && !selectedBlocked) viewModel::askAiForDailyReport else null)
                }
            }
            items(state.aiMessages) { message ->
                ChatBubble(
                    role = message.role,
                    content = message.content,
                    onSaveCommand = if (message.role == "assistant") ({ viewModel.saveAiAsCommand(message.content) }) else null,
                    onSaveReport = if (message.role == "assistant") ({ viewModel.saveAiAsReport(message.content) }) else null,
                    onSaveKnowledge = if (message.role == "assistant") ({ viewModel.saveAiAsKnowledge(message.content) }) else null,
                )
            }
            if (state.aiStreamingText.isNotBlank()) item { ChatBubble("assistant", state.aiStreamingText) }
        }
        Row(verticalAlignment = Alignment.Bottom) {
            OutlinedTextField(
                value = prompt, onValueChange = { prompt = it }, modifier = Modifier.weight(1f),
                label = { Text(if (selected == null) "请先添加 Provider" else if (selectedBlocked) "当前模型已停用，请先修改" else "输入现场问题") },
                enabled = selected != null && !selectedBlocked && !state.busy, maxLines = 4,
            )
            Spacer(Modifier.width(8.dp))
            Button(
                onClick = { viewModel.sendAiMessage(prompt); prompt = "" },
                enabled = selected != null && !selectedBlocked && prompt.isNotBlank() && !state.busy,
                contentPadding = PaddingValues(12.dp),
            ) { Icon(Icons.AutoMirrored.Filled.Send, "发送") }
        }
        Text("AI 不会直接执行命令；模型建议需结合现场环境验证。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, modifier = Modifier.padding(top = 5.dp))
    }
    if (showProviderDialog) {
        ProviderEditorDialog(editingProvider, onDismiss = { showProviderDialog = false }) { provider, key ->
            viewModel.saveAiProvider(provider, key); showProviderDialog = false
        }
    }
    if (showDeploymentContext) {
        DeploymentContextDialog(
            existing = state.preferences.deploymentContext,
            onDismiss = { showDeploymentContext = false },
            onClear = { viewModel.clearDeploymentContext(); showDeploymentContext = false },
            onSave = { value -> viewModel.saveDeploymentContext(value); showDeploymentContext = false },
        )
    }
}

@Composable
private fun ProviderStrip(state: FieldOsUiState, viewModel: FieldOsViewModel, onEdit: (AiProvider) -> Unit) {
    val providers = state.preferences.aiProviders
    if (providers.isEmpty()) {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = DashboardShape) {
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Security, null, tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(9.dp))
                Text("API Key 仅以 Keystore 加密密文保存在本机", fontSize = 11.sp, modifier = Modifier.weight(1f))
            }
        }
        return
    }
    var providerMenu by remember(providers) { mutableStateOf(false) }
    val provider = providers.firstOrNull { it.id == state.preferences.selectedAiProviderId } ?: providers.first()
    val lifecycle = ModelLifecycleRegistry.inspect(provider)
    val blocked = lifecycle?.isBlocked == true
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = .09f)),
        shape = RoundedCornerShape(11.dp),
    ) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (provider.hasApiKey && !blocked) Icons.Default.CheckCircle else Icons.Default.WarningAmber,
                    null,
                    tint = if (provider.hasApiKey && !blocked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(provider.name, fontWeight = FontWeight.Medium, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(provider.model, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    lifecycle?.let {
                        Text(
                            it.userMessage,
                            color = if (it.isBlocked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 9.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
            if (providers.size > 1) {
                Box {
                    OutlinedButton({ providerMenu = true }, Modifier.fillMaxWidth()) {
                        Text("切换 Provider", Modifier.weight(1f), maxLines = 1)
                        Text("${providers.size} 个 ▾")
                    }
                    DropdownMenu(providerMenu, { providerMenu = false }) {
                        providers.forEach { item ->
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(item.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text(item.model, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                },
                                onClick = { viewModel.selectAiProvider(item.id); providerMenu = false },
                            )
                        }
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton({ viewModel.testAiProvider(provider) }, enabled = provider.hasApiKey && !blocked && !state.busy) { Text("测试连接") }
                Spacer(Modifier.weight(1f))
                IconButton({ onEdit(provider) }) { Icon(Icons.Default.Edit, "编辑 Provider") }
                IconButton({ viewModel.deleteAiProvider(provider.id) }) { Icon(Icons.Default.Delete, "删除 Provider") }
            }
        }
    }
}

@Composable
private fun AiWelcomeCard(online: Boolean, onDailyReport: (() -> Unit)? = null) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(26.dp), modifier = Modifier.fillMaxWidth()) {
        Box(
            Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        listOf(MaterialTheme.colorScheme.primary.copy(alpha = .12f), Color.Transparent, MaterialTheme.colorScheme.secondary.copy(alpha = .06f)),
                    ),
                ),
        ) {
            Column(Modifier.padding(20.dp)) {
                Box(
                    Modifier.size(50.dp).clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.primary.copy(alpha = .14f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.AutoAwesome, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(27.dp))
                }
                Spacer(Modifier.height(14.dp))
                Text(if (online) "把现场上下文交给 Agent" else "连接你的模型服务", fontWeight = FontWeight.SemiBold, fontSize = 21.sp)
                Spacer(Modifier.height(5.dp))
                Text(
                    if (online) "分析报错、解释命令、生成日报，并把结果保存回本地工作区。" else "支持 OpenAI-compatible Base URL、模型名、API Key、超时与流式响应；密钥只以加密密文保存在本机。",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp,
                )
                if (online && onDailyReport != null) {
                    Spacer(Modifier.height(8.dp))
                    AssistChip(onClick = onDailyReport, label = { Text("根据本地活动生成今日日报") }, leadingIcon = { Icon(Icons.AutoMirrored.Filled.Article, null, Modifier.size(16.dp)) })
                }
            }
        }
    }
}

@Composable
private fun ChatBubble(
    role: String,
    content: String,
    onSaveCommand: (() -> Unit)? = null,
    onSaveReport: (() -> Unit)? = null,
    onSaveKnowledge: (() -> Unit)? = null,
) {
    val user = role == "user"
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (user) Arrangement.End else Arrangement.Start) {
        Column(
            Modifier.fillMaxWidth(.86f).clip(RoundedCornerShape(14.dp)).background(if (user) MaterialTheme.colorScheme.primary.copy(alpha = .18f) else MaterialTheme.colorScheme.surface).padding(12.dp),
        ) {
            Text(content, fontSize = 13.sp)
            if (!user && (onSaveCommand != null || onSaveReport != null || onSaveKnowledge != null)) {
                Spacer(Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (content.contains("```") && onSaveCommand != null) item { AssistChip(onClick = onSaveCommand, label = { Text("入库命令", fontSize = 10.sp) }, leadingIcon = { Icon(Icons.Default.Terminal, null, Modifier.size(15.dp)) }) }
                    if (onSaveReport != null) item { AssistChip(onClick = onSaveReport, label = { Text("存为日报", fontSize = 10.sp) }) }
                    if (onSaveKnowledge != null) item { AssistChip(onClick = onSaveKnowledge, label = { Text("存为知识", fontSize = 10.sp) }) }
                }
            }
        }
    }
}

@Composable
private fun ProviderEditorDialog(existing: AiProvider?, onDismiss: () -> Unit, onSave: (AiProvider, String) -> Unit) {
    val now = System.currentTimeMillis()
    val initialPreset = remember(existing) {
        AiProviderPresets.all.firstOrNull { it.baseUrl.isNotBlank() && existing?.baseUrl?.startsWith(it.baseUrl) == true }
            ?: if (existing == null) AiProviderPresets.all.first() else AiProviderPresets.all.last()
    }
    var selectedPreset by remember(existing) { mutableStateOf(initialPreset) }
    var presetExpanded by remember { mutableStateOf(false) }
    var modelExpanded by remember { mutableStateOf(false) }
    var name by remember(existing) { mutableStateOf(existing?.name ?: initialPreset.name) }
    var baseUrl by remember(existing) { mutableStateOf(existing?.baseUrl ?: initialPreset.baseUrl) }
    var model by remember(existing) { mutableStateOf(existing?.model ?: initialPreset.models.firstOrNull().orEmpty()) }
    var apiKey by remember(existing) { mutableStateOf("") }
    var temperature by remember(existing) { mutableStateOf(existing?.temperature?.toString() ?: "0.3") }
    var timeout by remember(existing) { mutableStateOf(existing?.timeoutSeconds?.toString() ?: "60") }
    var streaming by remember(existing) { mutableStateOf(existing?.streamingEnabled ?: true) }
    val lifecycle = ModelLifecycleRegistry.inspect(baseUrl, model)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "添加 AI Provider" else "编辑 AI Provider") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    Text("服务预设", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                    Box {
                        OutlinedButton({ presetExpanded = true }, Modifier.fillMaxWidth()) { Text(selectedPreset.name, Modifier.weight(1f)); Text("▾") }
                        DropdownMenu(presetExpanded, { presetExpanded = false }) {
                            AiProviderPresets.all.forEach { preset ->
                                DropdownMenuItem(
                                    text = { Column { Text(preset.name); Text(preset.hint, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp) } },
                                    onClick = {
                                        selectedPreset = preset; presetExpanded = false; name = preset.name
                                        if (preset.baseUrl.isNotBlank()) baseUrl = preset.baseUrl
                                        preset.models.firstOrNull()?.let { model = it }
                                    },
                                )
                            }
                        }
                    }
                }
                item { OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text("名称") }, singleLine = true) }
                item { OutlinedTextField(baseUrl, { baseUrl = it }, Modifier.fillMaxWidth(), label = { Text("Base URL") }, singleLine = true, supportingText = { Text("可填根地址、/v1 或完整端点；HTTP 仅建议用于可信局域网") }) }
                if (selectedPreset.models.isNotEmpty()) item {
                    Box {
                        OutlinedButton({ modelExpanded = true }, Modifier.fillMaxWidth()) { Text("选择模型：$model", Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis); Text("▾") }
                        DropdownMenu(modelExpanded, { modelExpanded = false }) {
                            selectedPreset.models.forEach { modelId -> DropdownMenuItem(text = { Text(modelId) }, onClick = { model = modelId; modelExpanded = false }) }
                        }
                    }
                }
                item { OutlinedTextField(model, { model = it }, Modifier.fillMaxWidth(), label = { Text("模型 ID（可修改）") }, singleLine = true) }
                lifecycle?.let { snapshot ->
                    item {
                        Text(
                            snapshot.userMessage,
                            color = when (snapshot.lifecycleState) {
                                ModelLifecycleState.RETIRED -> MaterialTheme.colorScheme.error
                                ModelLifecycleState.DYNAMIC -> MaterialTheme.colorScheme.primary
                                ModelLifecycleState.ACTIVE -> MaterialTheme.colorScheme.onSurfaceVariant
                            },
                            fontSize = 10.sp,
                        )
                    }
                }
                item { OutlinedTextField(apiKey, { apiKey = it }, Modifier.fillMaxWidth(), label = { Text(if (existing?.hasApiKey == true) "API Key（留空则保持原值）" else "API Key") }, singleLine = true, visualTransformation = PasswordVisualTransformation()) }
                item {
                    BoxWithConstraints(Modifier.fillMaxWidth()) {
                        val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                        if (compact) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(temperature, { temperature = it }, Modifier.fillMaxWidth(), label = { Text("温度") }, singleLine = true)
                                OutlinedTextField(timeout, { timeout = it }, Modifier.fillMaxWidth(), label = { Text("超时/秒") }, singleLine = true)
                            }
                        } else {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(temperature, { temperature = it }, Modifier.weight(1f), label = { Text("温度") }, singleLine = true)
                                OutlinedTextField(timeout, { timeout = it }, Modifier.weight(1f), label = { Text("超时/秒") }, singleLine = true)
                            }
                        }
                    }
                }
                item { Row(verticalAlignment = Alignment.CenterVertically) { Text("流式响应", Modifier.weight(1f)); Switch(streaming, { streaming = it }) } }
                item { Text("密钥由 Android Keystore 加密，不会写入日志或备份。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp) }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        AiProvider(existing?.id ?: UUID.randomUUID().toString(), name, baseUrl, model, temperature.toDoubleOrNull() ?: .3, timeout.toIntOrNull() ?: 60, streaming, existing?.hasApiKey ?: false, existing?.createdAt ?: now, now),
                        apiKey,
                    )
                },
                enabled = name.isNotBlank() && baseUrl.isNotBlank() && model.isNotBlank() && lifecycle?.isBlocked != true && (existing?.hasApiKey == true || apiKey.isNotBlank()),
            ) { Text("保存") }
        },
        dismissButton = { TextButton(onDismiss) { Text("取消") } },
    )
}

@Composable
fun ProfileSettingsScreen(state: FieldOsUiState, viewModel: FieldOsViewModel) {
    var editingTheme by remember { mutableStateOf<ThemePreset?>(null) }
    val themeImport = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? -> uri?.let(viewModel::importTheme) }
    val exportBackup = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri -> uri?.let(viewModel::exportBackup) }
    val restoreBackup = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let(viewModel::restoreBackup) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("我的", fontWeight = FontWeight.Bold, fontSize = 24.sp); Text("外观、AI 与本地数据", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp) }
        item {
            SettingsSection("外观主题", Icons.Default.Palette) {
                Text("明暗模式", fontWeight = FontWeight.Medium)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf(ThemeMode.SYSTEM to "跟随系统", ThemeMode.DARK to "深色", ThemeMode.LIGHT to "浅色").forEach { (mode, label) ->
                        item(mode) { FilterChip(selected = state.preferences.themeMode == mode, onClick = { viewModel.setThemeMode(mode) }, label = { Text(label, fontSize = 11.sp) }) }
                    }
                }
                HorizontalDivider(Modifier.padding(vertical = 5.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text("已上传主题", fontWeight = FontWeight.Medium); Text("JSON 主题支持保存、切换、编辑和删除", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp) }
                    Button({ themeImport.launch(arrayOf("application/json", "text/plain")) }) { Icon(Icons.Default.Add, null, Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text("上传") }
                }
                if (state.preferences.themePresets.isEmpty()) Text("还没有自定义主题，可上传符合格式的 JSON 文件。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp))
                state.preferences.themePresets.forEach { preset ->
                    ThemePresetRow(preset, preset.id == state.preferences.selectedThemeId && state.preferences.themeMode == ThemeMode.CUSTOM, { viewModel.selectTheme(preset.id) }, { editingTheme = preset }, { viewModel.deleteTheme(preset.id) })
                }
            }
        }
        item {
            SettingsSection("AI 接口", Icons.Default.Hub) {
                Text("已配置 ${state.preferences.aiProviders.size} 个 Provider。请在底部“AI”页面添加、测试、编辑和切换。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Security, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(7.dp)); Text("API Key 由 Android Keystore 加密", fontSize = 11.sp) }
            }
        }
        item {
            SettingsSection("本地备份", Icons.Default.Backup) {
                Text("备份不包含 API Key、密码和私钥。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 9.dp)) {
                    val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                    if (compact) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton({ exportBackup.launch("AgnovexaBackup.zip") }, Modifier.fillMaxWidth()) { Icon(Icons.Default.Backup, null); Spacer(Modifier.width(5.dp)); Text("导出") }
                            OutlinedButton({ restoreBackup.launch(arrayOf("application/zip")) }, Modifier.fillMaxWidth()) { Icon(Icons.Default.Restore, null); Spacer(Modifier.width(5.dp)); Text("恢复") }
                        }
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton({ exportBackup.launch("AgnovexaBackup.zip") }, Modifier.weight(1f)) { Icon(Icons.Default.Backup, null); Spacer(Modifier.width(5.dp)); Text("导出") }
                            OutlinedButton({ restoreBackup.launch(arrayOf("application/zip")) }, Modifier.weight(1f)) { Icon(Icons.Default.Restore, null); Spacer(Modifier.width(5.dp)); Text("恢复") }
                        }
                    }
                }
            }
        }
        item { Text("Agnovexa Field OS · 本地优先个人版", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)) }
    }
    editingTheme?.let { preset ->
        ThemeEditorDialog(preset, { editingTheme = null }) { json -> viewModel.updateTheme(preset.id, json); editingTheme = null }
    }
}

@Composable
private fun SettingsSection(title: String, icon: ImageVector, content: @Composable ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = DashboardShape, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) { Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)); Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp) }
            Spacer(Modifier.height(3.dp)); content()
        }
    }
}

@Composable
private fun ThemePresetRow(preset: ThemePreset, selected: Boolean, onSelect: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(top = 8.dp).clip(RoundedCornerShape(10.dp)).background(if (selected) MaterialTheme.colorScheme.primary.copy(alpha = .11f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .38f)).clickable(onClick = onSelect).padding(9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row {
            listOf(preset.tokens.primary, preset.tokens.secondary, preset.tokens.background).forEach { value -> Box(Modifier.size(17.dp).background(Color(value), CircleShape).border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)) }
        }
        Spacer(Modifier.width(9.dp)); Column(Modifier.weight(1f)) { Text(preset.tokens.name, fontWeight = FontWeight.Medium, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis); Text(if (selected) "正在使用" else "点击切换", color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp) }
        IconButton(onEdit, Modifier.size(32.dp)) { Icon(Icons.Default.Edit, "编辑", Modifier.size(17.dp)) }
        IconButton(onDelete, Modifier.size(32.dp)) { Icon(Icons.Default.Delete, "删除", Modifier.size(17.dp)) }
    }
}

@Composable
private fun ThemeEditorDialog(preset: ThemePreset, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var json by remember(preset.id) { mutableStateOf(preset.sourceJson) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("编辑主题 · ${preset.tokens.name}") },
        text = { OutlinedTextField(json, { json = it }, label = { Text("主题 JSON") }, minLines = 12, maxLines = 18, modifier = Modifier.fillMaxWidth()) },
        confirmButton = { Button({ onSave(json) }) { Text("保存修改") } },
        dismissButton = { TextButton(onDismiss) { Text("取消") } },
    )
}

private fun relativeTime(timestamp: Long): String {
    val hours = ((System.currentTimeMillis() - timestamp).coerceAtLeast(0) / 3_600_000)
    return when {
        hours < 1 -> "刚刚"
        hours < 24 -> "${hours}小时"
        else -> DateTimeFormatter.ofPattern("MM-dd").format(Instant.ofEpochMilli(timestamp).atZone(ZoneId.systemDefault()))
    }
}

private fun statusLabel(status: String) = when (status) {
    "ACTIVE" -> "进行中"
    "PLANNING" -> "规划中"
    "PAUSED" -> "已暂停"
    "COMPLETED" -> "已完成"
    else -> status
}

@Composable
fun TechnologyBrandPanel(state: FieldOsUiState, onEditProject: () -> Unit) {
    val projects = state.workspace.projects
    var projectId by remember(projects) { mutableStateOf(projects.firstOrNull()?.id) }
    var projectMenuExpanded by remember { mutableStateOf(false) }
    val project = projects.firstOrNull { it.id == projectId } ?: projects.firstOrNull()
    val selectedIds = project?.let { state.workspace.projectTechnologyIds[it.id].orEmpty() }.orEmpty()
    val selected = TechnologyCatalog.selectedOptions(selectedIds)
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = DashboardShape) {
        Column(Modifier.padding(12.dp)) {
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("项目技术基线", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text("运维页只读展示，修改请进入项目编辑", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = if (compact) 2 else 1, overflow = TextOverflow.Ellipsis)
                    }
                    if (compact) {
                        IconButton(onEditProject) { Icon(Icons.Default.Edit, "编辑项目") }
                    } else {
                        TextButton(onEditProject) { Text("编辑项目") }
                    }
                }
            }
            Spacer(Modifier.height(7.dp))
            if (project == null) {
                Text("请先创建项目，再为项目配置技术栈。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                return@Column
            }
            Box {
                OutlinedButton({ projectMenuExpanded = true }, Modifier.fillMaxWidth()) {
                    Text("当前项目：${project.name}", Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("▾")
                }
                DropdownMenu(projectMenuExpanded, { projectMenuExpanded = false }) {
                    projects.forEach { item ->
                        DropdownMenuItem(text = { Text(item.name) }, onClick = { projectId = item.id; projectMenuExpanded = false })
                    }
                }
            }
            Spacer(Modifier.height(9.dp))
            if (selected.isEmpty()) {
                Text("该项目尚未配置技术栈。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
            } else {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(selected, key = { it.id }) { technology ->
                        val accent = technologyAccent(technology.id)
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(76.dp)) {
                            Box(Modifier.size(44.dp).clip(RoundedCornerShape(11.dp)).background(accent.copy(alpha = .14f)).border(1.dp, accent.copy(alpha = .6f), RoundedCornerShape(11.dp)), contentAlignment = Alignment.Center) {
                                TechnologyIcon(technology.id, technology.name, Modifier.size(26.dp))
                            }
                            Spacer(Modifier.height(5.dp))
                            Text(technology.name, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    }
}
