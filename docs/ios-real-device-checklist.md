# 学程 iOS 真机验收清单

基线：`fd7345b feat(ui): switch app runtime to react`

本清单只覆盖真实 iOS / WKWebView 验收准备，不改变 React 入口、页面 UI、API、数据库或认证协议。

## 1. 当前 Capacitor 链路

```text
npm run build:mobile
  -> Vite 构建 dist/index.html（React 正式入口）
  -> dist/runtime/iphone.html（兼容运行时）
  -> npx cap copy ios
  -> ios/App/App/public
  -> ios/App/App.xcodeproj
  -> WKWebView 加载 public/index.html
```

当前入口：

- Web / Capacitor 入口：`index.html` → `/assets/main-*.js` → React `src/main.tsx`
- 兼容运行时：`runtime/iphone.html`，由 React 的隐藏 iframe 加载，继续承载既有 Agent、Repository、认证和语音桥接
- `react.html` 仅保留为开发预览入口，不是生产入口
- iOS Bundle ID：`com.xuecheng.companion`
- iOS Deployment Target：15.0
- Swift：5.0

构建和同步：

```bash
npm ci
npm run build:mobile
npx cap copy ios
# 等价项目脚本：npm run mobile:sync
```

`cap copy ios` 只复制 Web 资源，不执行 Xcode 构建，也不会替代签名配置。工程文件为 `ios/App/App.xcodeproj`；Windows 无法执行 `xcodebuild` 或打开 Xcode。

## 2. 原生桥接核对

### 语音与权限

```text
React ChatInputBar
  -> React adapter / hidden runtime
  -> window.webkit.messageHandlers.xuechengSpeech.postMessage
  -> XuechengBridgeViewController.swift
  -> AVAudioEngine + SFSpeechRecognizer
  -> xuecheng:speech CustomEvent
  -> runtime snapshot / postMessage
  -> React 输入栏回填文字
```

- 权限声明：`NSMicrophoneUsageDescription`、`NSSpeechRecognitionUsageDescription`
- 支持：开始、松手识别、上滑取消、权限拒绝、识别失败、无语音结果
- 默认先请求本机识别；设备不支持本机识别时，必须先取得用户同意才允许 Apple 云端处理
- 原始音频不进入 React 消息、普通同步载荷或备份
- 识别结果只回填输入框，不自动发送

### 键盘与可视区域

- Swift 监听 `keyboardWillChangeFrame` / `keyboardWillHide`
- 向 WebView 派发 `xuecheng:native-keyboard`
- Web 层同时使用 `visualViewport` 作为 WKWebView 变化的补充信号
- React ChatInputBar 使用安全区域和键盘状态隐藏底部导航

### 存储与同步

- 没有独立的原生数据库桥；本地优先数据仍由 WKWebView 的 scoped `localStorage` 管理
- 模型 Key 只在 `sessionStorage`，不进入资料、对话、备份或同步
- 备份和云同步仍是用户主动操作
- 账号切换由运行时按已验证身份切换本地 scope

### 生命周期与外链

- 应用进入后台时原生层取消进行中的语音会话
- Scene URL / Universal Link 继续交给 Capacitor 的 `SceneDelegateProxy`
- 前后台恢复、系统回收 WebView、外链返回需要在真机补测

## 3. 真机验收清单

### 启动与首次状态

- [ ] 冷启动显示原生 LaunchScreen 后进入 React Splash
- [ ] Splash 不显示 Onboarding 控件或滑屏内容
- [ ] 新用户进入 Onboarding
- [ ] 已完成引导的用户直接进入 Home
- [ ] 强制杀进程后重新打开，本地状态仍正确

### 页面

- [ ] Home 空状态
- [ ] Home 有真实 Next Step
- [ ] Conversation 空聊天
- [ ] Conversation 历史消息恢复
- [ ] Conversation 发送、失败提示和重试
- [ ] Schedule 已确认日程
- [ ] Schedule AI 建议保持待确认
- [ ] Profile 修改伙伴设置、主题和安静时段
- [ ] Profile 主动同步入口显示正确状态

