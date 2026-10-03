# Execution Records

## 合作方主动提交周工作量与退回再确认

- Date: 2026-09-22
- Task: 把移动端周结算从“等待公司生成”改为“本人先提交、财务后核对”
- Status: implemented and locally verified in fixed Preview; not released

### Confirmed Plan

- 本人读取上一完整周的权威预览并主动提交工作量。
- 提交后等待财务核对；财务有调整时显示退回原因并由本人再次确认提交。
- 金额、GST 和费用规则继续由 Root 权威计算；移动端不复制算法，规则缺失不阻止先提交。

### Implementation Result

- 周结算页新增预览卡和“提交本周工作量”，显示预计税前、GST、总额和项目数。
- 状态统一为“已提交，待财务核对”和“待你再次确认”；退回详情显示财务说明并提供“确认并重新提交”。
- 页面生命周期继续使用既有 10 秒去重和单一 in-flight 请求，不增加定时轮询。

### Validation

- TypeScript no-emit passed。
- PersonnelSettlementScreen focused Jest passed：1 suite / 13 tests。
- 未运行 lint、完整 check:ci、Expo export、模拟器、真机或真实 API 写入。

### Files / Areas

- `src/lib/api.ts`
- `src/screens/me/PersonnelSettlementScreen.tsx`
- `src/screens/me/PersonnelSettlementScreen.test.tsx`
- `docs/feature-regression-registry.md`

### Open Issues / Follow-ups

- 依赖配套 `root/CRL-20260922-003` 一起验证和发布。
- 未 commit、push、PR、merge、OTA、deployment 或 production/device verification。

## 补充费用表单纵向间距

- Date: 2026-09-13
- Task: 优化补充工作或费用表单中字段和按钮之间过挤的问题
- Status: implemented

### Confirmed Plan

- 相邻字段和操作使用统一 12pt 分组间距。
- 标题和它对应的选项或照片操作保留较小的组内间距。
- 不改变金额、GST、媒体、提交、权限或结算状态逻辑。

### Implementation Result

- 补充费用容器新增共享 `rowGap` 纵向节奏。
- 费用类型与照片证明分别建立语义分组，避免标签与其他字段混淆。
- 专项测试新增 12pt 布局合同断言。

### Validation

- Focused Jest passed: 1 suite / 6 tests。
- Fixed Preview iPhone 17 模拟器已看到字段、照片按钮和最终提交操作之间的清晰间距。
- Product Design 修改前后聚焦对比 passed，无剩余 P0/P1/P2。
- Full `npm run check:ci` passed：ledger range audit 41 tests、ledger coverage 26/26、TypeScript、lint 0 errors / 556 pre-existing warnings、strict button audit、fast 3 suites / 26 tests、full Jest 62 suites / 357 tests。
- `git diff --check` passed。

### Files / Areas

- `src/screens/me/PersonnelSettlementScreen.tsx`
- `src/screens/me/PersonnelSettlementScreen.test.tsx`
- `design-qa.md`

### Open Issues / Follow-ups

- Android、放大字体和实体设备未验证。
- 未执行照片选择、上传或最终提交。
- 未 commit、push、PR、merge、OTA/build、production 或真机验证。

## 周结算核对按钮间距与红色提醒

- Date: 2026-09-13
- Task: 优化“现有结算需要核对”选中色与发送按钮间距
- Status: implemented

### Confirmed Plan

- 核对选项被选中时使用红色风险样式，未选中时保持中性轮廓。
- 问题说明输入框与发送按钮之间增加共享按钮行间距 12pt。
- 不改变提交处理、API、权限、结算状态或其他移动端页面。

### Implementation Result

- 复用 `AppButton` 既有 `danger` tone 展示选中状态。
- 发送按钮使用 `layoutTokens.button.rowGap` 增加 12pt 上间距。
- 专项测试新增颜色与间距合同断言。

### Validation

- Focused Jest passed: 1 suite / 6 tests。
- Fixed Preview iPhone 17 模拟器已看到红色选中按钮和输入框下方间距。
- Full `npm run check:ci` passed：ledger range audit 41 tests、ledger coverage 26/26、TypeScript、lint 0 errors / 556 pre-existing warnings、strict button audit、fast 3 suites / 26 tests、full Jest 62 suites / 357 tests。
- Design QA passed；固定 Preview 聚焦对比无剩余 P0/P1/P2。
- `git diff --check` passed。

