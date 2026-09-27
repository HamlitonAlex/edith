# XuechengNative

独立 SwiftUI 原生视觉验证工程。它不读取或修改 React、Capacitor、API、Repository 或 Agent 数据；当前页面内容用于本地静态展示。

## 本地运行

- 在 macOS 上使用 Xcode 16 或更新版本打开 `XuechengNative.xcodeproj`。
- 选择共享 Scheme `XuechengNative` 和 iPhone Simulator，然后运行。
- 最低部署版本为 iOS 17.0；现有 Bundle ID `app.xuecheng.nativeui` 已保留。

## 视觉映射

Figma Make MCP 已确认资源清单。当前 MCP 会话只返回源码资源链接，未能读取这些链接的文件正文；本工程的样式映射参考 2026-09-26 导出的 Make 源码快照。节点级坐标和在线文件最新改动尚未由 MCP 验证。

原 Make 字体为 DM Sans 与 Noto Serif SC，通过 Google Fonts 引入。原生工程不下载或复制字体文件，使用 iOS 系统 Sans / Serif 字体及中文系统回退，以确保离线显示。

## Codemagic

仓库根目录的 `codemagic.yaml` 提供无签名 iOS Simulator Debug 构建，用于远端编译验证；它不会生成可安装到真实 iPhone 的签名 IPA。Windows 环境不包含 Xcode 或 iOS Simulator，因此本地不能完成 Swift 编译。

之后进行 TestFlight 分发需要：

- Apple Developer Program 账户
- App Store Connect API Key
- 确认后的 Bundle ID
- Codemagic 中配置的签名证书与 Provisioning Profile