### 键盘与滚动

- [ ] 输入框聚焦后键盘弹起，输入栏完整可见
- [ ] 输入框字体不会触发 iOS 自动缩放
- [ ] 多行输入可以滚动，发送按钮不被遮挡
- [ ] 键盘弹出时底部导航不与输入栏重叠
- [ ] 键盘关闭后页面高度和底部导航恢复
- [ ] 首页、对话、日程、我的页面均无横向溢出
- [ ] 刘海、状态栏和 Home Indicator 安全区不重复计算

### 语音

- [ ] 首次请求麦克风权限
- [ ] 首次请求语音识别权限
- [ ] 长按输入栏开始录音
- [ ] 录音中显示真实状态，不播放假波形
- [ ] 正常松手进入识别
- [ ] 上滑后松手取消录音
- [ ] 识别成功回填可编辑文字
- [ ] 识别结果不会自动发送
- [ ] 无语音结果显示可重试提示
- [ ] 权限拒绝提示用户到系统设置开启
- [ ] 设备不支持本机识别时显示云端处理征求同意
- [ ] 前后台切换或来电时录音被安全取消

### 网络与同步

- [ ] 无网络时仍可查看和编辑本地内容
- [ ] 无网络发送失败时本地消息不丢失
- [ ] 网络恢复后不自动上传私人资料
- [ ] 用户主动同步成功并显示最近同步时间
- [ ] 主动同步失败显示可理解错误
- [ ] 未登录不上传数据
- [ ] 用户 A / B 切换后数据不串号
- [ ] 服务器冲突不会静默覆盖本地内容

## 4. iOS 兼容风险记录

| 项目 | 当前状态 | 真机需要确认 |
| --- | --- | --- |
| WKWebView viewport | 已配置 `viewport-fit=cover` 与 `interactive-widget=resizes-content` | 键盘弹出、旋转和后台恢复 |
| Safe Area | React shell、运行时和原生键盘事件均有处理 | 刘海机型、Home Indicator、键盘关闭后的恢复 |
| overflow | React body 锁定，DeviceFrame/页面内部滚动 | 长对话、长 URL、横竖屏切换 |
| touch event | 语音长按使用 pointer 事件与 pointer capture | 真机长按、上滑取消、系统手势冲突 |
| Speech Framework | 原生桥接已编码，Windows/浏览器未验证 | 真实麦克风、中文转写、权限拒绝、云端同意 |
| 本地存储 | WKWebView localStorage scoped；无原生存储桥 | 进程终止、系统存储压力、账号切换 |
| 签名 | 工程使用 Automatic Signing，未在 Windows 构建 | Team、Provisioning、真机安装 |
| Launch storyboard | 工程已有 LaunchScreen 与 Main storyboard | 原生启动图到 React Splash 的过渡 |

## 5. Mac + iPhone 执行步骤

1. 在 Mac 上安装 Xcode，并在 Xcode 中打开 `ios/App/App.xcodeproj`。
2. 连接已信任的 iPhone，选择真实设备和 `App` scheme。
3. 确认 Signing & Capabilities 中 Team、Bundle Identifier 和开发证书有效。
4. 在项目根目录执行 `npm ci`、`npm run build:mobile`、`npx cap copy ios`。
5. 回到 Xcode 构建并安装到 iPhone；首次运行按系统提示信任开发者证书。
6. 按本清单逐项验收，记录设备型号、iOS 版本、网络状态和结果。
7. 语音验收必须在真实 iPhone 完成；浏览器和 Windows 不能替代该验证。

## 6. Windows 限制

- Windows 不能安装或运行 Apple Xcode、`xcodebuild`、Apple iOS Simulator。
- Chrome 设备模式只能验证 CSS 视口，不能验证 WKWebView 键盘、Safe Area、麦克风权限或 Speech Framework。
- 当前在 Windows 已完成 Web 构建、Capacitor 资源复制、静态包一致性检查和浏览器回归；这些不等于真机通过。
