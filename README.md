# 学程 Xuecheng

一个会长期了解你、主动和你说话、陪你形成判断并把建议落实到每天时间里的私人生活教育伙伴。

学程的核心不是一次生成方案，而是建立一段持续关系。她可以是引路人、朋友、家人式伙伴或伴侣式伙伴；她会理解，也会挑战，但不会替用户决定人生。

## 当前原型

当前根页面是 iPhone-first 可交互原型：

- 对话是首页，助手会主动提出观察和建议；
- 今日安排由她根据用户目标、习惯与现实状态提出；
- 每项安排包含时间、平台、动作、具体内容、完成标准和直接入口；
- “路径”记录长期方向为什么变化；
- “我们”允许修改形象、名字、关系定位、主动程度和界面氛围；
- 头像、设置与新增对话保存在本地；
- 尚未实现的数据来源只显示“开发中”，不会提供虚假连接按钮。

运行：

```bash
node scripts/test-all.mjs
node scripts/serve.mjs
```

打开 `http://localhost:4173`。旧的 Web 生活流保留在 `/web-preview`，方案研究页保留在 `/planner`，事件采集原型保留在 `/prototype`。

## 产品方向

1. iPhone companion：第一产品与最高优先级，承担对话、语音、主动联系、今日安排和伙伴形象。
2. Web showcase：GitHub 无需安装的产品演示与项目介绍，不替代手机日常体验。
3. Windows companion：后续承担文件、本地工具和跨端执行。
4. 家庭模式：在个人系统稳定后扩展，不直接复制个人方法。

GitHub 展示最终采用“iPhone 产品效果 + Web 可操作演示 + 开源核心与文档”的组合，是否公开 IPA 取决于后续签名与分发方案。

## 当前边界

- 当前已经包含 Capacitor iOS 工程，可以由 macOS/Xcode 或 Codemagic 编译；尚未配置 Apple 签名，因此暂时不会生成可安装的正式 IPA。
- 尚未接入模型、推送、日历、文件、微信或抖音账户。
- 演示对话和安排用于验证产品结构，不代表真实掌握了用户生活。
- 连接器必须在真实可用后才允许出现操作按钮。
- 自动测试验证软件行为，不证明教育效果。

## 项目结构

```text
apps/web/iphone.*          iPhone-first 产品原型
apps/web/companion-v3.*    保留的 Web 生活流
apps/web/assets/            原创默认伙伴形象
packages/event-schema/      统一事件协议
docs/                       集成与产品研究
scripts/                    零依赖本地服务与检查
ios/                        Capacitor 原生 iOS 容器
codemagic.yaml              Codemagic 无签名编译验证流程
```

## iOS 与 Codemagic

```bash
npm ci
npm run mobile:sync
```

`mobile:sync` 会把 iPhone 页面构建到 `dist/`，再同步进 `ios/App`。仓库根目录的 `codemagic.yaml` 先执行无签名编译，验证工程在 macOS 构建机上能够通过；Apple 签名和 TestFlight 发布会在 Bundle ID、Apple 团队与 App Store Connect 信息确认后启用。