### Files / Areas

- `src/screens/me/PersonnelSettlementScreen.tsx`
- `src/screens/me/PersonnelSettlementScreen.test.tsx`
- `design-qa.md`

### Open Issues / Follow-ups

- Android、放大字体和实体设备未验证。
- 未 commit、push、PR、merge、OTA/build、production 或真机验证。

## 周结算问题统一入口与合作式文案

- Date: 2026-09-13
- Task: 将文字核对问题与补充工作/费用收口到一个移动端流程
- Status: implemented and locally verified in fixed Preview; not released

### Confirmed Plan

- 用一个“工作内容或金额有疑问？”卡片提供两种精确路径：补充工作/费用，或只说明现有结算问题。
- 补充路径需要日期、金额、说明和至少一张证明，整单成功后才清理本地草稿。
- 所有面向人员的文案改为合作式“反馈、核对、确认计入”语义。

### Implementation Result

- 删除详情页底部重复的独立补充卡片，改为点选后原位展开的单卡片流程。
- 有结构路径使用配套原子 API，失败时保留本地照片和草稿；纯文字路径继续使用原结算说明 API。
- 状态标签、帮助文案、按钮和提示已换成合作关系描述。

### Validation

- Focused Jest passed: 1 suite / 6 tests。
- TypeScript and lint passed；lint 0 errors / 556 pre-existing warnings。
- Full `npm run check:ci` passed: ledger coverage 26/26、strict button audit、fast 26 tests and full Jest 62 suites / 357 tests。
- iOS Expo export passed: 1590 modules；`git diff --check` passed。
- Fixed Preview iPhone 17 模拟器只读验证统一入口、补充表单展开、金额摘要及安全区关闭按钮。
- 未执行真实相机/相册、上传、最终提交或数据库写入。

### Files / Areas

- `src/lib/api.ts`
- `src/screens/me/PersonnelSettlementScreen.tsx`
- `src/screens/me/PersonnelSettlementScreen.test.tsx`
- `design-qa.md`
- `docs/feature-regression-registry.md`

### Open Issues / Follow-ups

- 发布前仍需用可清理的 Preview 合成数据跑通真实提交和财务核对闭环。
- 未 commit、push、PR、merge、OTA/build、production 或真机验证。

## 周结算只显示当前最新版文件

- Date: 2026-09-12
- Task: 修复同一周结算同时显示多个 PDF 版本
- Status: implemented in fixed Preview; not released

### Confirmed Plan

- 本人只看到与当前结算状态一致的最新一份文件；同状态旧版本和旧状态文件都不显示。
- 当前状态没有文件时保持空状态，不回退到历史 PDF。
- 历史文件继续由后端保留给财务审计，移动端不执行删除。

### Implementation Result

- 结算详情新增确定性的当前文件选择器，并让文件列表只渲染其唯一结果。
- 配套 Root 本人详情 API 已采用同一规则，移动端仍保留防御筛选以兼容旧响应或缓存。
- PDF 下载、App 内底部预览、图标分享和鉴权边界没有改变。

### Validation

- Focused Jest passed: 1 suite / 5 tests；覆盖 awaiting_confirmation v3/v2 只显示 v3，以及 confirmed 不回退 awaiting 文件。
- TypeScript和 lint passed；lint 为 0 errors / 556 existing warnings。
- `npm run check:ci` passed：ledger range、ledger coverage、TypeScript、lint、button audit、fast 3 suites / 26 tests、full Jest 62 suites / 356 tests。
- 固定 Preview 模拟器已恢复连接本地 API；当前账号无周结算单，未形成含重复版本的账号级视觉证据。

### Files / Areas

- `src/screens/me/PersonnelSettlementScreen.tsx`
- `src/screens/me/PersonnelSettlementScreen.test.tsx`
- `docs/feature-regression-registry.md`
- paired root `backend/src/lib/personnelSettlementDocuments.ts`
- paired root `backend/src/modules/personnel_settlements.ts`

