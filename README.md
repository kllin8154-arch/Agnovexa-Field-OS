# Agnovexa OpsDesk

Agnovexa OpsDesk 是面向离线现场部署、运维排障、人工变更审计和知识沉淀的 Windows 桌面工作台。

[下载最新版 Windows x64 安装程序](https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest/download/Agnovexa-OpsDesk-Windows-x64-Setup.exe)

## 核心边界

```text
系统生成方案、命令、SQL、验证与回滚
→ 工程师人工审阅
→ 工程师在目标环境人工执行
→ 回填退出码、stdout、stderr 与现场证据
→ 选择 AI Provider 分析报错
→ 人工执行修订方案并独立验证
→ 人工审核后沉淀知识
```

程序永久不注册 SSH、SFTP、Shell、远程文件、进程启动或生产数据库执行工具。AI 只能分析文字上下文和生成待审核草案。

## v0.4.0 试生产版

### 本地业务闭环

- 项目与服务器资产台账写入本地 SQLite；资产地址只用于台账，不会自动连接。
- 只读环境采集包由工程师人工执行，输出经过脱敏、解析并保存为版本化快照。
- 部署任务、命令包、SQL 包、配置变更包、人工审批和执行证据形成闭环。
- 退出码非 0 时保留在 `MANUAL_EXECUTE`，可将脱敏后的错误上下文交给 AI 继续分析。
- AI 配置与 AI 使用完全分离：`AI 服务配置` 管 Provider，`AI 工作台` 处理任务。
- 支持 DeepSeek、OpenAI、通义千问、Kimi、智谱 GLM、硅基流动、本地和自定义 OpenAI 兼容接口。
- API Key 只存在于当前应用进程内存，不写入 SQLite、localStorage、知识库、报告、备份或 Git。

### Skill 专库与双知识库

- 新增独立 Skill 专库，保存结构化元数据、提示词、前置检查、人工执行模板、验证和回滚。
- 内置 `geoserver.postgis.publish-layer` 受控模板，默认状态为 `reviewed`，不会冒充已完成现场验证。
- 检索优先级固定为：已验证 Skill → 内部生产知识 → 内部通用知识 → 已审核公开资料 → 外部待验证建议。
- KB-Public 条目不能原地标记为 verified；必须人工审核、现场验证，再复制为新的 KB-Inner verified 条目。
- 知识全文检索优先使用 SQLite FTS5，异常时降级为普通本地检索。

### 工作区备份与生产自检

- 新增 SQLite 完整性检查、项目数据统计、失败任务与待审知识检查。
- 可导出项目、资产、快照、任务、变更、审批、人工证据、Skill、知识和审计事件。
- 备份强制声明 `containsApiKeys: false` 与 `remoteExecution: false`。
- 导入采用只增不覆盖的安全合并模式；同 ID 数据跳过，不删除现有工作区。
- 增加试生产投入清单：数据库完整性、已验证 Skill、备份恢复演练、代码签名与真实项目验收。

### 界面

- 明亮、深色、跟随系统三套主题。
- AI 工作台与 AI 服务配置分离。
- 工作台、侧边栏、表单、状态卡、代码块、空状态、Skill 专库、知识审核和备份页面采用统一视觉系统。

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
npm install
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
3. 外部资料和 AI 结果不能直接升级为 `verified`，必须先经过现场验证和人工审核。
4. SQLite 数据库保存在当前 Windows 用户的应用数据目录；正式项目投入前必须完成一次备份和恢复演练。
5. 高风险命令和 SQL 只能作为待人工执行文本保存，程序不会代为执行。
6. `reviewed` 代表已人工审阅，不代表已在目标环境验证；只有登记证据后才可升级为 `verified`。

## 许可证

Apache License 2.0。
