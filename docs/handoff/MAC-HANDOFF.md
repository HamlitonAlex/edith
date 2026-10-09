# 学程 XuechengNative：Mac 接手续做包

生成日期：2026-10-10（中国标准时间）

## 从这里开始

正式代码仓库：<https://github.com/HamlitonAlex/edith>

分支：`codex/native-codemagic-build`

已核对的功能代码基线：`13dbe03b9c8b767bc7b9cba4a8225615129f299d`。交接文档的提交会让分支 HEAD 继续前进，功能代码仍以此 commit 为准。

Xcode 工程：`XuechengNative/XuechengNative.xcodeproj`

共享 Scheme：`XuechengNative`；选择一个实际可运行的 iPhone Simulator，别选 `Any iOS Device (arm64)`。

如果 Mac 已有该仓库，先查看本地改动，再在仓库根目录执行：

```bash
git status --short
git branch --show-current
git pull --ff-only origin codex/native-codemagic-build
open XuechengNative/XuechengNative.xcodeproj
```

若是新克隆：

```bash
git clone -b codex/native-codemagic-build https://github.com/HamlitonAlex/edith.git
cd edith
open XuechengNative/XuechengNative.xcodeproj
```

克隆或拉取后，在 Xcode 中选 `XuechengNative` Scheme、iPhone Simulator，按 Command-R 运行。若 `git pull --ff-only` 因 Mac 本地改动拒绝，先保存和审阅那些改动，不要执行强制重置。

## 当前实际进度

1. Native SwiftUI 工程、Design System、Motion V1、今天/路径/小程/我的及学习过程/结果等页面骨架已在正式分支。
2. Domain 中已有 Python Lists 的 `Attempt → Evidence → SkillState → NextStep` 确定性原型、内存 Repository 和 Coordinator。它尚未接入运行时页面。
3. `TodayView`、`StudySessionView`、`SessionResultView` 当前仍读取 `PreviewFixtures`；用户在 UI 作答不会完成正式学习证据闭环。内存 Repository 重启也会丢失数据。
4. 源码中有 13 项原有 `LearningDomainTests`。历史对话中 Codemagic 曾报告 Xcode Build、XCTest 和 Simulator Smoke 成功，**但本交接没有重读相应 xcresult**；当前远端 commit `13dbe03` 尚无本次核验的真实 Xcode 结果。
5. 最新 commit `13dbe03` 将隐藏系统 Tab Bar 的设置移入四个 Tab 的内容层，针对 Mac 上看到的“双底部导航栏”。此修改只通过 Windows 静态检查，仍需在 Simulator 实测今天/路径/小程/我的和二级页面。
6. Codemagic 已配置 simulator、Development device archive、TestFlight internal 三条 workflow。配置不等于当前 commit 构建通过，也不等于有已签名 IPA。

## 用户已确定的视觉方向

以 stoic. 的**排版和留白**作为主要审美参考。品牌第一印象以浅色暖中性为主，炭灰文字；背景使用轻微灰阶/奶油色的环境光渐变，视觉上有柔和空间感。深色模式可以保留，但不作为默认品牌主面貌。Next Step 是「今天」页唯一主焦点，少量哑光表面，不做大量同等级卡片。

这是下一版讨论方向，尚不是已实现的 UI。先取得 Mac 模拟器的整屏截图，再对照现状提出 Today 页 390×844 的具体方案；不要仅凭本文宣称已与 Figma 像素级一致。

## 下一步，按顺序

### 1. 在 Mac 验证当前代码

- 拉取 `13dbe03`，在 Xcode 选择真实 iPhone Simulator，Command-B、Command-R。
- 截图并核对：四个主 Tab 是否只显示一套底部导航；进入 Study Session、Settings、Schedule 后自定义 Tab 是否隐藏；顶部原生返回栏是否正常。
- 若仍出现“双栏”，保存完整屏幕截图，写明 iPhone 模拟器型号、iOS 版本、具体页面。先确认两栏都在底部，还是顶部 Header 重复。
- Command-U 跑当前分支的 XCTest，记录实际执行数量、通过/失败/跳过，不要把源码中的 13 个方法当作已执行结果。

### 2. 视觉方案先审后改

- 用实际运行截图审视 Today 的标题层级、留白、Next Step、背景渐变、BottomNav。参考方向见上。
- 先做一张可讨论的 390×844 Today 方案，让用户确认视觉方向，再同步到共享 Theme/组件。保持产品职责和已有 SwiftUI 导航结构。
- 用户确认后再扩 Companion、Path、Me；避免同时修改多个页面以致无法验收。

### 3. 领域测试与闭环

本包另附 `PENDING-LearningDomainTests.patch`，它只包含 Windows 上新增的 **4 项尚未运行** 的测试（现有 13 项保留）。它不在已推送分支，**不要当成已通过的测试**。如要在单独开发 checkout 中检查：

```bash
git apply --check /path/to/PENDING-LearningDomainTests.patch
git apply /path/to/PENDING-LearningDomainTests.patch
```

然后 Command-U。静态审查预计：稳定后顺序错误、stable 到期复习、遍历/推导式题目覆盖三处会暴露失败；真实结果以 Xcode 为准。先根据真实首条失败做最小修复，再接 `Today → Study → Result → Today` 的 Runtime。View 不自行生成 Evidence 或裁定 SkillState。

### 4. 真机 / 发布

当前没有本交接验证过的签名 IPA。要做真机测试，先完成 Simulator 与 XCTest，再用现有 TestFlight internal 或 Development archive workflow；Apple 签名和 App Store Connect 配置只放在 Codemagic/Apple 账号中，不放进仓库。

## 本包文件说明

- `MAC-HANDOFF.md`：本说明，作为 Mac 端续做入口。
- `xuecheng-core-v2.md`：原有产品逻辑 V2 提案；其首行明确标为 Proposal。
- `xuecheng-feasibility-review-2026-10-09.md`：按当前源码完成的可实施性审查和待验证反例。
- `PENDING-LearningDomainTests.patch`：未提交、未在 Xcode 运行的四项回归测试；独立于正式分支。

本 ZIP 不包含仓库代码全量副本，也不包含 `.codex-upload/`、`_vendor/`、其他 `artifacts/` 内容、临时图片或私密凭证。仓库代码以 GitHub 上的 commit 为准。
