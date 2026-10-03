# Feature Regression Registry

## FR-P1-MED-07 — 挂钥匙视频上传与任务保存单一所有权

- **Status:** active
- **Maintenance scope:** `mobile`; reuses the existing Root cleaning upload and lockbox-video business-save contracts without modifying them.
- **Last reviewed:** 2026-10-03 Australia/Melbourne
- **Business outcome:** 同一个挂钥匙视频队列项在一个 App 进程中只能有一个真实上传和一个真实任务保存执行者。界面等待超时只结束本次等待，不得释放仍运行的底层任务、启动第二次请求或把 `LOCAL_MEDIA_LOCKED` 暴露给用户；迟到的上传/保存成功仍必须写回队列并继续后续业务保存。完成页只触发队列，不得直接调用第二套任务保存路径。本地视频必须保留到任务保存成功后才清理；App 重启后可从持久化队列恢复一次新尝试。
- **Related CRLs:** `mobile/CRL-20261003-002`.

### Test-to-invariant mapping

- `src/lib/inspectionMediaQueue.test.ts` — 并发队列处理与等待超时共享同一上传/业务保存 Promise；迟到成功覆盖临时超时并继续完成；持久化 `uploading` 在新进程语义下恢复；外部本地媒体锁冲突转为可重试中文状态且不泄漏内部错误码；上传成功前不删除本地文件。
- `src/screens/tasks/InspectionCompleteScreen.test.tsx` — 挂钥匙完成页只调用 `processInspectionMediaQueue`，不直接调用 `uploadLockboxVideo`；密码任务、普通检查、客人已到达、离线本地队列与服务器禁用动作继续遵守原业务门禁。

### Delivery boundary

- 本条只改变 Mobile 挂钥匙视频队列的进程内执行所有权、超时后的迟到结果处理和完成页调用路径；不改变 Root API、数据库、R2、鉴权、任务成员资格、生产配置或依赖。
- 单元测试不证明真实 iOS/Android 弱网、App 被系统杀死后的恢复、真实对象存储或生产任务最终状态；OTA/build、真实设备与生产验证均需单独授权。

## FR-P1-FIN-03 — 工作量反馈、私有证明、周结算确认与文件

