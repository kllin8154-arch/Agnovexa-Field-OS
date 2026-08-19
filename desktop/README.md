# Agnovexa OpsDesk Desktop

技术栈：Tauri 2、React 19、TypeScript、Vite、Rust、SQLite / FTS5。

## 页面结构

- 工作台：读取真实本地项目、资产、任务与知识统计。
- 服务器资产：创建项目、登记资产、查看快照状态。
- 现场诊断：生成只读采集包，人工执行并保存脱敏环境快照。
- 部署中心：基于离线模板创建部署任务。
- 变更中心：创建命令、SQL 或配置包，人工审批、人工执行、回填证据。
- AI 工作台：生成方案、分析人工报错、SQL 审查和知识草稿。
- AI 服务配置：独立管理 Provider、模型、Base URL 与会话密钥。
- Skill 专库：结构化 Skill、版本、状态、前置检查、验证和回滚。
- 双知识库：KB-Inner 与 KB-Public 隔离，外部资料验证后复制进入内部库。
- 工作区与备份：SQLite 自检、JSON 导出、安全合并恢复和试生产清单。
- 偏好与安全：明亮、深色、系统主题与运行边界检查。

## 安全边界

- 没有 SSH、SFTP、Shell、远程文件、远程进程或生产数据库执行能力。
- API Key 仅保留在进程内存，不进入 SQLite、备份、知识库或日志。
- 命令、SQL、Diff、验证和回滚只能复制后由工程师人工执行。
- 非零退出码不会进入验证成功状态。
- AI 和外部资料只能产生待审核草案。

## 开发与检查

```bash
npm install
npm run test
npm run build
npm run tauri:dev
```

## Windows Release

主分支通过 CI 后自动构建 NSIS 安装程序并发布到 GitHub Release：

```text
Agnovexa-OpsDesk-Windows-x64-Setup.exe
```
