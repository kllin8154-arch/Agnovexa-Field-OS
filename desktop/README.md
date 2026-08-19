# Agnovexa OpsDesk Desktop

技术栈：Tauri 2、React 19、TypeScript、Vite、Rust、SQLite / FTS5。

## 页面结构

- 工作台：读取真实本地项目、资产、任务与知识统计。
- 项目中心：统一维护项目范围、系统架构、技术栈与现场约束。
- 服务器资产：创建项目、登记资产、查看快照状态。
- 现场诊断：生成只读采集包，人工执行并保存脱敏环境快照。
- 部署中心：基于离线模板创建部署任务。
- 变更中心：创建命令、SQL 或配置包，人工审批、人工执行、回填证据。
- AI 工作台：选择项目后自动注入资产、快照和已验证知识，连续生成方案、排错、SQL 审查和知识草稿。
- 验收中心：文件/配置、服务/日志、网络/端口、业务功能四层人工验收和关单。
- AI 服务配置：独立管理 Provider、模型、Base URL 与会话密钥。
- Skill 专库：结构化 Skill、版本、状态、前置检查、人工执行模板、验证和回滚。
- 双知识库：内部知识与外部资料隔离；外部 reviewed 条目验证后复制进入内部 verified 库。
- 数据与归档：SQLite 完整性检查、SHA-256 备份恢复、部署报告与本地生成物。
- 偏好与安全：明亮、深色、系统主题、SQLite 与运行策略检查。

## 安全边界

- 没有 SSH、SFTP、Shell、远程文件、远程进程或生产数据库执行能力。
- API Key 仅保留在进程内存，不进入工作区备份。
- 命令、SQL、Diff、验证和回滚只能复制后由工程师人工执行。
- 非零退出码不会进入验证成功状态。
- 四层验收只保存脱敏后的人工证据和追加式审计事件。
- AI 和外部资料只能产生待审核草案。
- 备份排除 credential references、凭据库秘密和未脱敏生产密码。

## 开发与检查

```bash
npm ci
npm run test
npm run build
npm run tauri:dev
```

`package-lock.json` 与 `Cargo.lock` 提交到仓库。CI 使用 `npm ci`、`cargo test --locked` 和 `cargo check --locked`，避免依赖随时间漂移。

构建 Windows NSIS：

```bash
npm run tauri:build:windows
```

## 视觉验收

每次桌面端 PR 和主分支构建使用真实 Chrome 渲染：

- 工作台明亮与深色主题；
- AI 服务配置；
- AI 工作台；
- Skill 专库；
- 双知识库；
- 数据与归档；
- 验收中心；
- 偏好与安全。

截图作为 `opsdesk-visual-qa` GitHub Actions 产物保留，用于检查主题对比度、页面完整性和基础桌面排版。CI 不依赖在线安装额外字体包，避免现场网络或镜像源问题阻断构建。

## Windows Release

主分支通过高危生产依赖审计、Vitest、TypeScript/Vite、视觉烟雾测试和 Windows Tauri/Rust 检查后，自动构建 NSIS 安装程序并发布到 GitHub Release。固定下载地址：

```text
https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest/download/Agnovexa-OpsDesk-Windows-x64-Setup.exe
```
