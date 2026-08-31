# Feature Regression Registry

## FR-P1-MED-06 — 私有图片单次认证读取与权限失效

- **Status:** active
- **Maintenance scope:** `mobile`; reuses the existing Root `/cleaning-app/media/image` association and authorization contract without modifying it.
- **Last reviewed:** 2026-08-31 Australia/Melbourne
- **Business outcome:** 私有清洁、验收、耗材、钥匙、离线任务、维修/反馈、日终、通知和经理任务媒体只由受控下载器访问认证代理；原生 `Image` 只接收本地 `file://` 或本地草稿。缓存身份是当前账号/权限范围与规范代理 URI，Bearer token 不参与键；同一读取并发合并，下载仅在完整临时文件原子移动后命中。`401`、`403`、`404` 不缓存且不自动重试；登出、账号/角色变化、任务成员资格/分配变化与 `resync_required` 清除当前账号缓存。列表仅读 thumbnail，只有已打开的当前 Viewer 页读 preview。
- **Related CRLs:** `mobile/CRL-20260831-001`; request-rate precursor `mobile/CRL-20260830-004`.

### Test-to-invariant mapping

- `src/lib/cleaningMediaCache.test.ts` — token 变化不重复下载；同 URI 并发合并；失败 partial 不生成 final；权限/可见性失效后必须重新经过代理；角色范围变更隔离缓存。
- `src/components/CleaningMediaImage.test.tsx` — 私有缩略图的 native renderer 仅接收本地文件，终态错误不提供重试。
- `src/components/CleaningMediaPreview.test.tsx` — grid/list 不请求 preview；当前 Viewer 的 thumbnail/preview 共用准确认证上下文且 native renderer 仅接收本地文件；本地草稿不经过下载器；`403`/`404` 终态和网络重试分离。
- `src/lib/workTasksStore.test.ts` — assignment/membership 与 `resync_required` 在任务刷新前失效当前账号媒体缓存。

### Delivery boundary

- 本条只改变 Mobile 私有媒体的读取、内存去重、本地缓存和失效时机；不改变后端代理、数据库关联、R2 ACL、任务权限、上传队列、业务保存、共享 Viewer 架构或任何生产配置。
- 本地测试不证明 iOS/Android 原子移动、认证代理响应、缓存容量清理或真实权限撤销；需在后续获授权的 OTA/设备验证中分别验证。

## FR-P1-WTR-01 — 任务全量刷新协调与一致性窗口

- **Status:** active
- **Maintenance scope:** `mobile`
- **Last reviewed:** 2026-08-31 Australia/Melbourne
- **Business outcome:** 同一登录用户、日期范围与视图 bucket 的任务全量读取只通过 `workTasksStore` 的共享协调器发起。首次/强制操作立即执行；焦点与前台恢复在 60 秒内直接跳过；SSE 成员资格或未知一致性事件在窗口内合并为一次有界尾随同步；服务端因重连历史缺口发出的 `resync_required`、手动刷新、日期切换、通知跳转与写操作回执均为强制刷新。同步运行期间，额外触发最多保留一次后续同步，强制优先于一致性同步；认证层建立唯一的当前任务会话，登出或账户切换使旧请求、缓存 hydration、timer、pending、in-flight 等待状态和旧 SSE 启动全部失效。
- **Related CRLs:** `mobile/CRL-20260830-004`.

### Test-to-invariant mapping

- `src/lib/workTasksStore.test.ts` — 60 秒冷却按 user/date/view bucket 隔离；持续一致性事件最多形成一次有界尾随刷新；反复 focus 不产生尾随刷新；运行中的多个强制请求合并为一次后续同步；登出后下一账户不继承 timer 或冷却状态，旧账号慢响应不能覆盖新账号缓存或安排旧 token 的 follow-up，队列延迟的旧闭包也不能在新账户会话下发起读取或重建 SSE。
- `src/screens/tabs/TasksScreen.test.tsx` — 任务屏调用共享刷新入口而不是自己维护第二个 debounce/interval；初始读取为 `force`，navigation focus 和 App foreground 均显式为 `passive`。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — 钥匙上传后仍触发带原因标记的强制任务投影刷新。

### Delivery boundary

- 本条仅约束 Mobile `/mzapp/work-tasks` 的全量读取时机；不改变任务可见性、后端鉴权、SSE 传输、数据库 SQL、通知历史列表或日终交接的独立业务读取。
- 本地测试不能证明生产实际请求率；需要与匹配的 Mobile OTA/原生发布后，再以真实账户和 Neon Query Performance 验证。

