# XuechengNative

独立 SwiftUI 原生视觉验证工程。它不读取或修改 React、Capacitor、API、Repository 或 Agent 数据；当前页面内容来自 `Preview/PreviewFixtures.swift`，仅用于静态展示，不表示真实学习判断。

## 工程分层

- `App/`：启动状态与外观选择。启动后交给 `XuechengNavigation`。
- `Components/`：可复用的卡片、按钮、栏目、输入、证据展示及独立于滚动内容的底部导航。
- `DesignSystem/`：`XuechengTheme`、`XuechengTypography`、环境背景和原生 Material Surface。
- `Models/`：仅供 UI 使用的 Direction、Goal、Capability、Evidence、Practice、NextStep、StudySession、LearnerProfile 等展示模型；不是数据库或 API 契约。
- `Preview/`：统一的中文静态样本。实际产品接入时由服务端/Repository 映射到展示模型，不应把样本当业务数据。
- `Screens/`：四个一级页面（今天、路径、小程、我的）及能力详情、学习过程、学习结果、日程、设置等二级页面。

当前没有 `Services/` 实现：这轮不接后端，不增加虚假的服务层。以后接入时在此边界做数据映射，页面不直接处理 API。

底部导航由 `Components/XuechengNavigation.swift` 在 `TabView` 外围的安全区域管理，不在页面 `ScrollView` 中；二级路径非空时隐藏。设置使用原生 `NavigationStack` 的返回栏，学习过程也不显示底部导航。

## 本地运行

- 在 macOS 上使用 Xcode 16 或更新版本打开 `XuechengNative.xcodeproj`。
- 选择共享 Scheme `XuechengNative` 和 iPhone Simulator，然后运行。
- 最低部署版本为 iOS 17.0；现有 Bundle ID `app.xuecheng.nativeui` 已保留。

## 视觉映射

2026-09-29 的 Figma Make 源码 ZIP 已用于校准 `XuechengTheme`、九个语义排版 Token、环境背景、共享 Surface 和底部导航。ZIP 没有独立的能力详情与学习结果页面源码；这两个原生页面仅继承共享 Token，不能称为逐页精准还原。

工程中没有 Noto Sans SC、Noto Serif SC 或 DM Sans 字体文件，也没有 `UIAppFonts` 配置。`XuechengTypography` 暂用 iOS 系统 Sans / Serif 回退；获得合法字体资源后需接入并在 macOS 上验证 PostScript 名称。

需在真实 iOS Simulator 中核对中文换行、原生安全区与 Material；CSS `backdrop-filter` 与 SwiftUI Material 不保证像素级等同。

## Codemagic

仓库根目录的 `codemagic.yaml` 提供无签名 iOS Simulator Debug 构建，用于远端编译验证；它不会生成可安装到真实 iPhone 的签名 IPA。Windows 环境不包含 Xcode 或 iOS Simulator，因此本地不能完成 Swift 编译。

之后进行 TestFlight 分发需要：

- Apple Developer Program 账户
- App Store Connect API Key
- 确认后的 Bundle ID
- Codemagic 中配置的签名证书与 Provisioning Profile
