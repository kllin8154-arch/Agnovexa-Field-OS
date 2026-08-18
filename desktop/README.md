# Agnovexa OpsDesk Desktop MVP

Agnovexa OpsDesk 是面向完全离线现场环境的桌面部署运维工作台。本目录是从 `Agnovexa Field OS` 独立孵化的桌面端基础版本，采用 **Tauri 2 + React + TypeScript + Vite + SQLite**。

## 当前安全边界

- AI、页面与本地后端都**不会连接服务器或执行命令**。
- 不包含 SSH、Shell、进程启动、远程文件修改等 Tauri 权限。
- 现场工程师只会获得“待人工执行命令包”，在目标服务器手工执行后再粘贴完整证据。
- SQLite 只保存资产事实、脱敏快照、计划、审批、执行证据和知识；不保存密码、Token、私钥或证书私钥。
- 外部知识默认是 `draft/reviewed`，不能直接进入执行方案或升级为内部已验证 Skill。

## 已实现页面

- 工作台：任务状态、资产风险、知识状态和人工审批提示。
- 服务器资产：项目归属、环境、架构、快照状态和人工连接模式。
- 现场诊断：生成只读采集命令，人工执行并回传输出。
- 部署中心：离线 JDK、Nginx、hosts、GeoServer/PostGIS 等模板入口。
- 变更中心：事实、风险、备份、统一 Diff、命令预览、验证、回滚和人工证据闭环。
- 双知识库：KB-Inner 优先、KB-Public 待审、验证后才允许沉淀。
- 设置：显示运行时能力策略，明确 SSH 与远程写入均未启用。

## 本地开发

前置条件：Node.js 22、npm，以及运行 Tauri 时所需的 Rust 和平台依赖。

```bash
cd desktop
npm install
npm run dev
```

浏览器预览不会写入 SQLite，只展示演示数据。

启动桌面开发模式：

```bash
npm run tauri dev
```

构建前端：

```bash
npm run build
```

当前 `bundle.active=false`，先验证桌面壳、状态机和本地数据层；正式安装包、签名和自动更新在后续迭代中启用。

## SQLite 数据模型

首个迁移位于 `src-tauri/migrations/0001_initial.sql`，包括：

- 项目、资产和凭据引用；
- 环境快照；
- 部署任务、变更计划与步骤；
- 人工审批与手工执行证据；
- Skill、双知识库条目和 FTS5 全文检索；
- 部署工单、部署报告、知识草稿、资产清单；
- 脱敏审计事件。

凭据表只存系统凭据库的 `reference_key`，不包含秘密值。

## 工作流

```text
DISCOVER → DEFINE → RETRIEVE → PLAN → APPROVE
→ MANUAL_EXECUTE → VERIFY → KNOWLEDGE
```

`MANUAL_EXECUTE` 表示“等待工程师在目标服务器手工执行并回传证据”，不是桌面程序代为执行。

## 下一阶段

1. 将当前演示数据切换为 SQLite Repository。
2. 实现环境采集输出导入、解析、冲突检测和快照版本化。
3. 实现命令包、Diff、审批和证据的完整持久化。
4. 建立 Markdown/SQLite FTS5 双知识库检索与脱敏规则。
5. 接入 DeepSeek Harness，但仅允许生成计划、诊断、SQL 草案和知识草稿。
6. 经过独立安全评审后，再讨论只读 SSH 连接；P0 不实现远程写操作。
