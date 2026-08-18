# Agnovexa OpsDesk Desktop

Agnovexa OpsDesk 是面向现场部署、运维排障和知识沉淀的 Windows 桌面工作台，采用 **Tauri 2 + React + TypeScript + Vite + SQLite**。

## 直接下载 Windows EXE

[下载最新版 Agnovexa-OpsDesk-Setup.exe](https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest/download/Agnovexa-OpsDesk-Setup.exe)

安装包采用 Windows x64 NSIS，并内置 WebView2 离线安装器，目标是拿到无外网现场后也能完成安装。当前预览版未配置商业代码签名；Windows 可能显示未知发布者提示，请仅从本仓库 Release 下载并核对来源。

## 不可改变的执行边界

- 永久不接入 SSH、Shell、SFTP、远程文件系统、远程进程和数据库自动执行能力。
- 命令、SQL、脚本、配置 Diff、验证和回滚只作为可审阅、可复制文本。
- 所有操作由现场工程师在目标服务器或数据库客户端中人工执行。
- 人工执行后必须回填实际命令/SQL、退出码、stdout、stderr、日志、验证结果和人工处理说明。
- 退出码非 0 时，任务保留在 `MANUAL_EXECUTE`，不能进入验收或标记成功。
- 报错可交给任一已配置 AI Provider 分析，但 AI 返回的下一轮命令仍需重新人工审阅和执行。

## 多 AI Provider

当前桌面端提供统一 OpenAI Chat Completions 兼容网关，并预置：

- DeepSeek；
- OpenAI；
- 通义千问 / 阿里云百炼；
- Kimi / Moonshot；
- 智谱 GLM；
- 硅基流动；
- 本地 OpenAI 兼容服务；
- 自定义 OpenAI 兼容接口。

Provider 的 Base URL、模型 ID、显示名称等元数据可保存在本机。API Key 只保留在当前应用运行内存中，不写入 SQLite、localStorage、知识库、报告或 Git；关闭应用后需重新输入。

AI 请求只能由用户点击“测试接口”或“生成待人工审核草案”显式发起。发送前会脱敏内网 IP、数据库凭据 URL、Authorization、Token、API Key 和私钥块。

## 已实现页面

- 工作台：任务状态、资产风险、知识状态和人工审批提示。
- 服务器资产：项目归属、环境、架构、快照状态和人工执行模式。
- 现场诊断：生成只读采集命令，人工执行并回传输出。
- 部署中心：离线 JDK、Nginx、hosts、GeoServer/PostGIS 等模板入口。
- 变更中心：事实、风险、备份、统一 Diff、命令/SQL 预览、验证、回滚和人工证据闭环。
- AI 助手：多 Provider 配置、方案生成、SQL 审查、人工报错排障和知识草稿。
- 双知识库：KB-Inner 优先、KB-Public 待审、验证后才允许沉淀。
- 设置：显示永久人工执行策略与敏感信息边界。

## 工作流

```text
DISCOVER → DEFINE → RETRIEVE → PLAN → APPROVE
→ MANUAL_EXECUTE → VERIFY → KNOWLEDGE
```

`MANUAL_EXECUTE` 表示等待工程师人工执行并回传证据，不是程序代为执行。

## 本地开发

前置条件：Node.js 22、npm、Rust stable，以及对应平台的 Tauri 依赖。

```bash
cd desktop
npm install
npm run dev
```

浏览器预览不会写入 SQLite，也不会发起 AI 请求。

启动桌面开发模式：

```bash
npm run tauri:dev
```

运行测试和前端构建：

```bash
npm run check
```

在 Windows 本机构建 NSIS 安装包：

```bash
npm run tauri:build:windows
```

输出目录：

```text
desktop/src-tauri/target/release/bundle/nsis/
```

## 自动发布

`.github/workflows/desktop-windows-release.yml` 在指定分支推送或手工触发时执行：

1. 安装 Node.js 与 Rust；
2. 执行 Vitest；
3. 执行 TypeScript 严格检查和 Vite 构建；
4. 构建 Windows x64 NSIS 离线安装包；
5. 创建 GitHub Release；
6. 将安装包固定命名为 `Agnovexa-OpsDesk-Setup.exe`。

因此最新版始终可通过以下稳定地址下载：

```text
https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest/download/Agnovexa-OpsDesk-Setup.exe
```

## SQLite 数据模型

首个迁移位于 `src-tauri/migrations/0001_initial.sql`，包括：

- 项目、资产和凭据引用；
- 环境快照；
- 部署任务、变更计划与步骤；
- 人工审批与手工执行证据；
- Skill、双知识库条目和 FTS5 全文检索；
- 部署工单、部署报告、知识草稿、资产清单；
- 脱敏审计事件。

凭据表只存未来系统凭据库的引用键，不包含秘密值；当前 AI Key 不进入该表。

## 下一阶段

1. 将演示数据切换为 SQLite Repository。
2. 实现环境采集输出导入、解析、冲突检测和快照版本化。
3. 持久化命令包、SQL、Diff、审批、人工执行证据和四层验收。
4. 建立 Markdown + SQLite FTS5 双知识库检索与脱敏规则。
5. 增加项目工作区导入导出、部署工单、部署报告和备份恢复。
6. 对多 Provider 的超时、限流、模型参数差异和错误格式建立兼容适配与测试。
