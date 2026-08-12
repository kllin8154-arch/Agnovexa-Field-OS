package com.kllin.agnovexa.fieldos.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Architecture
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kllin.agnovexa.fieldos.domain.DeploymentContext

@Composable
fun DeploymentContextCard(value: DeploymentContext, onClick: () -> Unit) {
    val progress = value.completedFields / 10f
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(12.dp),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(38.dp).clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.secondary.copy(alpha = .14f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.Architecture, null, tint = MaterialTheme.colorScheme.secondary)
            }
            Spacer(Modifier.size(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("现场部署信息", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    Text("${value.completedFields}/10", color = MaterialTheme.colorScheme.primary, fontSize = 10.sp)
                }
                Text(
                    if (value.isEmpty) "填写后 AI 会基于现场事实回答；缺失信息会先反问"
                    else value.siteName.ifBlank { "已保存本机现场上下文，点击修改" },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 9.sp,
                )
                Spacer(Modifier.height(6.dp))
                Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(MaterialTheme.colorScheme.outline.copy(alpha = .22f))) {
                    Box(
                        Modifier.fillMaxWidth(progress.coerceIn(0f, 1f)).height(4.dp)
                            .background(if (progress >= .7f) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary),
                    )
                }
            }
            Icon(Icons.Default.ChevronRight, "编辑现场部署信息", tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun DeploymentContextDialog(
    existing: DeploymentContext,
    onDismiss: () -> Unit,
    onClear: () -> Unit,
    onSave: (DeploymentContext) -> Unit,
) {
    var siteName by remember(existing) { mutableStateOf(existing.siteName) }
    var goal by remember(existing) { mutableStateOf(existing.deploymentGoal) }
    var architecture by remember(existing) { mutableStateOf(existing.architecture) }
    var systems by remember(existing) { mutableStateOf(existing.operatingSystems) }
    var topology by remember(existing) { mutableStateOf(existing.serverTopology) }
    var network by remember(existing) { mutableStateOf(existing.networkAccess) }
    var baseDirectory by remember(existing) { mutableStateOf(existing.baseDirectory) }
    var filesAndServices by remember(existing) { mutableStateOf(existing.filesAndServices) }
    var runtimes by remember(existing) { mutableStateOf(existing.runtimeAndVersions) }
    var dataAndBackup by remember(existing) { mutableStateOf(existing.dataAndBackup) }
    var constraints by remember(existing) { mutableStateOf(existing.constraints) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("现场部署信息") },
        text = {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(9.dp),
                contentPadding = PaddingValues(bottom = 4.dp),
            ) {
                item {
                    Text(
                        "仅保存环境事实，不要填写密码、API Key、私钥或其他秘密。空白项在需要时由 AI 先询问。",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp,
                    )
                }
                item { ContextField(siteName, { siteName = it }, "现场/项目名称（可选）", "如：湘南地质一张图") }
                item { ContextField(goal, { goal = it }, "本次部署目标", "要部署什么、规模和期望结果", 3) }
                item {
                    Text("CPU/服务器架构", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        items(listOf("x86_64", "ARM64", "混合架构")) { preset ->
                            FilterChip(selected = architecture == preset, onClick = { architecture = preset }, label = { Text(preset) })
                        }
                    }
                    ContextField(architecture, { architecture = it }, "架构补充", "如：鲲鹏 920 / 4 台 ARM64")
                }
                item { ContextField(systems, { systems = it }, "操作系统", "发行版、版本、内核，如：麒麟 V10 SP3", 2) }
                item { ContextField(topology, { topology = it }, "服务器拓扑与角色", "节点数量、IP/主机占位名、角色和高可用关系", 3) }
                item { ContextField(network, { network = it }, "网络与离线条件", "是否可访问外网、代理、端口、防火墙、DNS", 3) }
                item { ContextField(baseDirectory, { baseDirectory = it }, "目标根目录", "如：/opt/field-os；没有则写待规划") }
                item { ContextField(filesAndServices, { filesAndServices = it }, "文件、目录与服务规划", "配置文件、数据目录、日志目录、systemd/容器服务", 4) }
                item { ContextField(runtimes, { runtimes = it }, "技术栈、运行时与版本", "JDK、Docker、数据库、中间件及准确版本", 3) }
                item { ContextField(dataAndBackup, { dataAndBackup = it }, "数据与备份/回退条件", "数据位置、备份窗口、恢复点和可接受停机时间", 3) }
                item { ContextField(constraints, { constraints = it }, "现场限制与补充", "权限、磁盘、内存、合规、维护窗口等", 3) }
            }
        },
        dismissButton = {
            Row {
                if (!existing.isEmpty) {
                    TextButton(onClick = onClear) {
                        Icon(Icons.Default.DeleteOutline, null, Modifier.size(17.dp))
                        Spacer(Modifier.size(4.dp))
                        Text("清空")
                    }
                }
                TextButton(onClick = onDismiss) { Text("取消") }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        DeploymentContext(
                            siteName = siteName,
                            deploymentGoal = goal,
                            architecture = architecture,
                            operatingSystems = systems,
                            serverTopology = topology,
                            networkAccess = network,
                            baseDirectory = baseDirectory,
                            filesAndServices = filesAndServices,
                            runtimeAndVersions = runtimes,
                            dataAndBackup = dataAndBackup,
                            constraints = constraints,
                            updatedAt = existing.updatedAt,
                        ),
                    )
                },
            ) { Text("保存") }
        },
    )
}

@Composable
private fun ContextField(value: String, onChange: (String) -> Unit, label: String, hint: String, lines: Int = 1) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        placeholder = { Text(hint, fontSize = 10.sp) },
        minLines = lines,
        maxLines = (lines + 2).coerceAtLeast(3),
        singleLine = lines == 1,
    )
}