## FR-MNT-001 — 维修执行人专用工作流提交

- **Status:** active
- **Maintenance scope:** `mobile`; paired Root maintenance workflow is already deployed.
- **Last reviewed:** 2026-08-19 Australia/Melbourne
- **Business outcome:** 已分派的内部维修（`property_maintenance`）执行人点击“标记完成 / 未完成”必须调用专用维修工作流；完成动作携带已保存的完工照片并进入待审核，客户端不得回退通用 `/mzapp/work-tasks/:id/mark` 或本地关闭任务。
- **Related CRLs:** `mobile/CRL-20260819-001`; prior behavior source `mobile/CRL-20260806-004`; paired root workflow `root/CRL-20260806-006`.

### Test-to-invariant mapping

- `src/screens/tasks/TaskDetailScreen.test.tsx` — 内部维修“标记完成”向 `submitMaintenanceExecutorAction` 传递 `executor_complete`、来源记录 ID 与已上传完工照片，且不调用通用 `markWorkTask`。
- Root `/maintenance/workflow/:domain/:id/:action` — 服务端仅允许被分派执行人的专用动作，完成后返回 `pending_review`；通用 mark 对维修来源保持保护性拒绝。

### Delivery boundary

- 最新 Android 已安装包早于该专用客户端动作，且 runtime fingerprint 与当前源码不兼容；必须发布新的 Android 原生包。production 通道没有可用 Android OTA，不能以 iOS TestFlight 更新替代。
- EAS 构建、APK/AAB 分发、真实 Android 执行人回归与生产任务验证另需显式发布及设备验证授权。
- 外部维修来源继续复用同一现有专用路由，但不在本次截图复现和新增 mobile 回归断言范围内。

## FR-P1-FDB-03 — 日用品更换前后私有照片认证读取

- **Status:** active
- **Maintenance scope:** `mobile`, paired `root`
- **Last reviewed:** 2026-08-17 Australia/Melbourne
- **Business outcome:** `daily_necessities` 的 `replaced` / `no_action` 历史记录保留在反馈列表；`media_urls` 的更换前照片与 `repair_photo_urls` 的更换后照片在缩略图、详情和 viewer 都通过既有认证媒体组件读取。`inventory/...` 直接 key 与 legacy R2 URL 必须规范化后携带同一 `source_task_id`，不回退裸 URL。
- **Related CRLs:** `mobile/CRL-20260817-003`; paired `root/CRL-20260817-003`.

### Test-to-invariant mapping

- `src/lib/cleaningMedia.test.ts` — `inventory/...` 直接 key 与历史 R2 URL 都生成认证代理请求并保留任务上下文。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — 日用品更换记录进入历史详情，前/后照片均使用认证代理读取。
- Root `/cleaning-app/media/image` — `property_daily_necessities` 的 `before_photo_urls`、兼容 `photo_urls` 与 `after_photo_urls` 精确关联并在授权前 fail-closed；由 paired root CRL 修改。

## FR-P1-FDB-02 — 历史深清反馈私有照片认证读取

- **Status:** active
- **Maintenance scope:** `mobile`; paired Root proxy and Web reader are tracked in `root/CRL-20260817-002`.
- **Last reviewed:** 2026-08-17 Australia/Melbourne
- **Business outcome:** 历史 `property_deep_cleaning` 的 `deep-cleaning/...` 与 `deep-cleaning-upload/...` 引用，在反馈列表缩略图、详情缩略图及大图中保留当前 `source_task_id` 并走认证代理；不直读 R2。服务器仍必须对唯一、未删除、真实房源的反馈记录执行精确关联和当前用户授权；错误、未关联、歧义、已删除或越权读取保持 `403`。
- **Related CRLs:** `mobile/CRL-20260817-002`; paired `root/CRL-20260817-002`.

### Test-to-invariant mapping

- `src/lib/cleaningMedia.test.ts` — 两个历史前缀的直接 key 与 R2 URL 都生成含 Bearer token、`source_task_id` 和缩略/预览 variant 的认证请求。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — 深清历史列表缩略图保留当前任务上下文，不落回裸 URL。
- Root `/cleaning-app/media/image` — 由 `backend/scripts/tests/test_mzapp_media_visibility.ts` 保护深清各持久化字段、唯一关联与认证授权；本 Mobile 单元不更改 Root 规则。

## FR-P1-NTF-02 — 钥匙照片通知私有媒体认证读取

