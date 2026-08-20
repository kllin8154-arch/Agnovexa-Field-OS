export interface DeploymentExecutionDraft {
  objective: string;
  commands: string;
  expectedResult: string;
  validationCommands: string;
  rollbackCommands: string;
  missingFacts: string[];
}

interface DraftInput {
  templateId: string;
  asset: {
    name: string;
    host: string;
    operatingSystem: string;
    architecture: string;
  };
  offlineMedia?: string;
  targetDirectories?: string;
  acceptanceCriteria?: string[];
  rollbackRequirements?: string;
  requiredInputs?: string[];
}

function shellValue(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function supplied(value: string | undefined, placeholder: string): string {
  return value?.trim() || `<${placeholder}>`;
}

function acceptance(input: DraftInput, fallback: string): string {
  return input.acceptanceCriteria?.filter(Boolean).join("；") || fallback;
}

function rollback(input: DraftInput, fallback: string): string {
  return input.rollbackRequirements?.trim() || fallback;
}

export function buildDeploymentExecutionDraft(input: DraftInput): DeploymentExecutionDraft {
  const assetName = shellValue(input.asset.name);
  const host = shellValue(input.asset.host);
  const system = input.asset.operatingSystem || "操作系统待现场确认";
  const architecture = input.asset.architecture || "架构待现场确认";
  const commonMissing = input.requiredInputs ?? [];

  switch (input.templateId) {
    case "template-hosts":
      return {
        objective: `在“${input.asset.name}”上核对本机名解析并进行最小化修复`,
        commands: `set -eu
TARGET_ADDRESS='${host}'
TARGET_HOSTNAME="$(hostname -s)"
BACKUP="/etc/hosts.bak.$(date +%Y%m%d%H%M%S)"

printf '目标资产：%s（%s）\\n' '${assetName}' "$TARGET_ADDRESS"
hostnamectl --static
getent hosts "$TARGET_HOSTNAME" || true
grep -nE "(^|[[:space:]])$TARGET_HOSTNAME([[:space:]]|$)" /etc/hosts || true

# 下列写入操作必须在确认 TARGET_ADDRESS 是稳定内网地址后人工执行。
sudo cp -a /etc/hosts "$BACKUP"
grep -qE "^[[:space:]]*$TARGET_ADDRESS[[:space:]]+.*(^|[[:space:]])$TARGET_HOSTNAME([[:space:]]|$)" /etc/hosts \
  || printf '%s  %s\\n' "$TARGET_ADDRESS" "$TARGET_HOSTNAME" | sudo tee -a /etc/hosts
printf '备份：%s\\n' "$BACKUP"`,
        expectedResult: acceptance(input, "备份文件存在；目标主机名仅有一条稳定地址映射；localhost 映射保持不变。"),
        validationCommands: `getent hosts "$(hostname -s)"
hostname -f
grep -nE "(^|[[:space:]])$(hostname -s)([[:space:]]|$)" /etc/hosts`,
        rollbackCommands: rollback(input, "sudo cp -a '<上一步输出的备份路径>' /etc/hosts && getent hosts \"$(hostname -s)\""),
        missingFacts: commonMissing.filter((item) => item !== "hostname" && item !== "private_ip"),
      };
    case "template-jdk": {
      const media = shellValue(supplied(input.offlineMedia, "请填写 JDK 离线包绝对路径"));
      const target = shellValue(supplied(input.targetDirectories, "请填写 JDK 安装目录，例如 /opt/jdk-17"));
      return {
        objective: `在“${input.asset.name}”上离线安装并验证 JDK（${system} / ${architecture}）`,
        commands: `set -eu
JDK_ARCHIVE='${media}'
JAVA_HOME_TARGET='${target}'

test -f "$JDK_ARCHIVE"
test "${architecture}" != "unknown"
sudo mkdir -p "$JAVA_HOME_TARGET"
sudo tar -xf "$JDK_ARCHIVE" -C "$JAVA_HOME_TARGET" --strip-components=1
"$JAVA_HOME_TARGET/bin/java" -version`,
        expectedResult: acceptance(input, "目标目录中存在完整 JDK；java -version 与项目要求一致；系统原有 Java 不被覆盖。"),
        validationCommands: `test -x '${target}/bin/java'
'${target}/bin/java' -version
readlink -f '${target}/bin/java'`,
        rollbackCommands: rollback(input, `确认没有业务进程使用后，人工删除新建目录：${target}；不修改系统原有 alternatives。`),
        missingFacts: [
          ...(input.offlineMedia?.trim() ? [] : ["JDK 离线包绝对路径"]),
          ...(input.targetDirectories?.trim() ? [] : ["JDK 安装目录"]),
        ],
      };
    }
    case "template-nginx": {
      const config = shellValue(supplied(input.offlineMedia, "请填写已审核的新配置文件绝对路径"));
      const target = shellValue(supplied(input.targetDirectories, "请填写目标配置文件，例如 /etc/nginx/nginx.conf"));
      return {
        objective: `在“${input.asset.name}”上备份、校验并应用 Nginx 配置`,
        commands: `set -eu
SOURCE_CONFIG='${config}'
TARGET_CONFIG='${target}'
BACKUP="${target}.bak.$(date +%Y%m%d%H%M%S)"

test -f "$SOURCE_CONFIG"
test -f "$TARGET_CONFIG"
sudo cp -a "$TARGET_CONFIG" "$BACKUP"
sudo cp -a "$SOURCE_CONFIG" "$TARGET_CONFIG"
sudo nginx -t
sudo nginx -s reload
printf '备份：%s\\n' "$BACKUP"`,
        expectedResult: acceptance(input, "nginx -t 通过；服务 reload 成功；业务健康检查正常。"),
        validationCommands: "sudo nginx -t\nsystemctl is-active nginx\nss -lntp | grep nginx",
        rollbackCommands: rollback(input, `sudo cp -a '<上一步输出的备份路径>' '${target}' && sudo nginx -t && sudo nginx -s reload`),
        missingFacts: [
          ...(input.offlineMedia?.trim() ? [] : ["已审核的新配置文件路径"]),
          ...(input.targetDirectories?.trim() ? [] : ["Nginx 目标配置文件路径"]),
          "业务健康检查地址或人工检查步骤",
        ],
      };
    }
    case "template-geoserver":
      return {
        objective: `为“${input.asset.name}”准备 GeoServer / PostGIS 发布前检查与发布计划`,
        commands: `# 本步骤只做发布前检查，不会直接创建工作区、数据源或图层。
# 在数据库客户端执行：
SELECT current_database(), current_user, version();
SELECT PostGIS_Full_Version();

# 补齐 schema、table、geometry_column、SRID 后执行：
SELECT f_table_schema, f_table_name, f_geometry_column, srid, type
FROM geometry_columns
WHERE f_table_schema = '<schema>' AND f_table_name = '<table>';

# 在可访问 GeoServer 的终端执行，只读取版本信息：
curl -fsS '<GeoServer地址>/rest/about/version.json'`,
        expectedResult: acceptance(input, "数据库、PostGIS 和 GeoServer 版本可读取；目标空间表、几何列、SRID 与项目资料一致。"),
        validationCommands: `# 发布完成后分别验证：
curl -fsS '<GeoServer地址>/rest/workspaces/<workspace>/datastores/<store>/featuretypes/<layer>.json'
curl -fsS '<GeoServer地址>/wms?service=WMS&request=GetCapabilities' | grep '<layer>'
curl -fsS '<GeoServer地址>/wfs?service=WFS&request=GetCapabilities' | grep '<layer>'`,
        rollbackCommands: rollback(input, "删除本次新建的图层、数据源和空工作区；不删除 PostGIS 原始业务表。执行前记录所有新建资源名称。"),
        missingFacts: commonMissing,
      };
    default:
      throw new Error("没有找到对应的部署模板。请重新选择。");
  }
}
