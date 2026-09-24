# 学程 iOS Release 构建记录

## 源码与版本

- 功能基线：`bd1b99c feat(ai): connect memory context and next step`。
- Bundle ID：`com.xuecheng.companion`。
- App Version：`1.0.2`；iOS Build Number：`5`。
- 正式 Web 入口：`apps/web/index.html` → React `src/main.tsx`。旧运行时作为隔离的兼容层位于 `runtime/iphone.html`。
- 本次发布准备修复了移动端打包脚本遗漏的 `memory-repository.js`。因此，不得将修复后生成的安装包标记为 **精确对应 `bd1b99c`**；Mac 构建须记录实际检出的完整 Git SHA。

## 本版能力

- 小程在对话中提出长期目标记忆建议；用户点击「记住」后才确认。
- 已确认记忆、相关学习证据与有限的近期消息进入有界模型上下文；开发态可查看来源。
- 首页根据已确认目标、学习证据、近期记录和今日状态展示一条 Next Step。

## 已完成的构建与验证

- Windows：`npm run build:mobile` 成功，React 正式入口及隔离运行时已生成到 `dist/`。
- 初次 Web 构建记录：2026-09-24 21:39:55–21:39:56（北京时间，约 1.43 秒）；修复打包脚本后已重新构建并同步。
- Windows：`npx cap sync ios` 成功，将 Web 资源复制到 `ios/App/App/public/`。
- `npm run test:mobile-package`：92 项通过，校验 iOS 资源与 `dist/` 一致，且记忆模块已包含在包内。
- Phase 8.2 自动化测试：Web 单测 247/247、浏览器预览 16/16、API 测试 41/41；交付 QA 568 项断言通过。
- 浏览器已验证：记忆建议、确认后首页更新、模型失败回退本地回答。云端模型请求使用测试替身，未验证真实模型服务。

## 尚未完成／不可宣称通过

- 当前 Windows 环境没有 Xcode、`xcodebuild` 与 Apple 签名凭据；**尚未生成 Release IPA，也尚无文件大小、IPA 构建时间或下载路径**。
- 仓库现有 GitHub Actions 仅生成 Debug、unsigned IPA；它不是可直接安装到普通 iPhone 的正式 Release 包。
- 真机语音、真机键盘与 Safe Area、真机性能仍待实测。

## 在具备签名条件的 Mac 上完成

1. 检出包含移动打包修复的实际提交，记录 `git rev-parse HEAD`。不要使用旧缓存产物。
2. 执行 `npm ci`、`npm run build:mobile`、`npx cap sync ios`、`npm test`、`npm run test:mobile-package`。
3. 使用 Xcode 的 Release 配置与目标团队签名，执行 clean archive；使用匹配设备或分发方式的 provisioning profile 导出 IPA。
4. 从导出的 IPA 内 `Payload/App.app/Info.plist` 核对 Bundle ID、Version、Build Number；记录 SHA-256、字节大小、构建时间和源码 Git SHA，再交付安装包。

未经以上核验，不将任何旧 IPA 或 unsigned Debug IPA 标为本版可安装包。
