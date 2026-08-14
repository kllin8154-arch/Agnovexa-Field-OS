package com.kllin.agnovexa.fieldos.domain

data class DeploymentExampleStage(
    val number: Int,
    val title: String,
    val module: String,
    val objective: String,
    val checks: List<String>,
)

data class DeploymentExampleBundle(
    val project: Project,
    val technologyIds: Set<String>,
    val tasks: List<FieldTask>,
    val issues: List<Issue>,
    val servers: List<Server>,
    val commands: List<Command>,
    val knowledge: List<Knowledge>,
    val activities: List<Activity>,
    val report: DailyReport,
)

object DeploymentExampleCatalog {
    const val PROJECT_ID = "example-kylin-arm-platform-v1"

    val stages = listOf(
        DeploymentExampleStage(1, "确认范围与变量", "项目", "先确定节点角色、架构、端口、目录和回退边界，不在文档中保存凭据。", listOf("完成变量清单", "确认 ARM/aarch64 软件包", "建立变更与回退窗口")),
        DeploymentExampleStage(2, "准备离线基础环境", "任务 · 命令", "挂载银河麒麟安装介质，建立本地软件源并完成系统基线检查。", listOf("系统与 CPU 架构匹配", "软件源仅指向本地介质", "磁盘、时间和依赖满足要求")),
        DeploymentExampleStage(3, "安装运行时与中间件", "服务器", "按服务隔离 Java 8/17，部署 NGINX、Redis、RabbitMQ 等基础组件。", listOf("每个服务固定 JAVA_HOME", "systemd 状态正常", "NGINX 编译包含 stream 模块")),
        DeploymentExampleStage(4, "部署数据与 GIS 服务", "服务器 · 任务", "部署 KingbaseES、MinIO、Elasticsearch 与 GeoServer，先数据后应用。", listOf("恢复前已完成备份", "目录权限正确", "内部健康检查通过")),
        DeploymentExampleStage(5, "发布应用与代理链路", "命令 · 问题", "发布应用包，校验 NGINX 配置后再重载，并逐跳验证代理链路。", listOf("配置语法检查通过", "端口仅按白名单开放", "内外网逐跳验证")),
        DeploymentExampleStage(6, "处理问题并沉淀知识", "问题 · 知识", "记录现象、原因、方案和验证结果，将可复用结论转为知识。", listOf("问题状态已关闭", "验证命令有明确结果", "知识不包含现场敏感值")),
        DeploymentExampleStage(7, "验收、日报与回退", "日报 · 备份", "完成服务、端口、日志、备份恢复和回退演练，形成可复核日报。", listOf("核心服务全部可用", "备份文件可读取", "回退步骤经过演练")),
    )

    fun isInstalled(workspace: WorkspaceSnapshot): Boolean = workspace.projects.any { it.id == PROJECT_ID }

