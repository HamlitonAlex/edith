# VMware macOS 开发同步流程

本方案在 macOS 虚拟机的**图形桌面用户会话**中运行，不更改 SwiftUI、签名或 CI 配置。GitHub push 不直接唤醒虚拟机；`launchd` 每 60 秒检查一次指定分支，虚拟机运行且联网时通常在下一次检查后同步。首次检查会打开 Xcode，之后仅在 commit 变化时重新打开工程。

## 首次准备

1. 在 macOS 安装完整 Xcode 与 Git，并在终端执行 `xcode-select -p`、`xcodebuild -version`，确认选中的是 `Xcode.app/Contents/Developer`，而非只有 Command Line Tools。
2. 克隆当前 GitHub 仓库，在克隆目录中切换到 `codex/native-codemagic-build`。确保 `origin` 指向有权限读取的仓库；私有仓库的 GitHub 凭据只配置在 macOS 钥匙串或 SSH agent，不写进脚本。
3. 在仓库根目录执行 `chmod +x XuechengNative/tools/sync_xuecheng.sh`，再运行 `./XuechengNative/tools/sync_xuecheng.sh`。它会检测 Xcode、工程、共享 Scheme，快进同步分支并打开 `XuechengNative.xcodeproj`。
4. 将 `com.xuecheng.native-sync.plist.example` 复制到 `~/Library/LaunchAgents/com.xuecheng.native-sync.plist`，把 `ProgramArguments` 中的占位路径替换成此 Mac 上脚本的**绝对路径**。用 `plutil -lint ~/Library/LaunchAgents/com.xuecheng.native-sync.plist` 验证，再执行 `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.xuecheng.native-sync.plist`。不要将含本机路径的 plist 提交到 Git。
5. 检查 `/tmp/xuecheng-native-sync.log` 和 `/tmp/xuecheng-native-sync-error.log`。修改间隔或路径后，先 `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.xuecheng.native-sync.plist`，再重新 bootstrap。

## 日常流程

Windows 上 push 到 `codex/native-codemagic-build` → macOS 虚拟机的 LaunchAgent 定时检查 → `git fetch` + `git pull --ff-only` → 新 commit 到达时打开 Xcode 工程。共享 Scheme 从 `.xcodeproj/xcshareddata/xcschemes/` 检测，并由 `xcodebuild -list` 核验；当前预期为 `XuechengNative`。在 Xcode 里选择 Simulator 后运行或测试。脚本**不会自动编译、测试、签名或生成 IPA**。

macOS 本地有已修改或已暂存的跟踪文件、分支不匹配、detached HEAD、远端历史分叉时，脚本停止且不覆盖工作。未跟踪文件可能与远端新增文件冲突；Git 会拒绝覆盖，此时请人工处理。虚拟机睡眠、断网或未登录图形桌面时不会即时同步；恢复后下一次检查继续。不要在这个自动同步 checkout 上直接开展未提交的开发，或先暂停 LaunchAgent 再工作。

如需停止自动同步：`launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.xuecheng.native-sync.plist`。该操作不删除仓库或本地改动。
