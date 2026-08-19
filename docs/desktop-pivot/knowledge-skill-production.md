# Agnovexa OpsDesk 双知识库与 Skill 专库生产规则

## 固定检索顺序

1. 已验证 Skill；
2. 内部生产知识；
3. 内部通用 SOP、故障案例和配置基线；
4. 已审核的官方公开资料缓存；
5. 外部待验证建议。

内部命中足够时不向外部发送任何上下文。内部知识不足时，只有经过脱敏的通用技术关键词可以用于外部检索；IP、域名、账号、密码、Token、客户名、项目名、真实表名和内部路径不得发送。

## 发布门禁

- KB-Public 条目状态只能从 `draft` 进入 `reviewed`。
- 外部条目不能原地改为 `verified`。
- 外部资料必须经过人工审核、测试或现场验证、证据登记后，复制为新的 KB-Inner `verified` 条目。
- 原外部条目保留，用于来源追溯。
- Skill 新建状态为 `draft`；只有内部 Skill 在登记适用环境、版本、验证结果和回滚验证后才能升级为 `verified`。

## Skill 结构

每个 Skill 至少包含：

- 结构化元数据和版本；
- 必填输入和敏感输入；
- 前置检查；
- 待人工执行命令或 SQL；
- 预期结果和停止条件；
- 独立验证；
- 回滚；
- 风险等级；
- 人工确认策略；
- 维护人与最近验证时间。

## GeoServer / PostGIS

`geoserver.postgis.publish-layer` 内置模板仅为 `reviewed`：

- 检查表、主键、几何列、SRID、空几何、范围、PostGIS 扩展和空间索引；
- SQL 标识符必须经过白名单校验；
- GeoServer 使用只读数据库账号和最小 `USAGE` / `SELECT` 权限；
- 发布后通过 WMS GetCapabilities、GetMap 和必要时 WFS GetFeature 验证；
- 所有 SQL、授权、索引和发布动作由工程师人工执行；
- 不自动删除业务表、PostGIS 扩展、Store 或 Workspace。

## 备份安全

工作区备份必须明确声明：

```json
{
  "containsApiKeys": false,
  "remoteExecution": false
}
```

导入采用只增不覆盖模式；同 ID 记录跳过，不删除当前工作区数据。API Key 只存在于当前应用进程内存，不进入 SQLite 或工作区备份。