- **Status:** active
- **Maintenance scope:** `mobile`
- **Last reviewed:** 2026-08-16 Australia/Melbourne
- **Business outcome:** 后端实际发送的 `key_photo_uploaded` 与既有 `keys_hung` 均从同一 Inbox `task_id` 进入认证媒体读取；列表缩略图、详情缩略图与大图传递同一任务上下文。缺失或非字符串 ID 时不渲染私有媒体，也不回退裸 URL。
- **Related CRLs:** `mobile/CRL-20260816-006`; supersedes the incorrect incident mapping in `mobile/CRL-20260815-001`; historical source evidence `mobile/CRL-20260813-001`.

### Test-to-invariant mapping

- `src/screens/tabs/NoticesScreen.test.tsx` — `key_photo_uploaded` 与 `keys_hung` 都保留合法 `task_id`，无效 ID 失败关闭。
- `src/screens/notices/NoticeDetailScreen.test.tsx` — 两种 key 通知的详情和 viewer 都使用相同认证上下文，且无效 ID 不渲染私有媒体。
- Root `/cleaning-app/media/image` — 既有精确关联与授权复用，不在本单元修改。

## FR-P1-NTF-03 — 补货通知私有照片认证读取

- **Status:** active
- **Maintenance scope:** `mobile`
- **Last reviewed:** 2026-08-16 Australia/Melbourne
- **Business outcome:** `consumables_submitted` 与 `consumables_updated` 的列表缩略图、详情缩略图与大图使用同一 Inbox `task_id` 认证读取；缺失或无效 ID 时不回退私有原始 URL。
- **Related CRLs:** `mobile/CRL-20260816-002`; reuse-only `mobile/CRL-20260815-001`.

### Test-to-invariant mapping

- `src/screens/tabs/NoticesScreen.test.tsx` — valid task context is preserved; invalid context is fail-closed.
- `src/screens/notices/NoticeDetailScreen.test.tsx` — detail and viewer use the same task context; invalid context renders neither.
- Root `/cleaning-app/media/image` — exact association and authorization are reused, not modified.

## FR-P1-NTF-04 — 房源问题通知私有照片认证读取

- **Status:** active
- **Maintenance scope:** `mobile`
- **Last reviewed:** 2026-08-16 Australia/Melbourne
- **Business outcome:** `issue_reported` 只有携带合法 `task_id` 时才在列表、详情与大图显示认证私有媒体；无任务上下文、未知来源或不受支持引用一律隐藏，不得回退到原始 URL。
- **Related CRLs:** `mobile/CRL-20260816-003`; hardening `mobile/CRL-20260819-004`; historical payload source `mobile/CRL-20260622-015`.

### Test-to-invariant mapping

- `src/screens/tabs/NoticesScreen.test.tsx` — task-bound issue thumbnail uses the authenticated renderer; missing task context is hidden.
- `src/screens/notices/NoticeDetailScreen.test.tsx` — task-bound issue detail/viewer preserve the same context; missing task context renders neither.
- Root `/cleaning-app/media/image` — exact association and authorization are reused, not modified.

## FR-P1-NTF-05 — 线下任务完成通知私有照片认证读取

- **Status:** active
- **Maintenance scope:** `mobile`
- **Last reviewed:** 2026-08-16 Australia/Melbourne
- **Business outcome:** `work_task_completed` 且 `task_id` 为完整 `cleaning_offline_tasks:<id>` 时，列表、详情与大图传同一 `work_task_id` 认证读取；缺失、非离线或不完整 ID 时不渲染或回退私有 URL。
- **Related CRLs:** `mobile/CRL-20260816-004`; Root offline-task association/authorization are reuse-only.

### Test-to-invariant mapping

- `src/screens/tabs/NoticesScreen.test.tsx` — exact offline task context is preserved and invalid context is fail-closed.
- `src/screens/notices/NoticeDetailScreen.test.tsx` — detail and viewer preserve the same offline work-task context.
- Root `/cleaning-app/media/image` — exact association, ambiguity rejection and authorization are reused, not modified.

## FR-P2-SRC-01 — Inbox 私有媒体来源白名单与 fail-closed 解析

- **Status:** active
- **Maintenance scope:** `mobile`; reuses the existing Root authenticated media proxy without changing its authorization rules.
- **Last reviewed:** 2026-08-27 Australia/Melbourne
- **Business outcome:** Inbox 图片只接受已知业务事件（临时行李、钥匙、检查完成、补货、任务关联问题、线下完成任务）及其精确读取上下文；未知事件、缺上下文、原始公共/未知 URL 或不受支持引用在列表、详情和大图均隐藏。已知 R2/受管 key 始终经认证代理，不出现页面级裸 URL 回退。
- **Related CRLs:** `mobile/CRL-20260819-004`.

