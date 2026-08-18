import type {
  Asset,
  ChangePlan,
  DeploymentTemplate,
  KnowledgeEntry,
} from "../types";

export const assets: Asset[] = [
  {
    id: "asset-001",
    name: "数据库节点 01",
    project: "湖南数字地质",
    environment: "生产",
    host: "192.168.10.206",
    port: 22,
    serverModel: "待补充",
    operatingSystem: "Kylin Server V10 SP3",
    architecture: "x86_64",
    connectionMode: "manual",
    snapshotStatus: "缺失",
    lastSnapshotAt: "2026-08-17 16:20",
    tags: ["PostgreSQL", "PostGIS", "MinIO", "离线"],
  },
  {
    id: "asset-002",
    name: "业务节点 01",
    project: "湖南数字地质",
    environment: "生产",
    host: "192.168.10.205",
    port: 22,
    serverModel: "待补充",
    operatingSystem: "Kylin Server V10 SP3",
    architecture: "x86_64",
    connectionMode: "manual",
    snapshotStatus: "完整",
    lastSnapshotAt: "2026-08-18 09:35",
    tags: ["Java 8", "Nginx", "Redis", "RabbitMQ"],
  },
  {
    id: "asset-003",
    name: "地图发布节点",
    project: "湖南数字地质",
    environment: "生产",
    host: "192.168.10.208",
    port: 22,
    serverModel: "待补充",
    operatingSystem: "Kylin Server V10 SP3",
    architecture: "x86_64",
    connectionMode: "manual",
    snapshotStatus: "冲突",
    lastSnapshotAt: "2026-08-18 10:12",
    tags: ["GeoServer", "Java 17", "zrpc"],
  },
];

export const deploymentTemplates: DeploymentTemplate[] = [
  {
    id: "template-hosts",
    name: "hosts 本机解析修复",
    description: "采集 hostname、稳定内网 IP、NSS 顺序，生成最小 Diff、验证与回滚。",
    category: "网络与名称解析",
    risk: "MEDIUM",
    offlineReady: true,
    verifiedStatus: "reviewed",
    requiredInputs: ["hostname", "private_ip", "/etc/hosts", "nsswitch hosts 顺序"],
  },
  {
    id: "template-jdk",
    name: "离线安装 JDK",
    description: "根据 OS、CPU 架构、安装介质和目标目录生成离线安装命令包。",
    category: "运行时",
    risk: "MEDIUM",
    offlineReady: true,
    verifiedStatus: "verified",
    requiredInputs: ["JDK 版本", "CPU 架构", "安装包路径", "JAVA_HOME"],
  },
  {
    id: "template-nginx",
    name: "Nginx 配置变更",
    description: "生成原文件备份、统一 Diff、nginx -t、reload 影响和回滚命令。",
    category: "Web 服务",
    risk: "HIGH",
    offlineReady: true,
    verifiedStatus: "verified",
    requiredInputs: ["现有配置", "目标配置", "监听端口", "业务健康检查"],
  },
  {
    id: "template-geoserver",
    name: "GeoServer / PostGIS 发布计划",
    description: "生成数据库预检查、最小权限 SQL、REST 请求预览、WMS/WFS 验证与回滚。",
    category: "GIS",
    risk: "HIGH",
    offlineReady: true,
    verifiedStatus: "draft",
    requiredInputs: ["schema", "table", "geometry_column", "SRID", "workspace", "store"],
  },
];

