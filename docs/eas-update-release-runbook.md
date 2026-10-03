# MZStay EAS Update 发布手册

本手册适用于具有 EAS Update 基线的构建。当前外部 TestFlight `1.0.26 (26)` 是有效 OTA 基线，目标 runtime 固定为 `e5f4cc520509f2b64df725bf8eef5a9a42dc0e8a`。

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

## Build 26 的受控日常 JS OTA 发布

不要根据当前 `app.json` 的 `runtimeVersion.policy=fingerprint` 推断 Build 26 不能接收 OTA。该配置是新原生基线的默认策略；Build 26 的安装时 runtime 是上述固定值。

只允许已完成代码审查与自动化验证的 React/TypeScript、样式、翻译和不依赖新原生代码的小型修复。必须在干净、最新 `origin/Dev` 的隔离工作树中先运行：

```bash
node scripts/testflight_build26_ota.mjs --check
```

该检查会：

- 固定比较 Build 26 兼容基线 `195b9e8...HEAD`；
- 先刷新远端并要求 `HEAD` 正好等于最新 `origin/Dev`；
- 只允许 `src/`、`docs/` 和 `scripts/` 变更；
- 阻断 `app.json`、`eas.json`、依赖/lockfile、`ios/`、`android/`、插件与原生资源改动；
- 确认静止状态仍为 `runtimeVersion.policy=fingerprint`。

通过后、取得该次外部发布授权才可执行：

```bash
node scripts/testflight_build26_ota.mjs --publish --message "简明的改动说明"
```

发布脚本只在发布子进程期间临时将隔离工作树的 runtime 绑定为 Build 26 runtime；成功、失败或 EAS 命令报错后都会逐字节恢复 `app.json`。它显式使用 `testflight` channel 和 `production` environment，并要求 EAS 回执确认目标 runtime 与 update group。这个临时覆盖不得提交。

`--channel` 只决定安装包从哪里取 update；它不会选择 JS bundle 的环境变量。`--environment production` 是强制项，确保外部 TestFlight bundle 使用 production API 配置，不能省略或替换为当前开发 shell 的环境。

测试者彻底关闭并重新启动 TestFlight App；非 development build 会在启动时后台下载更新，通常在后续一次启动应用。记录构建号、EAS update ID、目标 channel、目标 environment、操作、预期/实际、iOS 设备和网络环境。

验证通过后，以同一已审代码发布到正式 channel：

   ```bash
   npx eas-cli@latest update --channel production --environment production --message "与 TestFlight 验证一致的改动说明"
   ```

`eas update` 是对 EAS 云端的外部发布操作，须获得该次 OTA 发布授权；不得在未验证时直接发布 `production`。

## 必须新建原生包的情况

- 新增或升级原生依赖，或改变 `package.json` 中会影响 iOS 原生层的依赖。
- iOS/Android 权限、`Info.plist` / `app.json` 原生配置、推送、图标、启动屏或 Expo SDK 改动。
- runtimeVersion 改变，或任何更新不再与现有构建的 native runtime 兼容。
- Apple 审核应看到的重大功能、隐私或业务流程变化。

这些改动先构建新的 `testflight` 基线包，并遵循适用的 Apple TestFlight/App Review 流程；不要以 OTA 绕过审核。Build 26 合同检查出现阻断时，不能通过手工覆盖或修改脚本绕过。

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
