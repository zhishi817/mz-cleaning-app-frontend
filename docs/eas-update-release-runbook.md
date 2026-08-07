# MZStay EAS Update 发布手册

本手册只适用于已安装新的 OTA 基线包的用户。旧的 TestFlight 或 App Store 构建没有 `expo-updates`，不会接收 OTA。

## Channel 边界

| Channel | 使用者 | 用途 |
| --- | --- | --- |
| `preview` | 内部开发/验证包 | 开发环境验证，不得面向外部 TestFlight 测试者。 |
| `testflight` | 外部 TestFlight 测试者 | 在外部测试群体验证兼容的 OTA。 |
| `production` | 正式 App Store 构建及 production APK | 已验证的正式 OTA。 |

同一构建只从其构建时写入的 channel 获取更新；不可把外部 TestFlight 验证包指向 `production`。

## 一次性建立 iOS OTA 基线

1. 确认本次配置、`npm run check:ci` 和 `npx expo export --platform ios` 均通过。
2. 因为 `expo-updates` 和更新 URL 属于原生构建内容，递增 `app.json` 的 iOS `buildNumber`；如本次同时发布 Android，也按既有版本治理同步 Android `versionCode`、`package.json` 与 lockfile 版本。
3. 构建外部 TestFlight 包：

   ```bash
   npx eas-cli@latest build --platform ios --profile testflight
   ```

4. 在 App Store Connect 上传/选择该构建并按 Apple 要求完成外部 TestFlight 测试或 Beta Review。确认外部测试者实际安装的是这一个新构建。

本步骤会创建云端构建和 TestFlight 发行物，必须在获得单独发布授权后执行。

## 日常 JS OTA 发布

仅在下列改动完成代码审查与自动化验证后执行：React/TypeScript、样式、翻译、图片资源及不依赖新原生代码的小型修复。

1. 先发布到外部测试 channel：

   ```bash
   npx eas-cli@latest update --channel testflight --environment production --message "简明的改动说明"
   ```

   `--channel` 只决定安装包从哪里取 update；它不会选择 JS bundle 的环境变量。`--environment production` 是强制项，确保外部 TestFlight bundle 使用 production API 配置，不能省略或替换为当前开发 shell 的环境。

2. 测试者彻底关闭并重新启动 TestFlight App；非 development build 会在启动时后台下载更新，通常在后续一次启动应用。记录构建号、EAS update ID、目标 channel、目标 environment、操作、预期/实际、iOS 设备和网络环境。
3. 验证通过后，以同一已审代码发布到正式 channel：

   ```bash
   npx eas-cli@latest update --channel production --environment production --message "与 TestFlight 验证一致的改动说明"
   ```

`eas update` 是对 EAS 云端的外部发布操作，须获得该次 OTA 发布授权；不得在未验证时直接发布 `production`。

## 必须新建原生包的情况

- 新增或升级原生依赖，或改变 `package.json` 中会影响 iOS 原生层的依赖。
- iOS/Android 权限、`Info.plist` / `app.json` 原生配置、推送、图标、启动屏或 Expo SDK 改动。
- runtimeVersion 改变，或任何更新不再与现有构建的 native runtime 兼容。
- Apple 审核应看到的重大功能、隐私或业务流程变化。

这些改动先构建新的 `testflight` 基线包，并遵循适用的 Apple TestFlight/App Review 流程；不要以 OTA 绕过审核。

## 回滚与故障处理

- 未发布 production：停止在 `testflight` channel 推送，并在 EAS 控制台重新发布最后一条稳定 update。
- 已发布 production：在 EAS 控制台重新发布上一条稳定 update；记录受影响 update ID 和用户症状。
- 启动失败、白屏或 native API 缺失：停止放量；不要继续发布修复版 OTA 以掩盖不兼容问题。建立新的兼容 runtime/原生构建后，再在 `testflight` 验证。

## 发布前检查

- 变更属于非原生、兼容的 JS/样式/资源范围。
- 对应 release ledger 已更新且审计通过。
- `npm run check:ci`、`npx expo export --platform ios` 通过。
- OTA 命令显式携带 `--environment production`，且发布记录中写明 channel 与 environment。
- 外部 TestFlight 已验证，再允许 production OTA。
- 未在命令、台账、截图或日志中记录 `.env`、token、密码、证书或其他敏感信息。
