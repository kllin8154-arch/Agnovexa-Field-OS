package com.kllin.agnovexa.fieldos.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Architecture
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kllin.agnovexa.fieldos.domain.DeploymentExampleCatalog
import com.kllin.agnovexa.fieldos.domain.DeploymentExampleStage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeploymentExampleScreen(
    state: FieldOsUiState,
    viewModel: FieldOsViewModel,
    onOpenNavigation: (() -> Unit)?,
    navigate: (String) -> Unit,
) {
    val installed = DeploymentExampleCatalog.isInstalled(state.workspace)
    var expandedStage by remember { mutableIntStateOf(1) }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("部署示例", fontWeight = FontWeight.Bold)
                        Text("脱敏、离线、可导入", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                    }
                },
                navigationIcon = {
                    onOpenNavigation?.let { open -> IconButton(open) { Icon(Icons.Default.Menu, "打开功能栏") } }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .35f)),
                    shape = RoundedCornerShape(18.dp),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Architecture, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
                            Spacer(Modifier.size(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text("国产化服务平台离线部署闭环", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                                Text("银河麒麟 ARM · Java 8/17 · NGINX · Redis · KingbaseES · GIS", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                            }
                        }
                        Text(
                            "示例来自历史部署经验的重新建模，不包含原项目名称、真实 IP、域名、账号、密码、密钥或私有文件路径。所有 {{变量}} 都必须由用户在现场核对后填写。",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        if (installed) {
                            OutlinedButton(onClick = { navigate("projects") }, modifier = Modifier.fillMaxWidth()) {
                                Icon(Icons.Default.CheckCircle, null)
                                Spacer(Modifier.size(7.dp))
                                Text("已载入工作区，打开示例项目")
                            }
                        } else {
                            Button(onClick = viewModel::installDeploymentExample, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
                                Icon(Icons.Default.FolderOpen, null)
                                Spacer(Modifier.size(7.dp))
                                Text("载入完整示例到工作区")
                            }
                        }
                    }
                }
            }
            item { ExampleArchitecture() }
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("7 个闭环阶段", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("一次只展开一个阶段，避免页面过长", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                    }
                    Text("01—07", color = MaterialTheme.colorScheme.primary, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                }
            }
            items(DeploymentExampleCatalog.stages, key = DeploymentExampleStage::number) { stage ->
                ExampleStageCard(
                    stage = stage,
                    expanded = expandedStage == stage.number,
                    onToggle = { expandedStage = if (expandedStage == stage.number) 0 else stage.number },
                )
            }
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
                        Icon(Icons.Default.WarningAmber, null, tint = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.size(9.dp))
                        Column {
                            Text("使用边界", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onErrorContainer)
                            Text(
                                "示例用于学习工作流和记录方式，不是可直接执行的生产脚本。执行任何命令前必须核对架构、路径、端口、权限、备份和回退方案。",
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                fontSize = 11.sp,
                            )
                        }
                    }
                }
            }
            item {
                OutlinedButton(onClick = { navigate("tools") }, modifier = Modifier.fillMaxWidth()) {
                    Text("前往运维模块查看闭环数据")
                    Spacer(Modifier.weight(1f))
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null)
                }
            }
        }
    }
}

@Composable
private fun ExampleArchitecture() {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(14.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Storage, null, tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.size(8.dp))
                Text("示例节点与数据流", fontWeight = FontWeight.Bold)
            }
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val compact = FieldLayoutPolicy.isCompact(maxWidth.value, LocalDensity.current.fontScale)
                val nodes = listOf(
                    "边界代理\n{{edge_gateway_ip}}",
                    "应用与缓存\n{{app_node_ip}}",
                    "数据与检索\n{{data_node_ip}}",
                    "GIS 服务\n{{gis_node_ip}}",
                )
                if (compact) {
                    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        nodes.forEach { node -> ExampleNode(node, Modifier.fillMaxWidth()) }
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        nodes.chunked(2).forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                                row.forEach { node -> ExampleNode(node, Modifier.weight(1f)) }
                            }
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Security, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(7.dp))
                Text("外部流量经代理逐跳进入；数据节点不直接暴露公网", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun ExampleNode(label: String, modifier: Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant), shape = RoundedCornerShape(10.dp)) {
        Text(label, modifier = Modifier.padding(11.dp), fontFamily = FontFamily.Monospace, fontSize = 10.sp)
    }
}

@Composable
private fun ExampleStageCard(stage: DeploymentExampleStage, expanded: Boolean, onToggle: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onToggle),
        colors = CardDefaults.cardColors(containerColor = if (expanded) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, if (expanded) MaterialTheme.colorScheme.primary.copy(alpha = .45f) else MaterialTheme.colorScheme.outline.copy(alpha = .55f)),
        shape = RoundedCornerShape(13.dp),
    ) {
        Column(Modifier.padding(horizontal = 13.dp, vertical = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stage.number.toString().padStart(2, '0'), color = MaterialTheme.colorScheme.primary, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                Spacer(Modifier.size(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(stage.title, fontWeight = FontWeight.SemiBold)
                    Text(stage.module, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp)
                }
                Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore, if (expanded) "收起阶段" else "展开阶段")
            }
            AnimatedVisibility(expanded) {
                Column(Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .55f))
                    Text(stage.objective, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                    stage.checks.forEach { check ->
                        Row(verticalAlignment = Alignment.Top) {
                            Icon(Icons.Default.CheckCircle, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 1.dp).size(16.dp))
                            Spacer(Modifier.size(7.dp))
                            Text(check, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}