- **Status:** active; Phase 4/5 paired fixed Preview API integration and local export passed, not yet committed or release-ready.
- **Maintenance scope:** `mobile` self-service claim, settlement document and notification navigation screens; depends on root/CRL-20260911-002 evidence API, root Phase 3 workflow API, root/CRL-20260911-003 Phase 5 document/notification API and root/CRL-20260913-003 date-effective claim options contract.
- **Last reviewed:** 2026-10-02 Australia/Melbourne
- **Business outcome:** “我 → 费用结算”提供普通工作量反馈和本人周结算两个主入口。普通反馈默认先显示历史记录，按工作日期从新到旧分组，同一天保留每条独立反馈；右上角“新增”打开独立填写层，草稿或需补充资料的记录可从详情继续修改。新增时先选工作日期，仓管、加班、补贴、上新房、编外合作和其他费用六类始终可主动选择；试工不再作为自助反馈选项。已配置费用规则时底层按次、按天或按小时由规则决定，并在填写和已提交反馈详情中显示当天生效单价、含/未含 GST 口径、预计结算金额及 GST；未配置或预估暂不可用时仍可先提交并交由公司核对。金额类收金额，按次类收工作量，按小时通过 iPhone 风格双列滚轮收开始/结束时间，上新房另收房源编号且照片选填，其他类型仍需照片或截图。时间使用 24 小时制和 5 分钟步进；工作日期以澳洲常用的 `日/月/年` 显示，通过底部整月日历录入，服务端值仍为 `YYYY-MM-DD`。周结算页由本人先读取上一完整周权威预览，但周卡片不能直接提交：第一步必须打开逐日明细，核对已计入项目、金额以及尚未计入的待公司核对反馈；第二步明确勾选确认后才能提交给财务。即使部分费用规则未配置也可先提交，状态显示“已提交，待财务核对”。财务有问题时退回并显示原因，本人通过“查看并再次确认”核对最新金额，再点“确认并重新提交”；无问题由财务转账并直接确认已付款。原有补充工作/费用、现有结算核对、日期汇总、唯一当前 PDF、前台聚焦刷新和无定时轮询边界继续保留。
- **Protected behavior:** 普通反馈列表必须先于新增表单出现，以 `service_date` 从新到旧分组；同日记录只能归组、不得合并金额或状态，整行进入详情，旧的整宽“查看详情”按钮不得恢复。右上角“新增”只在工作量反馈页显示，必须保留至少 44pt 触控区；独立填写层关闭不清草稿，草稿或 `returned` 记录继续通过详情进入编辑。普通反馈类型来自配套 Root 日期有效 options，但是否配置费用规则不得隐藏六类主动反馈或禁用提交；清洁、检查、周固定和试工不得出现在新建入口，多个已配置编外计费口径只显示后端按优先级选定的一项，未配置时默认收工作量，历史试工只读。切换类型必须清空不再适用的金额、数量、房源和时间字段，但保留已选择照片，避免隐藏字段误提交或媒体丢失。时间滚轮必须限制小时 `00–23`、分钟 `00–55` 且按 5 分钟吸附；滚动选值、标题 `HH:mm` 和确认写回必须一致，取消或点背景不得写入。工作时长的计算与提交继续使用整数分钟；实时摘要、反馈详情和网页管理端必须格式化为同一“小时 + 分钟”口径，禁止显示除以 60 产生的浮点小数。预计金额只能读取配套 Root 权威接口，不在客户端复制费率或 GST 算法；日期、类型、时长/数量/金额变化后重取，已提交反馈详情也必须以自身日期和工作量重新读取同一权威接口，并在关闭或切换详情后丢弃迟到响应。`$35/小时`、70 分钟、已含 GST 的标准展示为预计总额 `$40.83`、其中 GST `$3.71`；接口失败、GST 未确认或规则未配置必须显示非阻断提示，不能阻止反馈或隐藏既有详情。普通反馈草稿和每张结算单的补充草稿按当前用户隔离；claim/media ID 在重试期间保持稳定。结算内日历使用 `week_start` / `week_end` 禁用周外日期，日期格式转换不改 API payload。详情 GET 与本地草稿并行加载期间必须隐藏 PDF、明细、确认和反馈操作，关闭后的迟到响应不得重新打开详情。本人文件必须按当前 `status` 匹配 `document_stage` 并只选最新版，禁止回退旧状态 PDF。证明只使用本人认证路由，选择后持久化压缩 JPEG，每次最多 5 张；除上新房照片选填外，上传、claim 提交或结算重新核对任一步失败都必须保留草稿和临时文件，只有配套 Root 原子业务端点整体成功或用户明确重置才清理。纯文字结算问题继续使用原有说明端点，不另建金额反馈。PDF 只使用本地 cache URI 进入当前周结算 modal 内的 WebView 底部弹层，关闭/分享按钮均为 44×44 `AppIconButton`。日期汇总只改展示，不改原始行项和金额；未经公司核对的补充金额只进入预计总额。本人列表首次进入、页面重新聚焦及前台恢复时同时读取 claim、结算列表和上一完整周预览；自动生命周期触发在 10 秒内去重，同一时刻复用一个进行中的请求，手动下拉仍强制刷新，禁止定时轮询。周提交预览失败时不得阻断工作量反馈或既有周结算列表，只能在周结算页显示局部错误和手动重试；失败预览不得继续显示旧提交按钮。初次提交卡片只能进入“核对明细”，不得直接调用提交端点；逐日权威行项和未计入的本人反馈必须分区展示，待公司核对项目不得混入预计总额。只有进入第二步并明确勾选确认后，才能携带当前预览 `confirmation_token` 提交；提交期间按钮禁用，服务端提示预览变化时必须返回第一步并刷新。初次提交只能来自 `not_submitted` 预览，重复服务端提交必须幂等；`confirmed` 显示“已提交，待财务核对”，`awaiting_confirmation` 只表示财务退回后的“待你再次确认”。初次提交不触发本人确认通知；退回通知仍只打开 `Me.PersonnelSettlement`。Photo ID 不得当作工作证明。
- **Generic subsidy override:** 自 `mobile/CRL-20261002-001` 起，上述“六类始终可选”和新的“其他费用”入口描述由本条覆盖：新建工作量反馈只保留一个通用“补贴”入口，字段固定为“补贴内容”“补贴金额 AUD”和证明照片；界面不得列举或提示停车费、油费、高温补贴、雨补等具体项目。补贴不依赖费用规则，填写金额就是预计最终总额；财务可调整并决定是否计入。历史 `custom_amount` 记录继续显示，`draft/returned` 历史记录仍可从详情修改，但新建表单和周结算补充区不得再提供“其他费用”按钮。周结算补充金额不得按已有规则口径额外加 GST。
- **New-property time contract:** 上新房继续复用后端 `new_property_task` 类型标识，但费用口径统一为每小时。移动端不得显示“工作量”文本框；必须收集房源编号、开始时间、结束时间并实时显示“几小时几分钟”，已配置规则时显示“$/小时”并由配套 Root 按实际分钟返回预计金额。提交保留起止时间且不发送数量，照片继续选填。
- **Date-change persistence contract:** 新增或修改反馈时切换工作日期只能更新日期和当天费用规则提示，不得清空已选择类型、房源编号、金额/数量、工作说明或本地照片；已填写的起止时间必须保留时分并换算到新工作日期，避免用户重新填写或提交旧日期时间戳。
- **Validation:** `src/lib/personnelClaimDraft.test.ts` 固化用户/结算 scope 隔离、上传中断恢复、稳定 ID、5 张上限和成功清理边界；`src/screens/me/PersonnelSettlementScreen.test.tsx` 固化列表优先、按日倒序分组、同日独立行、整行详情、右上角新增、详情继续修改，以及无对应费用规则仍可主动选择六类业务、无试工、编外单一选项、金额/时间/数量动态字段、时间滚轮偏移边界、5 分钟归一化、滚动选择并确认 `10:05`、`10:05–16:15` 显示 `6 小时 10 分钟`，并直接覆盖 370、360、40 分钟与无效值格式；新增已配置的上新房 `$35/小时`、`17:10–18:20`、已含 GST 时显示 `$40.83` 与 GST `$3.71`，已提交反馈详情使用自身日期与 70 分钟再次请求同一权威预估并展示 `$35/小时 · 已含 GST`、总额 `$40.83`、GST `$3.71`，以及上新房无照片提交、即时详情、加载期间操作隔离、`日/月/年` 日历、日期汇总、最新 PDF、精确确认文案、单一问题入口、两条渐进展开路径、原子补充 API、照片上传和本地草稿边界；生命周期用例固化首次读取、重新聚焦、前台恢复及 10 秒去重，并覆盖周提交预览失败不阻断工作量列表、周结算页局部提示和手动重试；两步周提交用例固化卡片无直提入口、逐日明细、未计入反馈提示、第二步勾选门禁和确认标识提交；`src/lib/personnelSettlementNotification.test.ts` 固化通知期间、确认语义和动作；`src/screens/tabs/MeScreen.test.tsx` 固化入口。2026-09-26 页面专项、TypeScript 与 targeted lint 在最新 CRL 验证结果中记录。真实提交、Android、横屏、放大字体和物理设备未验证。
- **Latest validation focus:** `PersonnelSettlementScreen.test.tsx` 必须断言上新房隐藏数量框、保留房源框、使用现有滚轮选择起止时间、显示统一时长、在无照片时提交时间而不是工作量，并在规则已配置时按“每小时”展示后端权威预估。
- **Date persistence validation:** 同一页面用例必须先填写上新房房源、起止时间和说明，再切换工作日期，断言字段与时长不丢失、options 按新日期刷新且最终 payload 使用新日期。
- **Related CRLs:** `mobile/CRL-20260926-001`（最新）、`mobile/CRL-20260924-005`、`mobile/CRL-20260924-004`、`mobile/CRL-20260924-003`、`mobile/CRL-20260924-002`、`mobile/CRL-20260924-001`、`mobile/CRL-20260922-001`、`mobile/CRL-20260914-004`、`mobile/CRL-20260914-003`、`mobile/CRL-20260914-002`、`mobile/CRL-20260914-001`；配套后端为 `root/CRL-20260924-004`、`root/CRL-20260924-003`、`root/CRL-20260924-002`、`root/CRL-20260924-001` 和 `root/CRL-20260922-003`，历史实现见既有人员结算 CRL。
- **Non-protection scope:** 移动端不自行定义税务或最终结算口径；跨午夜工时、设备时区差异及正式金额仍由配套 Root 和公司核对负责。
- **Delivery boundary:** 本地/固定 Preview 验证不证明相机/相册真机权限、真实文件系统清理、真实 push 点击、设备 PDF Share、R2 对象 ACL、生产 API、OTA/build 或生产人员金额；Phase 5 仍需与 root/CRL-20260911-003 一起进入后续发布审查。

