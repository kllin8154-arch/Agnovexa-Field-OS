# Agnovexa OpsDesk

Agnovexa OpsDesk 是面向离线现场部署、运维排障、人工变更审计和知识沉淀的 Windows 桌面工作台。

[**下载最新版 Windows x64 安装程序**](https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest/download/Agnovexa-OpsDesk-Windows-x64-Setup.exe)

## 核心边界

```text
系统生成方案、命令、SQL、验证与回滚
→ 工程师人工审阅
→ 工程师在目标环境人工执行
→ 回填退出码、stdout、stderr 与现场证据
→ 文件/服务/网络/业务四层人工验收
→ 选择 AI Provider 分析报错
→ 人工执行修订方案并独立验证
→ 人工审核后沉淀知识
```

程序永久不注册 SSH、SFTP、Shell、远程文件、进程启动或生产数据库执行工具。AI 只能分析文字上下文和生成待审核草案。

## v0.4.x 生产候选迭代

### 现场部署与验收闭环

- 独立项目中心保存系统、CPU 架构、交付网络、现场约束与任意自定义技术栈；其他工作区只读这份固定上下文。
- 项目与服务器资产台账写入本地 SQLite；资产地址只用于台账，不会自动连接。
- 只读环境采集包由工程师人工执行，输出经过脱敏、解析并保存为版本化快照。
- 部署任务、命令包、SQL 包、配置变更包、人工审批和执行证据形成闭环。
- 退出码非 0 时保留在 `MANUAL_EXECUTE`，可将脱敏后的错误上下文交给 AI 继续分析。
- 退出码为 0 只代表人工执行步骤结束，不能直接把部署标记为成功。
- 新增独立 `验收中心`，分别记录文件/包与配置、服务/进程与日志、网络/端口与解析、业务功能与人工验收。
- 四层结果均为 `passed` 或有责任说明的 `human_exempt` 后才允许关单。
- 任意验收失败都可退回 `MANUAL_EXECUTE`，保留失败证据和审计记录。
- 关单后任务进入 `KNOWLEDGE`，继续生成部署报告和候选知识条目。

### AI、Skill 与知识

- AI 配置与 AI 使用完全分离：`AI 服务配置` 管 Provider，`AI 工作台` 处理任务。
- AI 工作台按项目自动载入资产、最新环境快照和已验证知识，支持连续追问，不要求重复填写已保存的现场事实。
- 支持 DeepSeek、OpenAI、通义千问、Kimi、智谱 GLM、硅基流动、本地和自定义 OpenAI 兼容接口。
- API Key 只存在于当前应用进程内存，不写入 SQLite、localStorage、知识库、报告、备份或 Git。
- 独立 Skill 专库保存结构化元数据、提示词、前置检查、待人工执行模板、验证和回滚。
- 内置 `geoserver.postgis.publish-layer` reviewed 模板；只有登记适用版本、现场验证结果和维护人后，内部 Skill 才能升级为 `verified`。
- 双知识库检索优先级固定为：已验证 Skill → 内部生产知识 → 内部通用知识 → 已审核公开资料 → 外部待验证建议。
- KB-Public 条目不能原地成为 `verified`；必须经过人工审核和现场验证，再复制为新的 KB-Inner verified 条目，并保留原外部来源。

### 数据与归档

- `数据与归档` 工作区执行 SQLite `integrity_check` 与 `foreign_key_check`。
- 导出 `.opsdesk.json` 工作区备份和独立 SHA-256 校验文件。
- 恢复前强制校验格式、安全声明、表计数和数据摘要；恢复必须二次人工确认。
- 备份明确排除 AI API Key、凭据库秘密和未脱敏生产密码。
- 四层验收和关单以追加式审计事件保存，因此随工作区备份一并迁移。
- 从任务、变更计划、审批与人工执行证据生成 Markdown 部署报告，并保存为本地 draft 生成物。
- 验收中心可单独导出 Markdown 四层验收记录。

### 界面与发布

- 明亮、深色、跟随系统主题已经重做，并支持导入经过结构与对比度校验的本机 JSON 自定义主题。
- 工作台、侧边栏、顶部栏、表单、状态卡、代码块、AI 工作区、Skill 专库、验收中心和响应式布局均按桌面生产场景设计。
- `package-lock.json` 与 `Cargo.lock` 固定依赖版本；CI 使用 `npm ci`、`cargo test --locked` 与 `cargo check --locked`。
- CI 使用真实 Chrome 渲染明暗主题、AI 配置、AI 工作台、Skill、知识库、归档和验收页面，保留视觉 QA 截图。
- Windows NSIS 安装程序由 GitHub Actions 完成测试、高危生产依赖审计、构建和 Release 发布。

## 目录

```text
Agnovexa-Field-OS/
├── desktop/        Agnovexa OpsDesk 主产品
├── app/            原 Android 实现，保留为历史与未来轻量辅助端
├── docs/           架构、迁移与安全说明
└── .github/        Windows CI 与 Release 流水线
```

## 本地开发

```bash
cd desktop
npm ci
npm run check
npm run tauri:dev
```

Windows 构建：

```bash
cd desktop
npm run tauri:build:windows
```

输出目录：

```text
desktop/src-tauri/target/release/bundle/nsis/
```

## 生产使用注意事项

1. 当前安装包未使用商业代码签名证书，Windows SmartScreen 可能提示未知发布者。
2. API 请求只在用户点击测试或生成按钮时发出；发送前仍需人工检查脱敏预览。
3. 工作区恢复会覆盖当前本地项目、资产、任务、知识和审计数据，必须先导出当前备份。
4. SQLite 数据库保存在当前 Windows 用户的应用数据目录，应建立定期备份、异地保存和恢复演练制度。
5. 高风险命令和 SQL 只能作为待人工执行文本保存，程序不会代为执行。
6. 生成的部署报告默认为 draft，必须经实施人员和项目负责人复核后归档。
7. `reviewed` 只代表已人工审阅，不代表已在目标环境验证；只有登记现场证据后才可升级为 `verified`。
8. 人工豁免不等于验证通过，必须填写原因、依据、责任人并在报告中保留。

## 许可证

Apache License 2.0。
