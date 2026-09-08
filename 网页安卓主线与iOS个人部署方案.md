# 网页、Android 主线与 iOS 个人部署方案

> 日期：2026-09-05  
> 决策：GitHub 项目优先建设网页工作台和 Android 采集端；iOS 作为个人部署与实验性伴生端，不以 App Store 量产为首期目标。

## 1. 结论

推荐采用四层产品：

```text
网页工作台             Android 采集端          iOS 个人采集端
方案、时间线、复盘      主力系统采集与快捷输入    Shortcuts + 自签名伴生 App
         \                 |                 /
          \                |                /
                 自建事件服务
          事件账本 / 连接器 / 推理 / 方案版本
```

网页负责完整体验与开源传播；Android 负责验证主动采集；iOS 先通过个人自动化和自签名安装获得可用能力。三端使用同一事件格式和自建服务，iOS 不必达到面向所有用户发布的完整度。

## 2. 个人安装能绕开什么，不能绕开什么

个人使用 Xcode 直接在真机运行，或者把构建分发给已登记的测试设备，可以省去 App Store 页面、公开审核和大众分发流程。Xcode 支持使用 Apple Developer Program 或个人 Apple Account 为真机创建开发配置；登记设备也可以在不经过 beta 审核的情况下安装测试构建。[Xcode 真机运行](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)、[分发到登记设备](https://developer.apple.com/documentation/Xcode/distributing-your-app-to-registered-devices)

下列限制仍然存在：

- iOS 在应用进入后台后通常会挂起它；后台任务由系统选择执行时间，并非任意常驻定时器。[Background Tasks](https://developer.apple.com/documentation/BackgroundTasks)、[延长后台执行时间](https://developer.apple.com/documentation/uikit/extending-your-app-s-background-execution-time)
- 麦克风、健康、位置等仍需系统权限。
- 部分能力需要特定 entitlement，账号类型和 Apple 批准会限制可用能力。[添加 App Capability](https://developer.apple.com/documentation/xcode/adding-capabilities-to-your-app)
- 自签名不会让普通应用读取其他 App 的私有数据库、聊天正文或内部页面。
- 操作系统升级仍可能改变后台行为，个人部署也需要维护。

因此，个人部署增加的是“安装与实验自由度”，不是获得系统最高权限。

## 3. iOS 路线一：Shortcuts 优先，推荐最先实现

这一层甚至不要求先开发 iOS App。用户安装项目提供的快捷指令模板，把结构化事件发送到自己的服务。

### 可实现的入口

- Siri 触发：“记录一次学习”；随后听写一句话并发送；
- 分享菜单运行快捷指令，把网页、文本、图片或文件发送到事件服务；
- 到达、离开、时间、闹钟、睡眠、Wi-Fi、蓝牙、NFC、打开 App、锻炼等事件触发个人自动化；
- 读取用户选择的日历、提醒事项和健康摘要，再发送必要字段；
- 在锁屏、操作按钮、桌面小组件或手表上触发。

Apple 当前列出的多类个人自动化可以设置为不询问直接运行，包括时间、地点、Wi-Fi、蓝牙、Apple Watch 锻炼、NFC、App、专注模式、电量和充电器等。[Shortcuts 自动运行说明](https://support.apple.com/en-me/guide/shortcuts/apd602971e63/ios)、[创建个人自动化](https://support.apple.com/en-sg/guide/shortcuts/apdfbdbd7123/ios)

### 适合产品的模板

| 快捷指令 | 触发方式 | 生成的事件 |
|---|---|---|
| 说一句 | Siri、操作按钮、锁屏 | 本人陈述或家长观察 |
| 分享到学程 | 系统分享菜单 | 材料、作品或待阅读内容 |
| 学习开始／结束 | 桌面、NFC、App 打开 | 活动区间，仍不等于掌握 |
| 晚间同步 | 时间或充电触发 | 日历、提醒事项的最小摘要 |
| 锻炼完成 | Apple Watch 锻炼结束 | 运动行为信号 |
| 到家摘要 | 到达家庭地点 | 请求服务器返回一条待确认事项 |

自动化先写入本地临时文件，在有网络时批量发送，能够减少网络失败造成的数据丢失。服务返回事件编号，快捷指令只展示“已收到”，不要求用户继续填写。

### 优点与不足

优点是开发快、个人可高度定制、系统触发丰富、无需 App Store。缺点是初次安装需要用户导入模板并配置服务地址；快捷指令之间的状态管理、复杂去重和界面能力有限；其他 App 没有暴露给 Shortcuts 的数据仍然拿不到。

## 4. iOS 路线二：Xcode 自签名伴生 App

Shortcuts 验证有效后，再做原生伴生 App。它主要解决统一收件箱、离线缓存、录音、分享扩展、通知确认和本地敏感信息处理。

### 建议能力

- App Intents：把“开始活动”“说一句”“同步摘要”“确认推测”暴露给 Siri、Shortcuts 和系统界面。Apple 明确将 App Intents 用于 Siri、Shortcuts、Spotlight 等系统体验。[App Intents](https://developer.apple.com/documentation/AppIntents/app-intents)
- Share Extension：接收用户主动分享的网页、图片、文本和文件；先写入共享容器，再由主 App 同步。
- 本地事件队列：离线保存、去重、失败重试和加密。
- 推送与通知动作：直接在通知中确认、否定或稍后处理。
- HealthKit：只读取用户选择且对方案必要的聚合数据。HealthKit 对每类数据单独授权，用户随时可以撤销。[HealthKit 配置与授权](https://developer.apple.com/documentation/Xcode/configuring-healthkit-access)
- BGTaskScheduler：在系统允许的时机整理队列、拉取摘要和进行短处理，不承诺精确执行时间。[BGTaskScheduler](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler)
- 可选的短录音：用户触发后开始，转写或上传完成后停止。

### 关于后台录音

iOS 允许在用户已经开始录音后，应用锁屏或进入后台时继续录制；Apple 文档要求使用录音音频会话、取得麦克风权限，并配置 `UIBackgroundModes` 的 `audio` 值。[AVAudioSession 录音类别](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/record)

这适合“按一下开始，走路时讲几分钟，按一下结束”。它不等于应用可以在后台任意时间静默打开麦克风，也不适合全天录音。电话、闹钟或其他音频会话还可能中断录制。

## 5. iOS 路线三：可选的个人实验能力

### Screen Time / Device Activity

可用于按选定 App、类别或网站统计使用时间与达到阈值事件。它的设计目标包括隐私保护，部分能力需要 Family Controls capability 或专门 entitlement。[Screen Time 技术框架](https://developer.apple.com/documentation/ScreenTimeAPIDocumentation)、[Family Controls 配置](https://developer.apple.com/documentation/Xcode/configuring-family-controls)

可以把它作为个人设备上的实验模块，但核心产品不能依赖它返回所有 App 内部行为。使用时长仍然只是弱信号。

### 位置与运动触发

可用于“到学校”“离开图书馆”“锻炼结束”等情境事件。优先由 Shortcuts 触发；只有 Shortcuts 无法满足时才在 App 中请求位置后台模式。记录地点类别即可，通常不需要长期保存精确轨迹。

### Network Extension、VPN 或 DNS

自建 VPN 或 DNS 能观察域名级网络活动，某些 Network Extension 能力还存在 entitlement 或受监管设备条件；加密流量也不会自然变成可理解的学习内容。[Network Extension](https://developer.apple.com/documentation/networkextension)、[配置 Network Extension](https://developer.apple.com/documentation/xcode/configuring-network-extensions/)

它适合网络研究或过滤，不适合作为首版学习采集器。所得数据噪声大、语义弱，也会显著增加维护与信任成本。

### MDM / 受监管设备

MDM 更适合组织管理和远程配置。单人自用也可以搭建，但投入与收益不匹配，并不会自动提供其他 App 的完整语义数据。[Apple Device Management](https://developer.apple.com/documentation/devicemanagement/)

### 越狱

越狱可能绕过部分沙盒限制，但会让方案依赖特定设备和系统版本，增加安全风险和维护负担，也无法作为 GitHub 项目的通用演示路径。可以作为独立研究分支，不进入产品路线和默认文档。

## 6. Android 主线

Android 端是主动采集的主要工程载体，首版按权限层级递进：

### 默认能力

- 系统分享接收；
- 快捷设置、桌面小组件和语音入口；
- 日历和用户选择的文件；
- 前台活动计时；
- 离线事件队列与后台同步；
- 通知中的快速确认。

### 用户主动开启的实验能力

- UsageStats：取得各 App 的聚合使用情况或使用事件，需要特殊使用访问权限。[UsageStatsManager](https://developer.android.com/reference/android/app/usage/UsageStatsManager)
- NotificationListener：读取新通知事件，需要用户授予通知访问；先做设备端规则过滤，只把选定 App 的必要字段转为事件。[NotificationListenerService](https://developer.android.com/reference/android/service/notification/NotificationListenerService)
- Health Connect：读取授权的活动、睡眠等数据；后台和历史读取分别需要额外权限。[Health Connect 数据类型](https://developer.android.com/health-and-fitness/health-connect/data-types)

通知读取不能默认启用，也不能把所有正文上传服务器。更合理的实现是在设备端维护来源白名单和字段提取规则，例如只从某个课程 App 的“作业完成”通知提取课程、状态和时间。

## 7. 网页工作台

网页是 GitHub 访客最容易体验的部分，也是用户进行深度理解和修改的地方：

- 查看当天生活流和数据来源；
- 从事件追溯到原始来源；
- 查看学习地图、阶段路径和家庭共同空间；
- 批量纠正关联与推测；
- 预览并采用方案调整；
- 管理连接器、权限、保存期限、导出和删除；
- 运行两个虚构数据演示，无需授予真实权限。

网页本身也可以作为 PWA 安装到手机，但 PWA 不承担系统级主动采集。它负责快速访问与展示，原生采集能力由 Android 和 iOS 伴生端提供。

## 8. 统一事件接口

所有端只需向自建服务提交统一事件。概念格式：

```json
{
  "event_id": "device-generated-id",
  "occurred_at": "2026-09-05T18:40:00+08:00",
  "source": { "type": "ios_shortcut", "name": "voice_capture" },
  "actor": "self",
  "kind": "self_report",
  "content": { "text": "内容听懂一半，例题还不会" },
  "goal_hint": "data-analysis",
  "visibility": "private",
  "consent_scope": "explicit_capture",
  "device_processed": true
}
```

服务端依次执行：鉴权、格式验证、去重、敏感字段过滤、目标关联、候选推测和摘要。原始事件与系统推测分开保存；方案更新必须生成预览并等待用户采用。

## 9. 推荐仓库结构

```text
apps/
  web/                 网页工作台和公开演示
  android/             主力采集端
  ios-companion/       个人自签名伴生 App，第二阶段

integrations/
  apple-shortcuts/     可导入的快捷指令及配置说明
  connectors/          日历、任务、课程等连接器

packages/
  event-schema/        统一事件格式
  event-engine/        去重、关联、推测与审计
  learning-plan/       学习地图和方案版本
  evals/               错误归因、过度推断与权限测试

examples/
  personal-learning/
  family-learning/
```

仓库首页先展示网页演示，Android 提供最完整的可采集体验，iOS 文档明确标为 Personal Deployment Lab。这样既诚实，又能把个人实验能力开放给愿意折腾的用户。

## 10. 分阶段实现顺序

### 阶段一：不做原生 iOS App

完成网页工作台、事件接口、Android 基础采集端和三条 Apple Shortcuts：语音记录、分享材料、自动发送日历摘要。用自己的设备验证一天数据是否能进入同一时间线。

### 阶段二：证明自动事件有价值

加入 Android UsageStats 白名单、一个正式软件连接器、事件关联和批量确认。测量每天需要人工处理的次数，以及自动数据中真正有用的比例。

### 阶段三：自签名 iOS 伴生端

加入 App Intents、Share Extension、本地队列、通知动作和短录音。BGTaskScheduler 只承担机会式同步，不依赖精确定时。

### 阶段四：可选个人实验

按真实需求选择 HealthKit、Device Activity、位置或 Network Extension。没有具体教育场景和收益证据的能力不接入。

## 11. 最终判断

“网页＋Android 主线，iOS 个人部署”比要求三端同时量产更适合这个 GitHub 项目。iOS 并非无路可走：Shortcuts 已经能提供相当丰富的触发器和自动 webhook；自签名 App 能补齐分享、语音、通知和本地处理。系统级限制仍然决定了它不可能成为随意读取所有 App 的后台守护进程。

最有价值的技术方向不是突破每一道系统限制，而是建立一套允许多种采集端共同写入、保留来源和不确定性、能够审计教育判断的事件系统。这样 Android 可以采得更丰富，iOS 可以采得更克制，网页和教育方案仍使用同一底层。