## FR-P1-FIN-02 — 费用结算资料复用与 GST 三态

- **Status:** active; paired fixed Preview API integration passed, not yet committed or release-ready.
- **Maintenance scope:** `mobile` personal profile only; depends on root/CRL-20260910-002 shared profile API and schema.
- **Last reviewed:** 2026-09-11 Australia/Melbourne
- **Business outcome:** “我 → 编辑资料”继续复用现有姓名、ABN、银行和 Photo ID 表单，并增加可选商业名称、GST `未确认/已注册/未注册` 和不晚于 Melbourne 当日的 GST 状态生效日。保存时结算字段走后端共享结算资料服务，基本昵称/电话/头像/签证仍走原资料接口；本地缓存只改善显示，不成为结算或 GST 权威来源。
- **Validation:** `src/lib/personnelSettlementProfile.test.ts` 固化 ABN 只检查归一化后的 11 位数字、不执行数学校验和，并继续覆盖 Melbourne 日期和日期有效性；`src/screens/me/ProfileEditScreen.test.tsx` 固化现有 Photo ID/签证流程、GST/商业名称字段可见，并直接断言保存时结算登记字段提交共享 API、普通资料仍走原接口；`src/lib/profileStore.test.ts` 固化缓存迁移。固定 Preview 隔离 cleaner 账号已完成真实本人资料 GET/PATCH、网页下一生效版本和脱敏审计验证，测试数据已清理。
- **Protected behavior:** ABN 只做 11 位格式检查，不宣称完成 ABR、归属或 GST 官方验证；不改变 Photo ID/签证上传、水印、私有读取、任务/通知/离线队列或按钮语义。Photo ID 不能作为工作量凭证。GST 未确认时允许先保存不完整登记资料，但不能由后端自动当作未注册或进入自动金额计算。
- **Delivery boundary:** 已在执行 `20260910_personnel_settlement_phase1` migration 的固定非生产 Preview 后端验证本人读取/保存；仍未 commit、push、PR、merge、OTA 或真机验证，且不证明生产 API、GST 税务正确性或银行转账结果。

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