export const changePlan: ChangePlan = {
  id: "CHG-20260818-001",
  title: "修复业务节点本机主机名解析",
  project: "湖南数字地质",
  asset: "业务节点 01",
  phase: "PLAN",
  risk: "MEDIUM",
  facts: [
    "hostname：server-01",
    "稳定内网 IPv4：192.168.10.205",
    "nsswitch hosts 顺序：files dns",
    "现有 /etc/hosts 未包含 server-01",
  ],
  missingFacts: ["服务器型号未登记", "尚未回传应用健康检查 URL"],
  backupPath: "/etc/hosts.bak.<YYYYMMDDHHMMSS>",
  diff: `--- /etc/hosts.current
+++ /etc/hosts.proposed
@@
 127.0.0.1   localhost localhost.localdomain
 ::1         localhost localhost.localdomain
+192.168.10.205  server-01.localdomain  server-01`,
  steps: [
    {
      id: "DEPLOY-001",
      objective: "备份并最小化修改 /etc/hosts",
      prerequisites: [
        "已确认 IP 为稳定内网地址",
        "当前账号具有 sudo 权限",
        "现有 hosts 不存在同名多 IP 冲突",
      ],
      risk: "MEDIUM",
      commands: `HOSTNAME="server-01"
PRIVATE_IP="192.168.10.205"
FQDN="\${HOSTNAME}.localdomain"

sudo cp -a /etc/hosts "/etc/hosts.bak.$(date +%Y%m%d%H%M%S)"
printf '%s\\n' "\${PRIVATE_IP}  \${FQDN}  \${HOSTNAME}" | sudo tee -a /etc/hosts

sudo tail -n 5 /etc/hosts`,
      expectedResult: "备份文件存在，新增映射仅出现一次，localhost 映射保持不变。",
      evidenceRequired: ["实际备份路径", "完整退出码", "tail 输出", "人工确认无重复映射"],
      verificationCommands: `getent hosts server-01
getent ahostsv4 server-01
hostname -f
ping -c 1 server-01`,
      rollbackCommands: `sudo cp -a "<实际备份路径>" /etc/hosts
getent hosts server-01 || true`,
    },
  ],
};

export const knowledgeEntries: KnowledgeEntry[] = [
  {
    id: "kb-inner-hosts",
    title: "Kylin / Rocky Linux 本机主机名解析检查",
    sourceScope: "inner",
    sourceType: "sop",
    verificationStatus: "verified",
    environmentScope: "production",
    riskLevel: "MEDIUM",
    applicableVersions: ["Kylin V10", "Rocky Linux 9"],
    summary: "使用 getent 复核 NSS 实际链路，保留 localhost 映射，禁止把业务主机名默认绑定到 127.0.0.1。",
    tags: ["hosts", "DNS", "NSS", "Java"],
    lastVerifiedAt: "2026-08-17",
    requiresHumanApproval: true,
  },
  {
    id: "kb-inner-nginx",
    title: "离线现场 Nginx 配置变更 SOP",
    sourceScope: "inner",
    sourceType: "skill",
    verificationStatus: "verified",
    environmentScope: "production",
    riskLevel: "HIGH",
    applicableVersions: ["Nginx 1.24.x"],
    summary: "包含时间戳备份、配置 Diff、nginx -t、reload、业务接口验证和回滚触发条件。",
    tags: ["Nginx", "配置", "回滚", "离线"],
    lastVerifiedAt: "2026-08-12",
    requiresHumanApproval: true,
  },
  {
    id: "kb-public-geoserver",
    title: "GeoServer PostGIS 数据存储与图层发布官方流程",
    sourceScope: "public",
    sourceType: "official_doc",
    verificationStatus: "reviewed",
    environmentScope: "general",
    riskLevel: "HIGH",
    applicableVersions: ["待与现场版本核对"],
    summary: "公开资料缓存，只能生成待审核方案；不得直接执行或升级为内部已验证 Skill。",
    tags: ["GeoServer", "PostGIS", "WMS", "官方资料"],
    requiresHumanApproval: true,
  },
  {
    id: "kb-public-draft",
    title: "外部检索：离线部署 Java 服务的候选建议",
    sourceScope: "public",
    sourceType: "web_result",
    verificationStatus: "draft",
    environmentScope: "general",
    riskLevel: "MEDIUM",
    applicableVersions: ["未核验"],
    summary: "已脱敏的候选内容，尚未经过测试环境验证，不能进入执行命令包。",
    tags: ["Java", "systemd", "外部待验证"],
    requiresHumanApproval: true,
  },
];
