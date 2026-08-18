# ADR-001：Agnovexa 现场工作台转向桌面主产品

- 状态：Accepted
- 日期：2026-08-18
- 决策范围：Agnovexa Field OS / Agnovexa OpsDesk

## 背景

现场部署的核心工作包含大段日志、配置文件 Diff、离线安装介质、部署清单、服务器资产、验证证据和知识沉淀。手机端适合查看、记录和辅助采集，但不适合承载长命令、复杂配置比对、批量文件整理和持续的桌面工作流。

现有 Android 项目已经沉淀了项目、任务、问题、服务器、命令、知识、活动和日报等领域模型，也具有本地优先、全文检索、备份、AI Provider 和密钥保护能力。这些成果继续保留，但不把 Android 工程强行改造成桌面应用。

## 决策

1. **桌面端成为主产品**，产品名为 `Agnovexa OpsDesk`。
2. **现有 Android App 保留**，作为轻量辅助端、需求参考实现和未来的数据同步客户端。
3. 桌面端先放在当前仓库的 `desktop/` 目录孵化；边界稳定后再决定是否拆分为独立仓库。
4. 桌面技术栈采用 Tauri 2、React、TypeScript、Vite 和 SQLite。
5. 永久采用“本地优先、人工执行”：程序不连接服务器、不执行命令或 SQL、不修改远程文件。
6. 工作流固定为：

```text
DISCOVER → DEFINE → RETRIEVE → PLAN → APPROVE
→ MANUAL_EXECUTE → VERIFY → KNOWLEDGE
```

7. 双知识库检索顺序固定为：已验证 Skill → 内部生产知识 → 内部通用知识 → 已审核公共缓存 → 脱敏后的官方公开检索。
8. 外部知识只能生成待审核方案，经过人工审核、测试/现场验证和审计后，才可进入内部已验证知识。
9. AI 采用可配置的多 Provider 架构，不绑定单一模型或厂商；统一以受控的 Chat Completions 文本请求生成草案。
10. Windows 交付采用 GitHub Actions 自动构建 NSIS 离线安装包，并固定提供可直接下载的 EXE。

## 永久安全边界

- Tauri Capability 不授予 Shell、进程、文件系统、SSH 或 SFTP 权限。
- 不建设“只读 SSH”或“受控远程执行”作为后续路线；服务器事实始终由人工采集和导入。
- 不给 AI 注册命令执行、SQL 执行、数据库连接、远程文件写入或服务重启工具。
- SQLite 允许本地 CRUD，但不存储密码、Token、私钥或 AI API Key。
- 命令、配置、SQL、验证和回滚均只作为预览或可复制文本。
- 所有写变更必须先展示目标、影响、备份、Diff、验证和回滚，并记录人工审阅。
- 人工未回传证据前，状态不得进入“验证通过”。
- 退出码非 0 时必须留在 `MANUAL_EXECUTE`；可把脱敏报错交给任一 AI Provider 分析，但不能自动推进状态。
- 公网 AI 请求前必须删除真实 IP、域名、账号、项目名、客户名、真实表名、Token、Cookie、证书和内部路径标识。

## 多 AI Provider 决策

桌面端保留以下类型的 Provider：

- DeepSeek；
- OpenAI；
- 通义千问 / 阿里云百炼；
- Kimi / Moonshot；
- 智谱 GLM；
- 硅基流动；
- 本地 OpenAI 兼容服务；
- 自定义 OpenAI 兼容接口。

Provider 元数据可以本地保存；API Key 只保留在当前程序运行内存中。AI 请求必须由用户显式触发，输入必须先脱敏，输出统一视为待人工审核草案。

## Android 数据模型映射

| Android 现有模型 | 桌面端承接方式 |
| --- | --- |
| Project | `projects`，继续作为任务、资产和知识的隔离边界 |
| Server | `assets`，增加服务器型号、架构、环境快照和人工采集状态 |
| Command | `change_steps` / Skill 模板，不再作为孤立命令收藏 |
| Issue | `knowledge_entries(source_type=incident)` 与人工执行错误闭环 |
| Knowledge | `knowledge_entries` + FTS5，增加来源、验证、风险和适用版本 |
| ActivityLog | `audit_events`，只保存脱敏审计信息 |
| DailyReport | 后续作为部署报告与日报导出视图复用 |

## P0 交付范围

- 可运行桌面壳与桌面信息架构；
- 本地 SQLite schema 和迁移；
- 资产、快照、部署任务、变更计划、人工审批、证据、知识和审计的数据边界；
- 只读采集命令包、Diff、验证、回滚和证据粘贴交互；
- 多 AI Provider 配置、报错排障、SQL 审查与知识草稿；
- 双知识库展示与检索状态；
- Windows x64 NSIS 离线安装包与稳定 EXE 下载地址；
- 无 SSH、Shell、数据库自动执行、远程写入和自动回滚。

## 后果

### 正面影响

- 更适合长日志、配置 Diff、离线介质与多窗口现场工作；
- 权限边界可通过 Tauri Capability 和后端命令白名单明确收敛；
- 可在不同 AI 厂商、本地模型和自定义网关之间切换；
- 人工失败证据可以形成“回填报错 → AI 分析 → 人工再执行”的闭环；
- GitHub Release 提供固定名称 EXE，便于现场直接下载和归档；
- Android 既有产品不被破坏，可继续作为现场轻量辅助端。

### 代价

- 需要维护 Android 与桌面两个客户端；
- Room 与桌面 SQLite 不能直接复用代码，只能复用领域概念和导入格式；
- 未签名预览版可能触发 Windows 未知发布者提示；正式发布需配置代码签名证书；
- 多 Provider 存在参数、限流、错误格式和模型生命周期差异，需要持续兼容测试；
- 内置 WebView2 离线安装器会显著增加安装包体积。

## 下一决策点

完成 SQLite Repository、完整变更闭环和至少一个已验证 Skill 后，再评估：

1. 是否拆分独立仓库 `Agnovexa-OpsDesk`；
2. 是否建设团队同步服务与 Web 管理台；
3. Android 辅助端采用文件同步、局域网同步还是中心 API；
4. 正式代码签名、自动更新和稳定版发布策略。
