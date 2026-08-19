# Agnovexa OpsDesk Desktop

本目录是 Agnovexa OpsDesk 的 Windows 桌面端源码，采用 **Tauri 2 + React 19 + TypeScript + Vite + Rust + SQLite**。

## 最新 Windows 安装包

[**下载 Agnovexa OpsDesk Windows x64 EXE**](https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest/download/Agnovexa-OpsDesk-Windows-x64-Setup.exe)

[打开最新 Release](https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest)

## 永久执行边界

- 不接入 SSH、SFTP、Shell、远程进程或生产数据库直连；
- 命令、SQL、配置 Diff、验证和回滚只作为可复制文本；
- 现场工程师人工审阅、人工执行并回填退出码、stdout、stderr 和现场说明；
- 非零退出码不能进入验证通过；
- AI 只能生成草案、分析报错和给出下一轮建议，不能执行操作。

## AI Provider

支持 DeepSeek、OpenAI、通义千问、Kimi、智谱 GLM、硅基流动、本地服务以及自定义 OpenAI-compatible 接口。API Key 按运行时临时输入设计，不进入 Git、报告和普通业务数据。

## 本地开发

```powershell
npm install
npm run prepare:icons
npm run test
npm run build
npm run tauri:dev
```

构建 Windows NSIS 安装包：

```powershell
npm run tauri:build:windows
```

输出目录：

```text
src-tauri/target/release/bundle/nsis/
```

## 页面

- 工作台；
- 服务器资产；
- 现场诊断；
- 部署中心；
- 变更与人工执行证据；
- 多 Provider AI 助手；
- 双知识库；
- 安全与运行设置。

## 发布

主分支通过 `.github/workflows/desktop-web-check.yml` 完成测试、Windows Tauri 检查、NSIS 构建和 GitHub Release 发布。Release 中的固定资产名为：

```text
Agnovexa-OpsDesk-Windows-x64-Setup.exe
```
