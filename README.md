# Agnovexa Field OS

Agnovexa Field OS 是一款面向个人现场工程师的 Android 本地优先工作台，用于在一个应用中管理项目、任务、现场问题、服务器资产、命令手册、离线知识、日报和 AI Provider。

项目仍处于早期版本，核心数据默认保存在设备本机，不要求注册账号，也不依赖自建后端。

## 下载安装

[下载最新 APK](https://github.com/kllin8154-arch/Agnovexa-Field-OS/releases/latest/download/Agnovexa-Field-OS.apk)

支持 Android 8.0（API 26）及以上系统。首次安装时，Android 可能要求允许浏览器或文件管理器“安装未知应用”。

当前 `v0.1.0` 是公开预览版，安装包使用 Android 调试证书签名。后续切换为正式发布证书时可能需要先卸载预览版；卸载前请先在应用内导出备份。

## 主要能力

- 项目、任务、问题、服务器、命令、知识和日报的本地 CRUD
- Room FTS 统一检索命令、知识正文、标题和标签
- 按项目独立保存技术栈，支持搜索、批量自定义和图标自动识别
- 支持银河麒麟、Linux、ARM/aarch64、x86_64、Java 8/17 等完整版本描述
- 命令风险分级、命令包整包复制和复制前确认
- 现场问题转知识、AI 回答转命令/知识/日报
- OpenAI-compatible Provider 配置、连接测试、普通响应与 SSE 流式对话
- DeepSeek、通义千问、Kimi、智谱 GLM、硅基流动、OpenAI 和自定义服务预设
- Android Keystore + AES-GCM 加密保存 API Key
- 现场部署上下文与 Markdown/TXT/JSON 部署文档本地导入
- 深色、浅色、跟随系统和可上传 JSON 主题
- ZIP 备份导出、格式校验、事务恢复和恢复前快照
- 320dp 窄屏、大字体、长项目名和长技术版本的紧凑布局适配

## 隐私与安全边界

- 业务数据保存在应用私有目录中的 Room/DataStore。
- API Key 使用 Android Keystore 保护的 AES-GCM 主密钥加密。
- API Key、密码和私钥不会进入 ZIP 备份。
- App 不会直接执行 Shell 命令，只负责展示和复制。
- 恢复备份前会完成结构与内容校验，并先创建本机快照。
- 自定义主题解析失败时不会覆盖当前主题。
- HTTP Provider 仅适合可信局域网；公网服务应使用 HTTPS。

请勿在项目描述、部署上下文、知识正文或其他普通字段中保存密码、Token、私钥等秘密。

## 技术栈

- Kotlin 2.2.10
- Jetpack Compose + Material 3
- Hilt + MVVM + StateFlow
- Room 2.8.4 + FTS4
- DataStore
- Kotlin Serialization
- OkHttp
- Android Keystore
- Gradle Wrapper 9.2.1
- Android Gradle Plugin 9.0.1

## 环境要求

- JDK 17
- Android SDK 36
- Android Studio 或命令行 Android SDK 工具
- 最低 Android 版本：API 26

首次构建前，在项目根目录创建或由 Android Studio 自动生成 `local.properties`：

```properties
sdk.dir=C\:\\Android\\Sdk
```

请根据本机实际 Android SDK 路径修改，该文件已被 `.gitignore` 排除。

## 构建

Windows：

```powershell
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

macOS/Linux：

```bash
./gradlew testDebugUnitTest lintDebug assembleDebug
```

Debug APK 输出位置：

```text
app/build/outputs/apk/debug/app-debug.apk
```

编译 Android 仪器测试包：

```powershell
.\gradlew.bat assembleDebugAndroidTest
```

连接设备或模拟器后运行仪器测试：

```powershell
.\gradlew.bat connectedDebugAndroidTest
```

## 基本使用流程

1. 在“项目”中创建现场项目，并配置项目专属技术栈。
2. 在“运维”中登记任务、现场问题和服务器资产。
3. 使用命令工作台检索命令或巡检命令包，人工核对后复制。
4. 将已解决问题、部署资料或 AI 回答保存为本地知识。
5. 在“AI”页面添加自己的 OpenAI-compatible Provider，并先执行连接测试。
6. 在“我的”中管理主题以及导出或恢复本地备份。

## AI Provider

Provider 配置全部通过 App 界面完成，不需要在源码中写入密钥。Base URL 可以填写：

- 服务根地址
- 以 `/v1` 结尾的兼容地址
- 完整的 `chat/completions` 端点

项目不会附带任何可用 API Key。请使用你自己的服务账号，并遵守对应服务商的条款、数据政策和调用限额。

## 自定义主题

主题文件为 UTF-8 JSON，颜色使用 `#RRGGBB` 或 `#RRGGBBAA`。当前 schema 版本为 `1`，需要包含以下字段：

```json
{
  "schemaVersion": 1,
  "name": "主题名称",
  "background": "#08090B",
  "surface": "#111317",
  "surfaceElevated": "#181B20",
  "primary": "#D9FF72",
  "secondary": "#91FFD7",
  "success": "#91FFD7",
  "warning": "#FFCF70",
  "danger": "#FF8C8C",
  "textPrimary": "#F5F5EF",
  "textSecondary": "#C1C5CE",
  "outline": "#3A3E46"
}
```

即使颜色格式合法，应用仍会检查文字与背景对比度，并在必要时自动选择可读文字颜色。

## 项目结构

```text
app/src/main/java/com/kllin/agnovexa/fieldos/
├── core/          # AI、备份、数据库、偏好、主题、导入和密钥存储
├── data/          # Repository 实现
├── di/            # Hilt 依赖注入
├── domain/        # 领域模型、规则和 UseCase
└── presentation/  # Compose 页面、导航和 ViewModel
```

Room schema 位于 `app/schemas/`，数据库结构变更时必须保留历史 schema 并提供显式 Migration。

## 当前限制

- 这是早期个人版，不提供云端账号、多人协作或自动同步。
- 服务器信息当前作为资产记录保存，不提供内置 SSH 执行。
- AI 输出需要结合真实现场环境人工验证。
- Release 构建尚未配置正式签名，也未启用 R8。
- 不保证所有第三方 OpenAI-compatible 服务都具有完全一致的 SSE 和错误响应格式。

## 开源范围

公开仓库只包含构建应用所需的源码、资源、测试、Room schema 和 Gradle 配置。内部开发提示词、产品规划、设计原型、技术情报、测试记录及其他研发过程资料不属于开源发布内容。

## 许可证与第三方资源

项目代码以 [Apache License 2.0](LICENSE) 发布。

界面操作图标来自 AndroidX Compose Material Icons，遵循 Apache-2.0。随 APK 打包的技术品牌轮廓来自 [Simple Icons](https://simpleicons.org/)，版本 `16.21.0`，其图标库采用 CC0-1.0；品牌名称和标识仍可能受各自商标政策约束。本项目使用这些图标仅用于描述对应技术，不代表品牌方背书或合作关系。

Android、Kotlin、Jetpack Compose、OpenAI、DeepSeek、GitHub 以及其他文中提及的名称和商标归各自权利人所有。

## 贡献

欢迎通过 Issue 报告可复现问题。提交代码前请确保：

- 不包含 API Key、Token、密码、私钥或真实现场数据
- 单元测试和 lint 通过
- 数据库变更包含 Migration 和 schema
- UI 改动检查 320dp/360dp、深浅主题和大字体