### Open Issues / Follow-ups

- 旧文件继续保留为财务历史，本次不做破坏性清理。
- 未 commit、push、PR、merge、OTA/build、production 或真机验证。

## ABN 取消数学校验和

- Date: 2026-09-11
- Task: ABN 取消数学校验和
- Status: implemented

### Confirmed Plan

- 移动端个人资料取消 ABN 数学校验和，仅保留归一化后的 11 位数字检查，并与后端保持一致。
- 不改变 GST、生效日期、银行、Photo ID/签证、任务、通知或离线流程。

### Implementation Result

- 11 位号码不会再因校验和失败被本地拦截；不足 11 位仍显示明确错误。
- 中英文提示更新为“ABN 必须包含 11 位数字”。

### Validation

- Focused Jest passed: 2 suites / 5 tests。
- `npm run check:ci` passed: ledger range tests、ledger coverage 23/23、TypeScript、lint 0 errors / 110 existing warnings、strict button audit、fast tests 3 suites / 26 tests and full Jest 62 suites / 352 tests。
- 获取最新 `origin/Dev` 后 ledger audit passed: 23/23 changed paths covered；`git diff --check` passed。

### Files / Areas

- `src/lib/personnelSettlementProfile.ts`
- `src/lib/personnelSettlementProfile.test.ts`
- `src/lib/i18n.tsx`

### Open Issues / Follow-ups

- 格式检查不验证 ABN 是否真实、归属正确或已注册 GST。
- 未执行 API/数据库写入、simulator/device、EAS/OTA、commit、push、PR、merge 或 production 验证。

## 费用结算阶段 5

- Date: 2026-09-11
- Task: 费用结算阶段 5
- Status: implemented and paired Preview integrated; not released

### Confirmed Plan

- 在移动端显示每周结算文件，并允许本人通过认证接口查看或分享 PDF。
- 本人收到待确认通知后，直接进入“我 → 费用结算”，主要确认“工作量及金额正确”。

### Implementation Result

- 本人结算详情新增文件历史和“查看 / 分享 PDF”，下载文件只保存到本机 cache 并使用系统分享界面。
- push 点击和通知详情按钮都进入本人费用结算页；通知展示上一周期间和确认语义。
- 未改变既有工作量草稿、证明、个人资料或 Photo ID 生命周期。

### Validation

- TypeScript、2 个 Phase 5 focused Jest suites、full Jest 62 suites / 352 tests、strict button audit 和 lint 通过；lint 为 0 errors / 110 existing warnings。
- iOS Expo export 通过，1581 modules；固定 Preview Metro `/status` 返回 200。
- paired Root Phase 5 migration 已在固定 Preview 开发库执行；合成集成验证本人列表/详情/确认、认证 PDF、non-owner 404、通知数据、GST/非 GST 与 8 个文件状态版本，测试数据已清理。
- 本轮移动端 TypeScript、full Jest 62 suites / 352 tests 和 strict button audit 通过。
- 未做真实 push 点击、原生 PDF Share、相机、模拟器、真机、R2、OTA 或 production 测试。

### Files / Areas

- `src/lib/api.ts`
- `src/lib/noticePresentation.ts`
- `src/lib/personnelSettlementNotification.test.ts`
- `src/navigation/RootNavigator.tsx`
- `src/screens/notices/NoticeDetailScreen.tsx`
- `src/screens/me/PersonnelSettlementScreen.tsx`
- `src/screens/me/PersonnelSettlementScreen.test.tsx`

### Open Issues / Follow-ups

- paired Root migration 和开发 API 集成已完成；仍需真机验证真实通知点击与系统 PDF Share。
- 未 commit、push、PR、merge、OTA、build publish、deploy 或真机/生产验证。
## iPhone 风格滚轮时间选择器

- Date: 2026-09-13
- Task: iPhone 风格滚轮时间选择器
- Status: implemented

### Confirmed Plan

- 按已确认预览图，把开始/结束时间选择器改成双列滚轮。
- 使用 24 小时制与 5 分钟步进，并保留取消、确认及现有时间提交逻辑。
- 在固定 Preview 模拟器核对真实渲染和滚轮更新。

