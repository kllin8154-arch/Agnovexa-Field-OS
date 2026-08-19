# Agnovexa OpsDesk

[![Desktop CI](https://github.com/kllin8154-arch/Agnovexa-Field-OS/actions/workflows/desktop-web-check.yml/badge.svg?branch=main)](https://github.com/kllin8154-arch/Agnovexa-Field-OS/actions/workflows/desktop-web-check.yml)
[![Windows EXE](https://img.shields.io/badge/Windows-x64%20EXE-0078D4?logo=windows)](https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest/download/Agnovexa-OpsDesk-Windows-x64-Setup.exe)
[![Manual execution](https://img.shields.io/badge/Execution-human--only-d7ff71)](#安全边界)

**Agnovexa OpsDesk** 是面向离线现场部署、运维排障和项目知识沉淀的 Windows 桌面工作台。

桌面版已经成为本仓库的主产品。现有 Android 代码仍保留在 `app/`，作为历史实现与后续轻量辅助端；桌面端源码位于 `desktop/`。

## 直接下载

### Windows x64 安装程序

[**下载最新 Agnovexa OpsDesk Windows x64 EXE**](https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest/download/Agnovexa-OpsDesk-Windows-x64-Setup.exe)

也可以打开 [Releases 页面](https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest) 查看版本说明和安装包。

> 当前为未签名预览版。Windows SmartScreen 可能显示“未知发布者”，请确认下载域名为 `github.com/kllin8154-arch/Agnovexa-Field-OS` 后再安装。

## 产品原则

```text
系统生成方案、命令和 SQL
→ 工程师人工核对
→ 工程师在目标环境人工执行
→ 回填退出码、stdout、stderr 和现场说明
→ 选择 AI Provider 分析报错
→ 人工执行修订方案并验证
→ 人工确认后沉淀知识
```

Agnovexa OpsDesk 不代替工程师操作生产环境。

## 已实现能力

- 项目、服务器资产和环境快照台账；
- Shell 命令包与 SQL 执行包生成、复制、审阅和留痕；
- 人工执行结果回填：实际命令、退出码、标准输出、错误输出和现场说明；
- 报错脱敏、AI 分析、修订建议、验证命令和回滚建议；
- DeepSeek、OpenAI、通义千问、Kimi、智谱 GLM、硅基流动及自定义 OpenAI-compatible 接口；
- 内部知识库、公共待审知识库、Skill 和全文检索；
- SQLite 本地持久化、工作区备份和 Markdown 部署报告；
- Windows Tauri 桌面壳与 NSIS 安装包。

## 安全边界

以下能力被明确禁止：

- 不连接 SSH；
- 不启用 SFTP；
- 不注册 Shell 或进程执行权限；
- 不直连生产数据库；
- 不自动执行命令或 SQL；
- 不自动回滚；
- 不把生产密码、Token、私钥或完整数据库连接串写入知识库；
- 不把未经审核的外部资料升级为已验证 Skill。

所有目标服务器与数据库操作都必须由现场工程师人工完成。

## AI Provider

Provider 配置支持：

- DeepSeek；
- OpenAI；
- 通义千问 / DashScope；
- Kimi / Moonshot；
- 智谱 GLM；
- 硅基流动；
- 本地或自建 OpenAI-compatible 接口；
- 自定义 Base URL、模型名称和请求参数。

API Key 不应进入 Git、报告、知识条目或普通 SQLite 业务表。当前桌面版按运行时临时输入设计，后续可接入 Windows Credential Manager。

## 本地开发

前置条件：

- Node.js 22；
- Rust stable；
- Windows WebView2；
- Tauri 2 构建依赖。

```powershell
cd desktop
npm install
npm run prepare:icons
npm run test
npm run build
npm run tauri:dev
```

生成 Windows NSIS 安装包：

```powershell
cd desktop
npm install
npm run tauri:build:windows
```

安装包输出目录通常为：

```text
desktop/src-tauri/target/release/bundle/nsis/
```

## 项目结构

```text
.
├── desktop/                    # Agnovexa OpsDesk 主产品
│   ├── src/                    # React + TypeScript 前端
│   ├── src-tauri/              # Rust/Tauri 后端与 SQLite 迁移
│   └── package.json
├── app/                        # 原 Android Field OS，保留为辅助端基础
├── docs/                       # 架构决策与设计文档
└── .github/workflows/          # 桌面 CI 与 Windows EXE Release
```

## 技术栈

- Tauri 2；
- React 19；
- TypeScript；
- Vite；
- Rust；
- SQLite / FTS5；
- Vitest；
- GitHub Actions；
- NSIS Windows Installer。

## 当前阶段

当前版本重点验证“人工执行闭环、离线桌面工作台、多 AI Provider 和知识沉淀”。后续迭代继续完善 SQLite Repository、导入解析、版本化快照、双知识库检索和已验证 Skill 管理。
