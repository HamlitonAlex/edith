# 学程 Xuecheng

> 一位会长期了解你、主动联系你，并把建议落实到今天具体时间和现实入口里的私人教育伙伴。

<p align="center">
  <img src="docs/assets/iphone-preview.png" width="390" alt="学程 iPhone 对话首页：伙伴主动提出建议，并生成包含时间、平台、内容和完成标准的具体安排">
</p>

学程不是一次生成一份“人生方案”的聊天机器人。她通过持续对话理解你的处境，与现实日程和信息来源结合，陪你形成判断，再把判断变成今天真正能完成的一件事。

[在线 iPhone 模拟器](https://appetize.io/app/ios/com.xuecheng.companion?device=iphone14pro&osVersion=16.2&toolbar=true) · [产品定义](PRODUCT.md) · [GitHub 首发方案](docs/github-showcase.md)

## 它有什么不同

- **对话是入口**：不要求用户先填复杂问卷，也不把维护系统变成另一项工作。
- **建议必须落地**：每项安排都包含时间、平台、具体内容、动作和完成标准。
- **伙伴会主动，但尊重边界**：主动程度和绝对安静时段可由用户控制。
- **人生路径会持续变化**：路径记录方向、依据和变化，而不是展示一张固定模板。
- **本地优先**：个人数据默认本地保存，云同步与外部模型由用户选择。

## 当前可以体验

| 能力 | 状态 |
| --- | --- |
| iPhone 对话首页、按住说话入口 | 可演示 |
| 具体到平台和内容的今日安排 | 可演示 |
| 路径地图与调整理由 | 可演示 |
| 伙伴名字、关系、主动程度和主题 | 可演示，本地保存 |
| iOS 模拟器构建与未签名 IPA | 已配置自动构建 |
| 日历、文件、微信、抖音数据接入 | 规划中，当前不伪装为已连接 |
| 云端模型、主动通知、跨端同步 | 规划中 |

## 三分钟运行

需要 Node.js 22 或更新版本。

```bash
npm ci
npm test
npm run dev
```

打开 `http://localhost:4173`。生产静态站点输出到 `dist/`：

```bash
npm run build:web
```

旧的 Web 生活流保留在 `/web-preview`，方案研究页在 `/planner`，事件采集原型在 `/prototype`。

## 构建 iPhone 应用

项目使用 Capacitor 共享 Web 界面，并保留原生 iOS 容器：

```bash
npm run mobile:sync
```

Windows 可以完成网页构建与同步，但 iPhone 二进制仍需要 macOS/Xcode。仓库中的 `codemagic.yaml` 提供两个流程：

- `ios-simulator-preview`：生成可上传 Appetize 的 `.app` 模拟器包；
- `ios-unsigned`：生成 `Xuecheng-unsigned.ipa`，供用户使用自己的签名工具签名后安装。

未签名 IPA 不能直接安装，也不等同于 TestFlight 或 App Store 正式发行包。

## 产品结构

```text
自然对话 / 语音 / 授权数据
            ↓
     观察、记忆与判断
            ↓
今天的具体行动 ←→ 长期路径地图
            ↓
     反馈真实发生的变化
```

## 项目结构

```text
apps/web/iphone.*           iPhone-first 产品界面
apps/web/assets/            默认伙伴形象
packages/event-schema/      统一事件协议
ios/                        Capacitor 原生 iOS 容器
docs/                       产品、集成与研究文档
codemagic.yaml              iOS 模拟器与 IPA 构建
.github/workflows/pages.yml Web 演示自动部署
```

## 设计边界

- 演示对话和安排用于验证产品结构，不代表系统真实掌握了用户生活。
- 连接器只有真实可用后才会出现连接操作。
- 自动测试验证软件行为，不证明教育效果。
- 伙伴可以提出挑战和新方向，但高风险执行必须由用户确认。

## 路线

1. 稳定 iPhone 对话、输入、语音和今日安排闭环；
2. 接入模型供应商与可审计的长期记忆；
3. 从日历和文件开始实现授权数据接入；
4. 增加主动通知、安静时段和执行确认；
5. 在个人系统稳定后扩展家庭模式与 Windows 端。

如果你认同“AI 不该只活在聊天框里”，欢迎通过 Issue 参与产品边界、隐私架构、移动端体验或数据连接器的讨论。