### Implementation Result

- 原小时/分钟按钮网格已替换为五行可见、52pt 吸附的双列滚轮。
- 增加连续淡蓝选中带、中央冒号、顶部实时 `HH:mm` 和滚轮无障碍增减操作。
- 开始和结束时间共用同一组件；API、费用计算、媒体和提交 payload 未改。

### Validation

- Focused Jest passed: 1 suite / 7 tests。
- TypeScript passed；lint passed with 0 errors / 556 pre-existing warnings；strict button audit passed。
- Full `npm run check:ci` passed: ledger range 41 tests、ledger coverage 26/26、fast 26 tests and full Jest 62 suites / 358 tests。
- iOS Expo export passed: 1590 modules；输出仅写入 `/private/tmp`。
- Fixed Preview iPhone 17 simulator passed：分钟从 `09:00` 调整到 `09:05` 后吸附与标题同步。
- Product Design combined comparison passed；没有剩余 P0/P1/P2。

### Files / Areas

- `src/screens/me/PersonnelSettlementScreen.tsx`
- `src/screens/me/PersonnelSettlementScreen.test.tsx`
- `design-qa.md`
- `docs/feature-regression-registry.md`
- `docs/change-release-ledger.md`

### Open Issues / Follow-ups

- Android、横屏、放大系统字体和物理设备尚未验证。
- 未 commit、push、PR、merge、OTA/build 或 production 验证。

### Update - 2026-09-13 22:16

- Status: implemented
- Implementation Result:
  - 根据实际预览“过大、不够精致”的反馈，将五行 52pt 滚轮改为三行 44pt，并同步缩小标题、当前时间、行文字、内部间距和阴影。
  - 取消、确认按钮仍保持共享 44pt 触摸高度，时间数据与提交逻辑未改。
- Validation:
  - Focused Jest 1 suite / 7 tests、TypeScript、quiet lint 和 strict button audit 均通过。
  - `npm run check:fast` 通过：ledger range 41 tests、ledger coverage 26/26、fast 3 suites / 26 tests；iOS Expo export 1590 modules 通过。
  - Fixed Preview iPhone 17 模拟器已验证 `09:00 → 09:05` 的紧凑滚轮更新；前后聚焦视觉对比通过，`design-qa.md` final result 为 `passed`。
- Open Issues / Follow-ups:
  - Android、横屏、放大系统字体和物理设备仍未验证。
  - 未 commit、push、PR、merge、OTA/build 或 production 验证。

## 移动端费用结算周提交预览容错修复

- Date: 2026-09-24
- Task: 移动端费用结算周提交预览容错修复
- Status: implemented

### Confirmed Plan

- 后端预览 GET 兼容受限缓存参数，提交 POST 保持严格。
- 工作量反馈和既有周结算列表不再被周提交预览失败连带阻断。
- 周提交预览失败只在周结算页显示局部提示，并允许用户手动重试。

### Implementation Result

- 把周提交预览读取封装为独立容错流程；失败时清除旧预览和提交入口。
- 页面列表请求继续正常更新，不再因 `invalid_weekly_submission_preview` 弹出全页“加载失败”。
- 周结算页新增“重新加载周预览”，不增加定时轮询或第二套数据源。

### Validation

- PersonnelSettlementScreen focused Jest passed：1 suite / 14 tests。
- Full Jest passed：62 suites / 365 tests；TypeScript、quiet lint 和 strict button audit passed。
- Paired Root Phase 3 contract、TypeScript、isolated backend emit 和 Feature Registry audit passed。
- Mobile ledger audit passed：26/26；tracked diff whitespace check passed。
- 未执行真实 API 写入、simulator/device、OTA、build publish 或 production 验证。

### Files / Areas

- `src/screens/me/PersonnelSettlementScreen.tsx`
- `src/screens/me/PersonnelSettlementScreen.test.tsx`
- `docs/feature-regression-registry.md`
- `docs/change-release-ledger.md`

### Open Issues / Follow-ups

- 发布时必须与 `root/CRL-20260924-001` 配套选择。
- 未 commit、push、PR、merge、OTA/build publish 或 production/device verification。
