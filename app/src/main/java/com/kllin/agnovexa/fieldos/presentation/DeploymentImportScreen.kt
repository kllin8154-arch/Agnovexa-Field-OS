package com.kllin.agnovexa.fieldos.presentation

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Architecture
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kllin.agnovexa.fieldos.domain.CommandRiskClassifier
import com.kllin.agnovexa.fieldos.domain.DeploymentContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeploymentImportScreen(state: FieldOsUiState, viewModel: FieldOsViewModel, onBack: () -> Unit, onOpenNavigation: (() -> Unit)? = null) {
    val draft = state.deploymentImportDraft
    var projectMenu by remember { mutableStateOf(false) }
    var projectId by remember(draft) { mutableStateOf<String?>(null) }
    var importCommands by remember(draft) { mutableStateOf(draft?.commands?.isNotEmpty() == true) }
    var mergeContext by remember(draft) { mutableStateOf(draft?.context?.completedFields?.let { it > 0 } == true) }
    var showRaw by remember(draft) { mutableStateOf(false) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) viewModel.previewDeploymentDocument(uri)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("导入部署文档", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    if (onOpenNavigation != null) IconButton(onOpenNavigation) { Icon(Icons.Default.Menu, "打开功能栏") }
                    else IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.UploadFile, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
                            Spacer(Modifier.size(9.dp))
                            Column(Modifier.weight(1f)) {
                                Text("接收电脑 AI Agent 的部署成果", fontWeight = FontWeight.SemiBold)
                                Text("先本地解析预览，再由你确认入库", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                            }
                        }
                        Text(
                            "支持 UTF-8/GB18030 编码的 .md、.markdown、.txt、.json，单文件不超过 2 MB。文档中的代码块可以同时导入命令库。",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp,
                        )
                        OutlinedButton(
                            onClick = { picker.launch(arrayOf("text/plain", "text/markdown", "application/json", "application/octet-stream")) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(Icons.Default.Description, null)
                            Spacer(Modifier.size(7.dp))
                            Text(if (draft == null) "选择部署文档" else "重新选择文档")
                        }
                    }
                }
            }

            if (draft == null) {
                item { ImportGuidance() }
            } else {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = .08f)),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .35f)),
                    ) {
                        Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(draft.title, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(draft.sourceName, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                            Text(
                                "原文 ${draft.rawContent.length} 字符 · 现场字段 ${draft.context.completedFields}/10 · 命令 ${draft.commands.size} 条",
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 10.sp,
                            )
                        }
                    }
                }
                items(draft.warnings) { warning ->
                    Row(verticalAlignment = Alignment.Top) {
                        Icon(Icons.Default.WarningAmber, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(7.dp))
                        Text(warning, color = MaterialTheme.colorScheme.error, fontSize = 11.sp)
                    }
                }
                item {
                    ImportSection("关联项目") {
                        Box {
                            OutlinedButton({ projectMenu = true }, Modifier.fillMaxWidth()) {
                                Text(state.workspace.projects.firstOrNull { it.id == projectId }?.name ?: "不关联项目", Modifier.weight(1f), maxLines = 1)
                            }
                            DropdownMenu(projectMenu, { projectMenu = false }) {
                                DropdownMenuItem(text = { Text("不关联项目") }, onClick = { projectId = null; projectMenu = false })
                                state.workspace.projects.forEach { project ->
                                    DropdownMenuItem(text = { Text(project.name) }, onClick = { projectId = project.id; projectMenu = false })
                                }
                            }
                        }
                    }
                }
                item {
                    ImportSection("入库选项") {
                        ToggleRow(
                            "合并到现场部署信息",
                            "只填补现有资料的空白字段，不覆盖手工内容",
                            mergeContext,
                            draft.context.completedFields > 0,
                        ) { mergeContext = it }
                        ToggleRow(
                            "导入识别到的命令",
                            "命令将进入风险分类，执行前仍需人工核对",
                            importCommands,
                            draft.commands.isNotEmpty(),
                        ) { importCommands = it }
                    }
                }
                if (draft.context.completedFields > 0) {
                    item {
                        ImportSection("识别到的现场信息") {
                            ContextPreview(draft.context)
                        }
                    }
                }
                if (draft.commands.isNotEmpty()) {
                    item { Text("识别到的命令", fontWeight = FontWeight.SemiBold) }
                    items(draft.commands.take(8)) { command ->
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                            Column(Modifier.padding(11.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Terminal, null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(19.dp))
                                    Spacer(Modifier.size(7.dp))
                                    Text(command.title, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(CommandRiskClassifier.classify(command.command), color = MaterialTheme.colorScheme.error, fontSize = 9.sp)
                                }
                                Text(command.command, fontFamily = FontFamily.Monospace, fontSize = 10.sp, maxLines = 5, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                    if (draft.commands.size > 8) item { Text("另有 ${draft.commands.size - 8} 条命令将在确认后入库", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp) }
                }
                item {
                    ImportSection("原文预览") {
                        TextButton({ showRaw = !showRaw }) { Text(if (showRaw) "收起原文" else "展开原文") }
                        if (showRaw) Text(draft.rawContent.take(6000), fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                    }
                }
                item {
                    Button(
                        onClick = { viewModel.importDeploymentDocument(projectId, importCommands, mergeContext) },
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                        enabled = !state.busy,
                    ) { Text("确认入库") }
                }
                item {
                    TextButton({ viewModel.clearDeploymentImportDraft() }, Modifier.fillMaxWidth()) { Text("放弃本次导入") }
                }
            }
        }
    }
}

@Composable
private fun ImportGuidance() {
    ImportSection("推荐的电脑 AI Agent 输出结构") {
        Text("使用 Markdown 标题组织：部署目标、服务器架构、操作系统、服务器拓扑、网络条件、安装目录、文件与服务、运行时与版本、备份与回退、风险与限制。", fontSize = 11.sp)
        Text("命令请放进 ```bash 或 ```powershell 代码块，App 会识别并允许单独入库。", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
    }
}

@Composable
private fun ImportSection(title: String, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            content()
        }
    }
}

@Composable
private fun ToggleRow(title: String, subtitle: String, checked: Boolean, enabled: Boolean, change: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 12.sp)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp)
        }
        Switch(checked = checked, onCheckedChange = change, enabled = enabled)
    }
}

@Composable
private fun ContextPreview(context: DeploymentContext) {
    val rows = listOf(
        "现场/项目" to context.siteName,
        "部署目标" to context.deploymentGoal,
        "架构" to context.architecture,
        "操作系统" to context.operatingSystems,
        "服务器拓扑" to context.serverTopology,
        "网络条件" to context.networkAccess,
        "目标目录" to context.baseDirectory,
        "文件与服务" to context.filesAndServices,
        "运行时与版本" to context.runtimeAndVersions,
        "数据与回退" to context.dataAndBackup,
        "限制" to context.constraints,
    ).filter { it.second.isNotBlank() }
    rows.forEach { (label, value) ->
        Row(verticalAlignment = Alignment.Top) {
            Icon(Icons.Default.Architecture, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.size(6.dp))
            Column {
                Text(label, color = MaterialTheme.colorScheme.primary, fontSize = 9.sp)
                Text(value, fontSize = 11.sp, maxLines = 5, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