### Test-to-invariant mapping

- `src/lib/noticeMedia.test.ts` — 事件到 guest-luggage/task/offline-task 上下文的映射，缺上下文与原始 URL fail-closed。
- `src/lib/cleaningMedia.test.ts` — 已管理 key、R2 历史引用与本地暂存文件的读取边界；未知远程引用不返回裸 URL。
- `src/screens/tabs/NoticesScreen.test.tsx` and `src/screens/notices/NoticeDetailScreen.test.tsx` — 列表、详情和预览使用同一个 resolver，问题通知缺 task context 时不渲染。

### Shared validation and release boundary

- Local integration candidate passed 6 targeted Jest suites / 55 tests, TypeScript, lint (0 errors; 109 pre-existing warnings), ledger audit and diff check.
- Post-release validation: administrator, offline manager, customer service and eligible task roles verify list → detail → viewer. Wrong task, unrelated media and unauthorized user remain server-side `403`.
- Does not cover P1-NTF-01/02, Photo ID/Visa, object recovery, R2 ACL, recipient policy, Badge, Push, deployment, OTA or real-device proof.

## FR-P1-ID-01 — Photo ID/Visa 资料缓存不持久化原始引用

- **Status:** active
- **Maintenance scope:** `mobile`; paired Root profile-document authorization and self-service reader are reused without modification.
- **Last reviewed:** 2026-08-28 Australia/Melbourne
- **Business outcome:** 已登录用户的 v2 profile 缓存只可保留 Photo ID/Visa 的 `uploaded` presence marker 或 `null`，绝不持久化历史文档 URL/key。任何旧缓存 URL 在首次读取时必须立即覆写为 marker；页面继续走认证自助读取，不回退原始 URL。
- **Related CRLs:** `mobile/CRL-20260819-003`, `mobile/CRL-20260828-002`; paired `root/CRL-20260819-003`.

### Test-to-invariant mapping

- `src/lib/profileStore.test.ts` — 仅含旧 Photo ID URL 的 v2 缓存在读取后返回并持久化 `uploaded`，序列化内容不再包含旧 URL。
- `src/screens/me/ProfileEditScreen.test.tsx` — 图片资料只根据 presence 标记和认证 self-service reader 显示，不回退原始 URL。
- Root `users/me/profile-documents/:type` — 当前用户的证件读取仍由既有 Root 授权路由强制；本 mobile 修复不修改其鉴权。

### Shared validation and release boundary

- Local proof covers only cache migration and serialization; it does not read a real document or verify object recovery.
- Root backend must precede any mobile OTA/native delivery. OTA、EAS/native、真实设备和生产文档验证均需单独授权。

## FR-P1-FIN-01 — 报销凭证私有图片认证读取

- **Status:** active
- **Maintenance scope:** `mobile`
- **Last reviewed:** 2026-08-17 Australia/Melbourne
- **Business outcome:** 已保存的报销凭证图片在“我的记录”、详情缩略图和大图均以 `receiptId + imageId` 走专用认证媒体路由；草稿上传后只使用当前设备临时 URI，绝不把已上传但未关联的私有对象 URL 当作显示源。
- **Related CRLs:** `mobile/CRL-20260817-004`, paired `root/CRL-20260817-004`; read-side safety follow-up `mobile/CRL-20260817-007`, paired `root/CRL-20260817-007`.

### Test-to-invariant mapping

- `src/lib/expenseReceiptMedia.test.ts` — 构造的 source 包含 bearer token 与凭证图片精确路径；缺失 token 或任何 ID 时失败关闭。
- `src/screens/me/ExpenseCenterScreen.tsx` — 草稿本地预览、记录缩略图、详情与 viewer 都只消费本地或认证 source；不保留 `Image.prefetch`、`Image.getSize` 或 `source={{ uri: ... }}` 裸 URL 分支。
- Root `/mzapp/expense-receipts/:receiptId/images/:imageId` — 精确凭证图片关联、财务授权、403 与 404 由后端强制；不得改用 cleaning proxy。

### Shared validation and release boundary

- 需与 root 专用读取路由同批发布；仅移动端合并或 OTA 均不足以让认证图片显示。
- 发布后以凭证提交者、admin、finance_staff、customer_service 与无关角色验证记录 → 详情 → 大图；未提交草稿不进行生产持久化验证。
- 不覆盖 R2 ACL 修改、历史对象迁移、旧 `/mzapp/expenses` 或网页发票页面。