    fun create(now: Long = System.currentTimeMillis()): DeploymentExampleBundle {
        val day = 86_400_000L
        val project = Project(
            id = PROJECT_ID,
            name = "示例｜国产化服务平台离线部署",
            code = "DEMO-KYLIN-ARM",
            description = "从历史部署实践中提炼的脱敏闭环：环境确认、离线源、组件部署、代理验证、问题复盘、知识沉淀、日报与回退。所有地址和账号均为变量。",
            status = "COMPLETED",
            progress = 100,
            location = "示例环境（非真实现场）",
            createdAt = now - 7 * day,
            updatedAt = now,
        )
        val technologyIds = setOf(
            TechnologyCatalog.idForInput("银河麒麟 V10 SP3 64位 ARM/aarch64"),
            TechnologyCatalog.idForInput("OpenJDK 8u301"),
            TechnologyCatalog.idForInput("OpenJDK 17"),
            TechnologyCatalog.idForInput("NGINX 1.24.0（stream）"),
            TechnologyCatalog.idForInput("Redis 6.2"),
            TechnologyCatalog.idForInput("KingbaseES"),
            TechnologyCatalog.idForInput("MinIO"),
            TechnologyCatalog.idForInput("Elasticsearch 7.12"),
            TechnologyCatalog.idForInput("GeoServer 2.21"),
            TechnologyCatalog.idForInput("RabbitMQ"),
            TechnologyCatalog.idForInput("Podman"),
        )
        val servers = listOf(
            server("edge", "边界代理节点", "{{edge_gateway_ip}}", "NGINX HTTP/TCP 代理；仅开放审批后的入口端口", now - 6 * day, now),
            server("app", "应用与缓存节点", "{{app_node_ip}}", "Java 17 业务服务、Redis、RabbitMQ", now - 5 * day, now),
            server("data", "数据与检索节点", "{{data_node_ip}}", "KingbaseES、MinIO、Elasticsearch；不直接暴露公网", now - 4 * day, now),
            server("gis", "GIS 服务节点", "{{gis_node_ip}}", "Java 8 与 GeoServer 独立运行", now - 3 * day, now),
        )
        val tasks = stages.mapIndexed { index, stage ->
            FieldTask(
                id = "$PROJECT_ID-task-${stage.number}",
                projectId = PROJECT_ID,
                title = stage.title,
                description = "${stage.objective}\n验收：${stage.checks.joinToString("；")}",
                status = "DONE",
                priority = if (index in 3..4) "P1" else "P2",
                createdAt = now - (7 - index) * day,
                updatedAt = now - (6 - index).coerceAtLeast(0) * day,
            )
        }
        val issues = listOf(
            issue("nginx-stream", "NGINX 无法识别 stream 指令", "执行配置校验时提示 unknown directive stream。", "构建 NGINX 时未启用 stream 模块。", "重新使用 --with-stream 与 --with-stream_ssl_module 编译，替换前保留旧二进制和配置。", "{{nginx_bin}} -V 看到 stream 参数，且 {{nginx_bin}} -t 返回 successful。", "edge", now - 3 * day, now),
            issue("minio-user", "MinIO 服务启动后立即退出", "systemd 返回 status=1，数据目录无法写入。", "服务账号未创建或数据目录归属不正确。", "创建专用系统账号，修正数据目录 owner，并再次检查 EnvironmentFile。", "systemctl is-active minio 返回 active，健康端点可访问。", "data", now - 2 * day, now),
            issue("geoserver-java", "GeoServer 提示找不到 Java 运行时", "启动脚本无法定位 Java runtime。", "服务单元未显式设置 Java 8 的 JAVA_HOME。", "在 geoserver.service 中固定 JAVA_HOME，避免与业务服务的 Java 17 混用。", "systemctl is-active geoserver 返回 active，服务首页响应成功。", "gis", now - day, now),
        )
        val commands = listOf(
            command("baseline", "采集系统与架构基线", "uname -m && cat /etc/os-release && getconf LONG_BIT && df -h", "只读确认 ARM/aarch64、系统版本和磁盘空间。", "部署示例", "示例,银河麒麟,基线", now),
            command("repo", "核验离线软件源", "yum repolist && yum --disablerepo='*' --enablerepo='{{local_repo_id}}' list available | head", "只读确认本地介质仓库可用；不要直接复制仓库标识。", "部署示例", "示例,离线源,YUM", now),
            command("java", "核验 Java 双版本", "{{java8_home}}/bin/java -version && {{java17_home}}/bin/java -version", "分别核验 Java 8 与 Java 17，服务单元必须使用独立 JAVA_HOME。", "部署示例", "示例,Java8,Java17", now),
            command("nginx", "校验 NGINX 配置与编译参数", "{{nginx_bin}} -V 2>&1 && {{nginx_bin}} -t", "先校验 stream 编译参数和配置语法，再考虑重载。", "部署示例", "示例,NGINX,只读", now),
            command("services", "检查核心服务状态", "systemctl is-active nginx redis minio elasticsearch geoserver rabbitmq-server", "只读返回核心服务状态，不执行启动或重启。", "部署示例", "示例,systemd,验收", now),
            command("ports", "检查监听端口", "ss -lntp | grep -E '{{approved_port_regex}}'", "仅核对已经审批的端口集合，避免把现场端口固化进文档。", "部署示例", "示例,端口,只读", now),
            command("health", "逐跳健康检查", "curl -fsS --connect-timeout 5 'http://{{target_host}}:{{target_port}}/{{health_path}}'", "从当前节点验证下一跳；地址、端口和路径必须现场填写。", "部署示例", "示例,健康检查,网络", now),
            command("backup", "创建配置备份", "tar -czf '{{backup_file}}' {{reviewed_config_paths}}", "仅在确认输入路径和剩余空间后执行；备份文件不得包含私钥或凭据。", "部署示例", "示例,备份,回退", now),
        )
        val knowledge = listOf(
            knowledge("baseline", "部署基线与变量清单", baselineKnowledge, "部署示例,变量,安全", now - 2 * day, now),
            knowledge("acceptance", "服务平台验收清单", acceptanceKnowledge, "部署示例,验收,回退", now - day, now),
            knowledge("troubleshooting", "ARM 离线部署常见故障复盘", troubleshootingKnowledge, "部署示例,ARM,故障复盘", now, now),
        )
        val activities = stages.mapIndexed { index, stage ->
            Activity(
                id = "$PROJECT_ID-activity-${stage.number}",
                projectId = PROJECT_ID,
                entityType = if (stage.number == 6) "ISSUE" else "TASK",
                entityId = if (stage.number == 6) "$PROJECT_ID-issue-nginx-stream" else "$PROJECT_ID-task-${stage.number}",
                actionType = if (stage.number == 6) "RESOLVED" else "COMPLETED",
                title = "示例阶段 ${stage.number}：${stage.title}",
                description = stage.checks.joinToString("；"),
                occurredAt = now - (7 - index) * day,
            )
        }
        val report = DailyReport(
            id = "$PROJECT_ID-report",
            dateKey = "示例日期",
            projectId = PROJECT_ID,
            title = "示例｜国产化服务平台部署验收日报",
            workContent = "完成部署范围确认、银河麒麟 ARM 离线源准备、Java 8/17 分服务配置、中间件与数据服务部署、代理链路验证。",
            problems = "NGINX 缺少 stream 模块；MinIO 目录权限错误；GeoServer 未固定 Java 8。",
            solutions = "重新核验编译参数；创建专用服务账号并修正目录权限；在 systemd 中为 GeoServer 固定 JAVA_HOME。",
            nextPlan = "按现场变更流程归档配置摘要，执行备份恢复抽检，并移除临时安装介质挂载。",
            risk = "示例中的所有 {{变量}} 均须现场替换；严禁把密码、私钥、API Key 或真实地址写入知识与日报。",
            status = "COMPLETED",
            createdAt = now,
            updatedAt = now,
        )
        return DeploymentExampleBundle(project, technologyIds, tasks, issues, servers, commands, knowledge, activities, report)
    }

    private fun server(slug: String, name: String, host: String, notes: String, createdAt: Long, updatedAt: Long) = Server(
        id = "$PROJECT_ID-server-$slug",
        projectId = PROJECT_ID,
        name = name,
        host = host,
        port = 22,
        username = "{{ssh_user}}",
        osType = "银河麒麟 V10 SP3 64位 ARM/aarch64",
        environment = "脱敏示例",
        notes = notes,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    private fun issue(slug: String, title: String, symptom: String, cause: String, solution: String, verification: String, serverSlug: String, createdAt: Long, updatedAt: Long) = Issue(
        id = "$PROJECT_ID-issue-$slug",
        projectId = PROJECT_ID,
        serverId = "$PROJECT_ID-server-$serverSlug",
        title = title,
        symptom = symptom,
        cause = cause,
        solution = solution,
        verification = verification,
        status = "RESOLVED",
        priority = "P1",
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    private fun command(slug: String, title: String, value: String, description: String, category: String, tags: String, now: Long) = Command(
        id = "$PROJECT_ID-command-$slug",
        title = title,
        command = value,
        description = description,
        category = category,
        riskLevel = CommandRiskClassifier.classify(value),
        tags = tags,
        favorite = false,
        useCount = 0,
        createdAt = now,
        updatedAt = now,
    )

    private fun knowledge(slug: String, title: String, content: String, tags: String, createdAt: Long, updatedAt: Long) = Knowledge(
        id = "$PROJECT_ID-knowledge-$slug",
        projectId = PROJECT_ID,
        title = title,
        content = content,
        summary = content.take(120),
        type = "DEPLOYMENT_EXAMPLE",
        tags = tags,
        favorite = false,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    private val baselineKnowledge = """
        ## 现场变量
        - {{edge_gateway_ip}}、{{app_node_ip}}、{{data_node_ip}}、{{gis_node_ip}}
        - {{ssh_user}}、{{base_dir}}、{{local_repo_id}}
        - {{java8_home}}、{{java17_home}}、{{nginx_bin}}
        - {{approved_port_regex}}、{{health_path}}、{{backup_file}}

        ## 原则
        1. 先确认 CPU 架构，再准备同架构离线包。
        2. Java 8 与 Java 17 按服务隔离，不修改全局版本来回切换。
        3. 外部流量只经过边界代理，数据库与数据服务不直接暴露公网。
        4. 密码、私钥和 API Key 只在现场安全介质中管理，不写入本系统。
    """.trimIndent()

    private val acceptanceKnowledge = """
        ## 验收顺序
        1. `systemctl is-active` 核验服务状态。
        2. `ss -lntp` 核验审批端口与对应进程。
        3. 从内到外逐跳执行健康检查，失败时停在当前跳排查。
        4. 检查 ERROR 日志、磁盘余量、系统时间和备份文件可读性。
        5. 执行配置回退演练，确认旧版本二进制与配置可以恢复。

        ## 通过标准
        服务正常、端口符合白名单、健康检查成功、日志无阻断错误、备份可读取、回退路径明确。
    """.trimIndent()

    private val troubleshootingKnowledge = """
        ## NGINX stream 指令不可用
        先用 `{{nginx_bin}} -V` 核验编译参数，不要直接覆盖运行中的二进制。

        ## ARM 二进制无法运行
        使用 `file` 与 `ldd` 确认架构及动态库，缺失依赖从已审核的离线介质补齐。

        ## MinIO 启动失败
        先查 `journalctl -u minio`，再核对专用账号、目录归属和 EnvironmentFile。

        ## GeoServer 找不到 Java
        在服务单元中固定 Java 8 的 JAVA_HOME，避免继承业务服务的 Java 17。
    """.trimIndent()
}
