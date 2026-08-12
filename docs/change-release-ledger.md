# Change Release Ledger

## CRL-20260812-005 — 日用品任务标签中文化（mobile）

- **Status:** ready
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 任务列表和任务详情不得向用户展示内部 `daily_necessities` 枚举。
- **Outcome:** 两处任务类型标签都显示“日用品”；任务标题、API 原始字段、状态、权限和路由不变。

### Implementation

- Previous behavior: 两个 `taskKindLabel()` 未映射该类型，未知值回退为原始枚举。
- New behavior: 两处显示函数都映射 `daily_necessities` 为“日用品”。

### Files / Areas

- `src/screens/tabs/TasksScreen.tsx` — 任务列表标签。
- `src/screens/tasks/TaskDetailScreen.tsx` — 任务详情标签。
- `src/screens/tabs/TasksScreen.test.tsx`、`src/screens/tasks/TaskDetailScreen.test.tsx` — 现有页面回归。
- `docs/change-release-ledger.md` — 本单元记录。

### Impact / Dependencies

- Runtime behavior: only display text; no API, database, cache, permissions or production-data change.
- Dependencies: none.

### Validation

- Candidate validation in progress: mobile typecheck, lint and relevant Jest suites are run before commit.

### Release Attempts

#### RA-20260812-mobile-001-007-01

- Repository: `mobile`.
- Selected CRLs: `CRL-20260812-001`, `CRL-20260812-002`, `CRL-20260812-003`, `CRL-20260812-004`, `CRL-20260812-005`, `CRL-20260812-006`, `CRL-20260812-007`.
- Intended action: `commit`; branch: `codex/release-crl-20260812-001-007`; target: `Dev`.
- Base: `origin/Dev@94b75a81c2a321f2ee44d9c197bf43b0f2b68733`; fetched at `2026-08-12T09:25:36+10:00`.
- Candidate patch SHA-256: `0c643779e5db8cedbb51430f969a1b24d6c73578160427f149dcdcc5cb7070a8`, excluding `docs/change-release-ledger.md`.
- Candidate content commit: `f57ca04e835659592f2dd46a54c7cec6a334df40`.
- Dependencies: paired root `CRL-20260812-001`, `-002`, `-003`, `-006`, `-007`; no unselected mobile CRL is staged.
- Required validation: PASS — `npm run check:ci` passed: ledger-range tests, ledger coverage audit, typecheck, lint (0 errors / 109 existing warnings), strict button audit, fast regression, and full Jest (56 files / 293 tests).
- Shared-hunk review: PASS — independent read-only review confirmed every staged path belongs to the selected CRLs.
- Generated-file / secret review: PASS — the temporary dependency link was excluded only while the Git audit ran and removed immediately afterward; staged paths contain no environment, credential, cache or media artifact.
- Independent review: GO for `commit` — independent read-only review reconfirmed this exact fingerprint, source coverage, generated-file/secret safety and paired dependencies.
- Technical state: `committed`; user authorization: `selected-for-commit` (user selected the joint 1–7 release scope); action conclusion: `GO` for commit completed. Push remains unapproved until the final ledger audit head is presented.

#### RA-20260812-mobile-001-007-02

- Repository: `mobile`.
- Selected CRLs: `CRL-20260812-001`, `CRL-20260812-002`, `CRL-20260812-003`, `CRL-20260812-004`, `CRL-20260812-005`, `CRL-20260812-006`, `CRL-20260812-007`.
- Intended action: `push`; target: `Dev`.
- Branch: `codex/release-crl-20260812-001-007`.
- Base: `origin/Dev@94b75a81c2a321f2ee44d9c197bf43b0f2b68733`; fetched at `2026-08-12T16:02:07+10:00` and unchanged.
- Candidate patch SHA-256: `0c643779e5db8cedbb51430f969a1b24d6c73578160427f149dcdcc5cb7070a8`, excluding `docs/change-release-ledger.md`.
- Commit SHA: `f57ca04e835659592f2dd46a54c7cec6a334df40` (candidate content commit); current audit head is emitted by the release report.
- Dependencies: paired root candidate content commit `7046279c978ff982c1731b8a1af55fa3916c60de` for root `CRL-20260812-001`, `-002`, `-003`, `-006`, `-007`, `-008`.
- Required validation: PASS — prior `check:ci` and current exact fingerprint/range checks remain valid.
- Shared-hunk review: PASS; evidence: prior independent review and current clean range evidence.
- Generated-file review: PASS; evidence: no generated files, cache, environment or sensitive artifact in the exact range.
- Technical state: `committed`.
- User authorization: `approved-for-push`; evidence: user replied “批准” after root `7046279c978ff982c1731b8a1af55fa3916c60de`, mobile `f57ca04e835659592f2dd46a54c7cec6a334df40` and both branch names were presented.
- Independent review: NEEDS OWNER; evidence: committed-range push review pending.
- Action conclusion: `NOT VERIFIED`; blockers: committed-range push review and exact release report pending.

### Risks / Release Notes

- Risk: device and OTA rendering verification are not local-test evidence.
- Sensitive-information review: no secrets, tokens, media bytes, logs or production data are included.

## CRL-20260812-004 — 任务完成操作按钮等宽（mobile）

- **Status:** ready
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 日用品和同类任务的完成/未完成操作应等宽；检查完成页底部双按钮也应保持同一布局契约。
- **Outcome:** 并排操作采用 `flex: 1`、`flexGrow: 1`、`flexShrink: 1`、`flexBasis: 0` 与 `minWidth: 0`；检查完成页在窄屏堆叠为全宽按钮。

### Implementation

- Previous behavior: 完成操作可能受内容宽度或历史最小宽度影响；检查完成的主按钮未使用同一弹性约束。
- New behavior: 任务详情和检查完成页均使用共享等分样式，严格按钮审计登记这些受控 `minWidth: 0` 约束。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx` — 完成/未完成与 self-complete 操作等宽。
- `src/screens/tasks/InspectionCompleteScreen.tsx` — 视频/完成双按钮等宽与紧凑布局。
- `scripts/audit_button_contract.py` — 等分按钮的已审查约束。
- `src/screens/tasks/TaskDetailScreen.test.tsx`、`src/screens/tasks/InspectionCompleteScreen.test.tsx` — 页面回归。
- `docs/change-release-ledger.md` — 本单元记录。

### Impact / Dependencies

- Runtime behavior: layout only; no task state, API, permissions, database, R2 or production-data change.
- Dependencies: existing `AppButton`, `layoutTokens` and compact-width helper.

### Validation

- Candidate validation in progress: strict button audit, typecheck, lint and relevant Jest suites are run before commit.

### Release Attempts

- None yet. User selected this unit for a joint commit candidate; push remains unapproved until exact commit SHA is presented.

### Risks / Release Notes

- Risk: real narrow-width and enlarged-font device verification is not run.
- Sensitive-information review: no secrets, tokens, media bytes, logs or production data are included.

## CRL-20260812-003 — 远端台账身份不可变门禁（mobile governance）

- **Status:** ready
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 解决共享移动端工作区台账不能安全发布的问题，并禁止本地历史记录覆盖 `origin/Dev` 业务身份。
- **Outcome:** 审计要求本地台账保留远端全部 CRL 与不可变业务字段；干净候选以已抓取的远端基线独立通过审计。

### Implementation

- Previous behavior: 覆盖检查不能发现远端记录缺失或同编号业务身份被改写。
- New behavior: 审计与 Release Attempt 报告比较已抓取的 `origin/Dev` 台账；缺失、变更或不可验证基线会明确返回门禁结果。

### Files / Areas

- `AGENTS.md`、`scripts/audit_change_release_ledger.py`、`scripts/tests/test_audit_change_release_ledger.py` — mobile 谱系门禁和回归。
- `docs/change-release-ledger.md` — 本单元记录。

### Impact / Dependencies

- Runtime / API / database / migration / configuration / production data: none.
- Paired unit: root `CRL-20260812-003`.

### Validation

- Candidate validation in progress: ledger regression, compile and exact coverage audit are run before commit.

### Release Attempts

- None yet. User selected this unit for a joint commit candidate; push remains unapproved until exact commit SHA is presented.

### Risks / Release Notes

- Risk: missing `origin/Dev` history is correctly `NOT VERIFIED`, not assumed safe.
- Sensitive-information review: no credentials, tokens, database URLs, logs, caches or production data are included.

## CRL-20260812-002 — 反馈照片本地持久化、续传与私有预览收口（mobile）

- **Status:** ready
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 反馈照片在上传或业务保存失败后必须保留本地可重试证据，私有预览不应交给系统浏览器。
- **Outcome:** 照片先以 JPEG 本地草稿保存；提交时携带稳定 `task_id` / `media_id` 上传，远端对象成功但业务保存失败仍保留本地副本，业务保存成功后才清理。

### Implementation

- Previous behavior: 反馈照片上传失败或后续业务保存失败可能丢失唯一可预览副本，私有链接可进入浏览器。
- New behavior: 反馈草稿保存元数据与阶段检查点，提交可续传而不重复创建业务记录；大图保持应用内认证预览。

### Files / Areas

- `src/lib/localMediaDrafts.ts` — 调用方可指定草稿压缩尺寸和质量。
- `src/lib/api.ts` — 声明服务端反馈记录返回的操作权限字段。
- `src/screens/tasks/FeedbackFormScreen.tsx` — 本地草稿、稳定上传 ID、续传、业务成功后清理和应用内预览。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — 本地预览、失败重试、稳定 ID 与无浏览器入口回归。
- `docs/change-release-ledger.md` — 本单元记录。

### Impact / Dependencies

- API / database / migration / configuration / R2 / production data: none; reuses existing authenticated upload and feedback APIs.
- Dependencies: shared authenticated media components remain the sole private-media renderer.

### Validation

- Candidate validation in progress: feedback and shared-media Jest suites, typecheck and lint are run before commit.

### Release Attempts

- None yet. User selected this unit for a joint commit candidate; push remains unapproved until exact commit SHA is presented.

### Risks / Release Notes

- Risk: real network interruption, deployed backend and device verification remain separate from local regression.
- Sensitive-information review: no credentials, tokens, media bytes, database URLs, logs or production data are included.

## CRL-20260812-001 — 日终交接照片本地预览与精确认证读取（mobile）

- **Status:** ready
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 修复日终照片上传后但业务未保存时的无权限预览；已保存照片必须携带精确 owner/date 读取上下文。
- **Outcome:** 新照片先持久化为本地草稿，本地 URI 优先于待关联远端引用；业务成功前不删除本地副本，已关联远端照片才进入认证代理。

### Implementation

- Previous behavior: 上传引用立即交给认证图片组件，业务尚未关联时被服务端拒绝；队列可在业务保存失败前删除本地证据。
- New behavior: 日终页面先写本地草稿并使用稳定 media ID；共享媒体组件接受可选 day-end owner/date；队列只在既有业务成功路径后清理草稿。

### Files / Areas

- `src/screens/tasks/DayEndBackupKeysScreen.tsx`、`src/lib/dayEndHandoverQueue.ts` — 本地优先预览与安全清理时机。
- `src/lib/cleaningMedia.ts`、`src/components/CleaningMediaImage.tsx`、`src/components/CleaningMediaPreview.tsx` — 可选 owner/date 认证上下文。
- `src/lib/cleaningMedia.test.ts` — 日终 URL 回归。
- `src/lib/dayEndHandoverQueue.test.ts` — 本地证据队列回归。
- `src/screens/tasks/DayEndBackupKeysScreen.test.tsx` — 页面预览回归。
- `docs/change-release-ledger.md` — 本单元记录。

### Impact / Dependencies

- API dependency: root `CRL-20260812-001` must be deployed before saved day-end remote media can be read.
- Database / migration / configuration / R2 / production data: none.

### Validation

- Candidate validation in progress: day-end/shared-media Jest suites, typecheck and lint are run before commit.

### Release Attempts

- None yet. User selected this unit for a joint commit candidate; push remains unapproved until exact commit SHA is presented.

### Risks / Release Notes

- Risk: camera, weak-network, deployed proxy, OTA and device verification remain not run.
- Sensitive-information review: no credentials, tokens, private media references, image bytes, logs or production data are included.

## CRL-20260812-007 — 当天任务临时通知保存前本地预览（mobile）

- **Status:** ready
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 临时通知在管理端选择照片后仍显示红叉/无权限；修复保存前本地预览，但不得放宽私有照片读取授权。
- **Outcome:** 候选实现保留每张刚上传照片的本地 URI 与远端引用；缩略图/预览在保存前只使用本地 URI，保存成功后清除本地预览并向既有认证代理传递已保存 notice ID。

### Implementation

- Previous behavior: `ManagerDailyTaskScreen` 上传成功后仅保存私有远端引用，并直接用 `CleaningMediaPreview` 读取；该对象尚无通知记录关联，所以认证代理按 fail-closed 规则返回拒绝。
- New behavior: 管理端临时通知照片状态保留本地预览映射。保存失败不丢失本地 URI 或远端引用，删除或保存成功才清除该映射；已保存照片继续经 `guest_luggage_id` 读取。
- Key decisions: 复用已有 `CleaningMediaPreview` 的 `localUri` 优先规则和既有 upload/save API；不新增队列、直连 R2、页面级私有 URL、权限判断、数据库/R2/生产数据操作。

### Files / Areas

- `src/lib/managerDailyTaskPhotos.ts` — 临时通知照片的保存前本地预览/保存后认证上下文适配。
- `src/screens/tasks/ManagerDailyTaskScreen.tsx` — 保留本地 URI、保存/移除时管理其生命周期，并为已保存照片传入 notice ID。
- `src/screens/tasks/ManagerDailyTaskScreen.test.ts` — 锁定保存前本地预览与保存后认证读取上下文。
- `docs/change-release-ledger.md` — 记录本移动端修复单元。

### Impact / Dependencies

- API: no new endpoint; uses the existing upload, save-notice and authenticated image APIs.
- Database / migration / configuration / R2 / production data: none.
- Paired root unit: root `CRL-20260812-007` updates FR-004; this repair requires root/mobile `CRL-20260812-006` before already-saved notice photos can be read.

### Validation

- `npm run test -- --runInBand --no-cache src/screens/tasks/ManagerDailyTaskScreen.test.ts src/lib/cleaningMedia.test.ts src/components/CleaningMediaPreview.test.tsx src/components/GuestLuggageCard.test.tsx` — passed: 4 suites / 28 tests; the newly-uploaded photo keeps its local URI, while saved media uses the notice ID context.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 114 existing warnings.
- `npm run test -- --runInBand --no-cache` — passed: 56 suites / 285 tests.
- `python3 scripts/audit_change_release_ledger.py`, `git diff --check` — passed: 11 changed files are recorded and formatting is clean.
- Paired root `npm run test:mzapp-media-visibility`, `npm run test:cleaning-media-image`, `npm run build`, `npm run check:feature-registry` and ledger audit — passed.

### Release Attempts

- None yet.

### Risks / Release Notes

- Risk: the in-memory local URI remains available only for the active editing session; this repair does not add an offline draft/queue or recover earlier orphan objects.
- Rollback: revert the display-state adapter and screen state; no data rollback is required.
- Sensitive-information review: no credentials, tokens, private media URL, object key, database connection, image bytes or production data recorded.
- Git state: uncommitted in an isolated worktree; no push, PR, deployment, OTA or device verification.

## CRL-20260812-006 — 当天任务临时通知照片认证读取（mobile）

- **Status:** ready
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 修复移动端当天任务临时通知的已保存照片无法显示或原图预览失败。
- **Outcome:** 源码修复完成：临时通知卡片的缩略图和原图预览向既有认证媒体代理传递同一个通知记录上下文；管理每日任务也传入登录 token。

### Implementation

- Previous behavior: 临时通知图片只传递对象引用，缺少通知记录上下文；管理每日任务卡片还缺少 token。
- New behavior: 共用媒体组件把 `guest_luggage_id` 附加到认证代理请求，缩略图和预览一致；不创建页面级图片读取逻辑。
- Key decisions: 不修改上传、队列、缓存清理、公开 URL 或 Viewer 架构；依赖 root 端先按通知记录精确授权。

### Files / Areas

- `src/lib/cleaningMedia.ts` — 认证图片请求的通知上下文。
- `src/components/CleaningMediaImage.tsx`, `src/components/CleaningMediaPreview.tsx`, `src/components/GuestLuggageCard.tsx` — 一致传递缩略图/预览上下文。
- `src/screens/tasks/ManagerDailyTaskScreen.tsx` — 向临时通知卡片提供登录 token。
- `src/lib/cleaningMedia.test.ts`, `src/components/CleaningMediaPreview.test.tsx`, `src/components/GuestLuggageCard.test.tsx` 与 `docs/change-release-ledger.md` — 代理上下文、缩略图/预览一致性和卡片传参回归。
- `src/components/GuestLuggageCard.test.tsx` — 临时通知卡片向缩略图与原图预览传递同一通知上下文和 Bearer token 的回归测试。

### Impact / Dependencies

- API: 使用既有 `GET /cleaning-app/media/image`，增加 root 配对实现所需的 `guest_luggage_id` 查询上下文。
- Database / migration / configuration / R2 / production data: none.
- Paired root unit: root `CRL-20260812-006` 必须与本移动端变更兼容部署；旧后端会继续拒绝该来源，不能仅发布移动端。

### Validation

- `npm run test -- --runInBand --no-cache src/lib/cleaningMedia.test.ts src/components/CleaningMediaPreview.test.tsx src/components/GuestLuggageCard.test.tsx` — passed: 3 suites / 22 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed with 0 errors / 114 existing warnings.
- `npm run test -- --runInBand --no-cache` — passed: 56 suites / 284 tests, including consumables, task, inspection, day-end, feedback and profile media consumers.
- `git diff --check` — passed.
- `python3 scripts/audit_change_release_ledger.py`（mobile）— passed：当前 9 个改动均已记录。

### Release Attempts

- None yet.

### Risks / Release Notes

- Risk: `cleaningMedia` 是共享读取辅助函数；仅添加可选上下文，必须回归既有来源 URL 构造。
- Rollback: 移除临时通知上下文传递；不影响已保存媒体或本地队列。
- Sensitive-information review: 不记录或提交 token、私有图片 URL、对象 key、数据库连接或生产数据。
- Git state: uncommitted in an isolated worktree; no commit, push, PR, deployment, OTA or device verification.

## CRL-20260811-009 — 线下任务历史公共基址照片认证读取（mobile）

- **Status:** committed
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 修复线下任务顶部「任务照片」的历史 HTTPS 引用直连对象而无法查看；本次只选择 mobile/root `CRL-20260811-009` 提交。
- **Outcome:** 仅 `cleaning_offline_tasks` 顶部任务照片会为历史 HTTPS 引用显式设置 offline 认证读取标记。缩略图与预览均携带同一 `work_task_id` 请求既有代理；非 offline 来源及任务处理照片不在本 CRL 范围。

### Implementation

- Previous behavior: 共享媒体构造器只按 URL 中的私有路径识别媒体。历史 current-public-base 任务照片不含 `mzapp/` 路径，因此被当作普通 HTTPS 请求直连对象。
- New behavior: `TaskDetailScreen` 的 offline task photo 调用点显式传递 `offlineWorkTaskMedia`；`cleaningMedia`、缩略图与全屏预览透传该标记和精确任务 ID，是否可读完全由 root 认证代理决定。
- Key decisions: 不新增 Viewer、缓存、公开链接或本地权限推断；不改变上传/任务处理照片的 CRL-20260811-005 行为。

### Files / Areas

- `src/lib/cleaningMedia.ts` — 对显式 offline task context 的历史 HTTPS 引用构造认证代理 URL。
- `src/components/CleaningMediaImage.tsx`, `src/components/CleaningMediaPreview.tsx` — 透传标记，使缩略图和预览使用相同上下文。
- `src/screens/tasks/TaskDetailScreen.tsx` — 仅顶部 offline task photo 调用点启用标记及任务 ID。
- `src/lib/cleaningMedia.test.ts`, `src/components/CleaningMediaPreview.test.tsx`, `src/screens/tasks/TaskDetailScreen.test.tsx` — opt-in、缩略图、预览与页面上下文回归。
- `docs/change-release-ledger.md` — 本 CRL 的发布证据。

### Impact / Dependencies

- API dependency: root `CRL-20260811-009` 必须先提供 current-public-base、精确 `photo_urls` 关联与既有执行人授权检查。
- Database / migration / configuration / R2 / production data: none.
- Shared dependency: 共享媒体组件只有在 offline task 显式 opt-in 时改变请求路线；其它调用维持现有行为。

### Validation

- Rebuilt on mobile `origin/Dev@16649be48cf99b0d1e3378eff01380d52d681ed3`.
- `npm run check:ci` — passed (exit 0): ledger-range audit (11 tests), candidate ledger audit (8/8), TypeScript, full lint (0 errors / 114 existing warnings), strict button audit, fast Jest (3 suites / 18 tests) and full Jest (55 suites / 281 tests).
- Paired root contract tests and TypeScript no-emit check — passed on unchanged root candidate; final paired review pending.
- Deployed backend, device, OTA/build and production verification — not run.

### Release Attempts

#### RA-20260811-009-mobile-01

- Repository: `mobile`
- Selected CRLs: `CRL-20260811-009`
- Intended action: `commit`
- Branch: `codex/release-offline-task-photo-auth-20260811`
- Base: `origin/Dev@16649be48cf99b0d1e3378eff01380d52d681ed3`; fetched at `2026-08-12T00:31:05+10:00`.
- Candidate patch SHA-256: `fed2681ed1c4a247cd3a6e78de6a54c190054ed60faa8adb731bcb5b8854891c`, excluding `docs/change-release-ledger.md`.
- Commit SHA: `4d0d256515e7b921b879e4856f321b2187119767`.
- Dependencies: root `CRL-20260811-009`; no unselected CRL is included.
- Required validation: PASS; rebuilt candidate passed `npm run check:ci`.
- Shared-hunk review: PASS; independent staged review confirmed all 8 paths belong to this selected CRL and no unselected hunk is included.
- Generated-file review: PASS; independent staged review found no generated output, cache, dependency artifact or sensitive file.
- Technical state: committed.
- User authorization: selected-for-commit; evidence: user confirmed paired root/mobile `CRL-20260811-009` after remote CRL-008 use was verified.
- Independent review: GO for `commit` only; independent read-only review confirmed fingerprint `fed2681ed1c4a247cd3a6e78de6a54c190054ed60faa8adb731bcb5b8854891c`, exact scope and validation evidence.
- Action conclusion: GO for `commit` completed; push, PR, merge, deployment, OTA and device verification are not authorized or verified.

### Risks / Release Notes

- Risk: root is intentionally fail-closed for a host/path that is not the configured current public base or exact persisted task reference; the client must not fall back to direct object access.
- Rollback: revert the offline task-only adapter pair; no data rollback is needed.
- Sensitive-information review: no credentials, tokens, database URLs, private media references, image bytes, user records, logs or caches included.
- Git state: candidate content commit `4d0d256515e7b921b879e4856f321b2187119767` created in a clean release worktree; remote branch not pushed, PR not created, not merged, not deployed and device/production verification not run.

## CRL-20260811-008 — 稳定检查面板全量回归超时（mobile）

- **Status:** ready
- **Updated:** 2026-08-11 Australia/Melbourne
- **Request:** GitHub Full Regression 的检查面板首个页面渲染测试超出 Jest 默认 5 秒；用户授权按最小方案修复。
- **Outcome:** 为该测试保留完整页面断言，同时给异步等待设置 5 秒边界、给测试整体设置 10 秒边界；不改检查页运行时代码。

### Implementation

- Previous behavior: 首个检查页 smoke test 使用默认 `waitFor` 与 Jest 5 秒测试上限；共享 CI runner 较慢时会超时并阻断全量回归。
- New behavior: 等待条件最多 5 秒，整个测试最多 10 秒；测试继续断言四个核心步骤和可用入口，不能因超时修复而放宽业务断言或移出全量 Jest。
- Key decisions: 仅修复测试基础设施的有界等待；不改 `InspectionPanelScreen.tsx`、任务动作、权限、API、队列、数据或配置。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.test.tsx` — modified: 首个页面渲染测试采用显式有界 `waitFor` 与 Jest timeout。
- `docs/change-release-ledger.md` — modified: 记录独立可选择的 CI 稳定性修复。

### Impact / Dependencies

- **API / database / migration / configuration / dependencies:** none。
- **Regression registry:** 关联 root `FR-004` 的既有检查页测试映射；该单元不改变业务不变量或映射的覆盖状态，测试仍由 `check:ci` 全量 Jest 执行。
- **Related units:** `CRL-20260811-004`～`CRL-20260811-007` 已分别合并；本单元不混入其业务范围。

### Validation

- GitHub Full Regression — failed before this change: `InspectionPanelScreen.test.tsx:121` exceeded the default 5-second test timeout; 54 suites / 277 tests passed and 1 test failed in the captured run.
- `npm test -- --runInBand --no-cache src/screens/tasks/InspectionPanelScreen.test.tsx` — passed: 1 suite / 13 tests; the protected first render test completed in 2.581 seconds.
- `npm run check:ci` — passed: ledger-range audit, ledger coverage, typecheck, lint (0 errors / 114 existing warnings), strict button audit, fast regression (3 suites / 18 tests), and full Jest all completed successfully. A temporary, exact `node_modules` dependency link was excluded only from this isolated worktree's Git audit invocation; no source path was excluded.
- Native/device/API/database verification — not applicable: no runtime behavior is changed.

### Release Attempts

#### RA-20260811-mobile-ci-inspection-timeout-01

- Repository: `mobile`
- Selected CRLs: `CRL-20260811-008`
- Intended action: `push`
- Branch: `codex/ci-inspection-timeout-20260811`
- Base: `origin/Dev@fa7fcee086534a2343afc2df22039cb041df5295`; fetched at 2026-08-11 Australia/Melbourne.
- Candidate patch SHA-256: `1368afaa4f74a2b97d947f2d7d4a59b6c549aea7cbf5ccb1b3bd8f6e3b75027c`; excludes `docs/change-release-ledger.md`.
- Commit SHA: `c6afce28b117abc41a8d2cbdf7deea19ace652bc` (candidate content commit); audit head is emitted by the release report.
- Dependencies: none; the test remains in the existing mobile `check:ci` quality gate.
- Required validation: PASS — targeted screen test and `npm run check:ci` passed after the bounded-timeout change.
- Shared-hunk review: PASS — only this test file and this CRL ledger entry are selected.
- Generated-file review: PASS — no generated output, cache, environment file or dependency artifact is selected.
- Independent review: GO for push — independent read-only review found no P0/P1 in the exact committed range; every assertion remains in the full Jest gate.
- Technical state: pushed
- User authorization: approved-for-push — user replied “推送” after the exact mobile `8fcf4dfa69242d14fb08904f5816f095eee2e568` commit and branch were presented on 2026-08-11.
- Action conclusion: GO — push succeeded; `origin/codex/ci-inspection-timeout-20260811` was verified by `git ls-remote` at `8fcf4dfa69242d14fb08904f5816f095eee2e568`. PR, merge, deployment, OTA and device verification remain separate and not performed.

### Risks / Release Notes

- Risk: a real render deadlock can now occupy CI for at most 10 seconds; assertions and full-regression membership remain unchanged, so failure remains visible.
- Rollback: restore the test's default timeout arguments; no business code or data requires rollback.
- Sensitive-information review: no secrets, `.env` values, tokens, credentials, database URLs, caches, generated files, or production data are added.
- Git state: candidate content commit `c6afce28b117abc41a8d2cbdf7deea19ace652bc` is pushed with audit head `8fcf4dfa69242d14fb08904f5816f095eee2e568` on `origin/codex/ci-inspection-timeout-20260811`; PR not created, not merged, not deployed, OTA not published and device/production verification not run.

## CRL-20260811-004 — 修复交付状态与完成声明强制边界（mobile governance）

- **Status:** candidate
- **Updated:** 2026-08-11 Australia/Melbourne
- **Request:** 防止本地已修复、已测试、已提交、已推送、已合并、已部署或已通过 OTA/真机验证被混为一谈，导致移动端修复被误报为已交付。
- **Outcome:** 独立 mobile 仓库现在与 root 使用同一套交付状态规则：实现、测试、提交、推送、合并、后端部署、OTA 和设备验证必须逐项以实际证据报告；未执行阶段必须明确为未执行。

### Files / Areas

- `AGENTS.md` — 增加完成与交付声明规则，并要求以独立 mobile 仓库的实际 Git 和交付证据回答。
- `docs/change-release-ledger.md` — 记录与 root `CRL-20260811-004` 配对的独立移动端治理单元。

### Impact / Dependencies

- **Runtime / API / database / migration / configuration / dependencies:** none；不改变业务代码、权限、媒体对象或生产数据。
- **Related units:** root `CRL-20260811-004`; 本移动端 CRL 必须和 root 的规则保持同一交付阶段定义。

### Validation

- Source/diff review — passed：规则明确区分 source、local regression、commit、push、merge、backend deploy、OTA 与 device verification。
- `npm run check:ci` — passed：ledger-range tests、ledger coverage、typecheck、lint（0 errors / 114 existing warnings）、strict button audit、fast Jest 与全量 Jest（54 suites / 275 tests）均通过。

### Release Attempts

- `RA-20260811-mobile-feedback-p1-01` — same selected mobile release attempt recorded under `CRL-20260811-005`; its independent review found the missing mobile companion rule, which this paired unit resolves before a new exact-candidate review.

### Risks / Release Notes

- Rollback: 删除该规则段；不影响运行时代码或数据。
- Sensitive-information review: 未添加或记录 secrets、`.env`、token、数据库 URL、生产数据或敏感日志。
- Git state: candidate content commits `02428463785cc9ed42a264b57683d894478b04a0` and `e934cb0f2ee5cc3c6dc10c0d6eeb33f4a7978cf7` are pushed with audit head `999fe13b94789a7e0dae5403730dac141b2fa930` on `origin/codex/release-feedback-p1-20260811-mobile`; PR not created, not merged, not deployed, OTA not published and device/production verification not run.

## CRL-20260811-005 — 反馈表单布局与来源任务提交修复（mobile）

- **Status:** candidate
- **Updated:** 2026-08-11 Australia/Melbourne
- **Request:** 修复反馈卡片窄屏中文逐字竖排、现场照片“拍照上传/相册选择”不居中，以及维修反馈将工作任务 ID 错作来源任务 ID 提交的问题。
- **Outcome:** 历史反馈卡片把缩略图/文字与四个操作按钮分为两行，缩略图可随可用宽度收缩；现场照片两个按钮等宽且整组居中。所有反馈提交只使用 `task.source_id`，缺失来源时停止提交；批量反馈保留服务端对每一条记录返回的具体失败原因。

### Files / Areas

- `src/screens/tasks/FeedbackFormScreen.tsx` — 调整反馈卡片和现场照片按钮布局，恢复严格的 `source_task_id` 映射，并展示具体提交失败信息。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — 覆盖窄屏两行布局、等宽居中按钮、`source_task_id` payload 与服务端错误显示。
- `docs/change-release-ledger.md` — 记录本移动端候选。

### Impact / Dependencies

- **API / database / migration / config / dependencies:** none；使用既有反馈接口和照片授权逻辑，不改变操作权限。
- **Related units:** `CRL-20260811-006` 追加已完成任务照片；本单元独立修复布局与反馈 source ID，不应夹带其他本地反馈页改动。

### Validation

- `jest --runInBand --no-cache src/screens/tasks/FeedbackFormScreen.test.tsx` — passed：3 tests，覆盖布局、payload 与具体错误。
- `npm run typecheck` — passed in isolated candidate using the existing dependency tree; no dependency install.
- `npm run lint` — passed：0 errors；114 existing warnings（本次未新增 lint error）。
- `npm run check:ci` — passed：同一候选的完整移动端门禁，54 suites / 275 tests；详见 `RA-20260811-mobile-feedback-p1-02`。

### Release Attempts

#### RA-20260811-mobile-feedback-p1-01

- Repository: `mobile`; selected CRLs: `CRL-20260811-004`, `CRL-20260811-005`, `CRL-20260811-006`, `CRL-20260811-007`; intended action: `commit`.
- Branch: `codex/release-feedback-p1-20260811-mobile`; base: `origin/Dev@5c18c767d56290c54ee7fa47ec26e485fa94eca4`, fetched 2026-08-11.
- Candidate patch SHA-256: `2988d198a10e60448bd2f00be7c28aa9da8c303abe0434bb6c875baeda73a71d` excluding `docs/change-release-ledger.md`; candidate content commit: not committed. This staged fingerprint includes the new `CleaningMediaImage.test.tsx` file.
- Dependencies: root `CRL-20260811-004`, root/mobile `CRL-20260811-006`; the completion-photo API must be deployed before any OTA claim.
- Required validation: `NOT VERIFIED`; shared-hunk / generated-file review: `PASS`; independent review: `NO-GO` (pre-fix reviewer found P1 completion-photo proxy/read-context, false-success/delete, mobile governance and full-gate gaps).
- Technical state: `candidate`; user authorization: `selected-for-commit` (user selected `004`, `005`, `006`, `007` on 2026-08-11; exact commit-bound push authorization is still required); action conclusion: `BLOCKED`; blockers: reviewer P1 and full quality gates were not yet complete for this superseded candidate.

#### RA-20260811-mobile-feedback-p1-02

- Repository: `mobile`; selected CRLs: `CRL-20260811-004`, `CRL-20260811-005`, `CRL-20260811-006`, `CRL-20260811-007`; intended action: `commit`.
- Branch: `codex/release-feedback-p1-20260811-mobile`; base: `origin/Dev@5c18c767d56290c54ee7fa47ec26e485fa94eca4`, fetched 2026-08-11.
- Candidate patch SHA-256: `5b9cf994eb5b181cfba3062167c99745297ed05f7bc216b9879c1b84781f2ea0` excluding `docs/change-release-ledger.md`; candidate content commit: not committed.
- Dependencies: root `CRL-20260811-004`, root/mobile `CRL-20260811-006`; the completion-photo API must be deployed before any OTA claim.
- Required validation: superseded — `npm run check:ci` completed with 54 suites / 275 tests before the second independent review found the pending-remote-reference P1.
- Shared-hunk / generated-file review: PASS — only selected source/tests/docs are present; no generated output, cache, environment file or dependency artifact is selected.
- Independent review: `NO-GO` — exact staged review found that acknowledged remote references were lost when the business-save request failed.
- Technical state: `candidate`; user authorization: `selected-for-commit`; action conclusion: `BLOCKED`; this fingerprint is superseded by the pending-reference retry repair and must not be committed.

#### RA-20260811-mobile-feedback-p1-03

- Repository: `mobile`
- Selected CRLs: `CRL-20260811-004`, `CRL-20260811-005`, `CRL-20260811-006`, `CRL-20260811-007`
- Intended action: `commit`
- Branch: `codex/release-feedback-p1-20260811-mobile`
- Base: `origin/Dev@5c18c767d56290c54ee7fa47ec26e485fa94eca4`; fetched at 2026-08-11 Australia/Melbourne.
- Candidate patch SHA-256: `5b241081896fd206feadc87d83878b22765e958115b2e26de700f38069f44f5c` excluding `docs/change-release-ledger.md`.
- Commit SHA: `02428463785cc9ed42a264b57683d894478b04a0` (candidate content commit)
- Dependencies: root `CRL-20260811-004`, root/mobile `CRL-20260811-006`; the completion-photo API must be deployed before any OTA claim.
- Required validation: PASS — `npm run check:ci` completed after the P1 retry repair with 55 suites / 278 tests; 114 pre-existing lint warnings and no errors.
- Shared-hunk review: PASS — exact staged range contains only selected source/tests/docs.
- Generated-file review: PASS — no generated output, cache, environment file or dependency artifact is selected.
- Independent review: GO for commit — independent read-only review found no P0/P1 in the exact paired root/mobile fingerprints; real device restart, weak-network retry and deployed Dev backend verification remain P2 post-commit gates.
- Technical state: committed
- User authorization: selected-for-commit — user selected CRL-004,005,006,007 on 2026-08-11.
- Action conclusion: GO — commit completed; push still requires exact commit-bound authorization for the current branch head.

#### RA-20260811-mobile-feedback-p1-04

- Repository: `mobile`
- Selected CRLs: `CRL-20260811-004`, `CRL-20260811-005`, `CRL-20260811-006`, `CRL-20260811-007`
- Intended action: `push`
- Branch: `codex/release-feedback-p1-20260811-mobile`
- Base: `origin/Dev@5c18c767d56290c54ee7fa47ec26e485fa94eca4`; fetched at 2026-08-11 Australia/Melbourne.
- Candidate patch SHA-256: `24acb20235462e5046e0e54de11af21f3fb06935aa9d66804fa93a4bccaf81bc` excluding `docs/change-release-ledger.md`.
- Commit SHA: `e934cb0f2ee5cc3c6dc10c0d6eeb33f4a7978cf7` (candidate content commit for the test-prop correction)
- Dependencies: root `CRL-20260811-004`, root/mobile `CRL-20260811-006`; the completion-photo API must be deployed before any OTA claim.
- Required validation: PASS — after the test-prop correction, `npm run check:ci` passed: 55 suites / 278 tests, strict button audit, 0 lint errors and 114 existing warnings.
- Shared-hunk review: PASS — exact staged range contains only the selected test and ledger paths.
- Generated-file review: PASS — no generated output, cache, environment file or dependency artifact is selected.
- Independent review: GO for push — independent read-only review found no P0/P1 in the exact committed root/mobile ranges; the final test prop spread preserves behavior and removes the credential-pattern false positive.
- Technical state: pushed
- User authorization: approved-for-push — user replied “批准” after the exact mobile `999fe13b94789a7e0dae5403730dac141b2fa930` commit and branch were presented on 2026-08-11.
- Action conclusion: GO — push succeeded; `origin/codex/release-feedback-p1-20260811-mobile` was verified by `git ls-remote` at `999fe13b94789a7e0dae5403730dac141b2fa930`. PR, merge, deployment, OTA and device/production verification remain separate and not performed.

### Risks / Release Notes

- Runtime risk: 缺少 `source_id` 的异常旧任务现在会明确阻止提交并提示刷新，不再把错误的工作任务 ID 发给后端。
- Rollback: 恢复原布局与提交映射；不涉及照片授权、服务端字段或历史数据迁移。
- Sensitive-information review: 未添加或记录 secrets、`.env`、token、数据库 URL、生产数据或敏感日志。
- Git state: candidate content commits `02428463785cc9ed42a264b57683d894478b04a0` and `e934cb0f2ee5cc3c6dc10c0d6eeb33f4a7978cf7` are pushed with audit head `999fe13b94789a7e0dae5403730dac141b2fa930` on `origin/codex/release-feedback-p1-20260811-mobile`; PR not created, not merged, not deployed, OTA not published and device/production verification not run.

## CRL-20260811-006 — 已完成线下任务补充完成记录照片（mobile）

- **Status:** candidate
- **Updated:** 2026-08-11 Australia/Melbourne
- **Request:** 已完成线下任务的“任务处理”照片不得只留在页面内存；需要明确、受权限控制地保存为完成记录，维修任务不受影响。
- **Outcome:** 客户端仅在服务端 `available_actions` 包含 `append_completion_photo` 时显示“补充拍照/补充相册”。远端上传成功后，先按任务和当前用户持久化“待保存”引用，再请求追加完成记录；若业务保存失败，照片不显示为已保存，但保留跨页面的“重试保存已上传照片”动作，不会重新上传。缩略图和预览都传同一 `work_task_id`；没有服务端删除 action 时隐藏已完成照片的删除入口。无动作时入口保持隐藏，通用“标记完成”保持禁用；维修任务继续使用既有专用流程。

### Files / Areas

- `src/lib/api.ts` — 增加服务端受控的完成照片追加 action/intent 与 API 调用。
- `src/lib/workTaskCompletionPhotoPending.ts` — 任务/用户范围内持久化并校验已上传、尚未保存的私有媒体引用；仅服务器确认完成记录后清除。
- `src/lib/workTaskCompletionPhotoPending.test.ts` — 覆盖持久化去重、用户隔离和确认后清除。
- `src/screens/tasks/TaskDetailScreen.tsx` — 按服务端动作显示补充入口；先持久化待保存引用，业务保存失败后提供仅重试保存的动作；只有服务器确认才显示已保存照片；缩略图/预览传任务读取上下文，并隐藏无服务端动作的已完成照片删除入口。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — 覆盖有动作时落库调用、跨页面重试不重新上传、读取上下文、保存失败不显示、已完成照片无本地假删除和既有完成状态边界。
- `docs/change-release-ledger.md` — 记录本移动端候选及配对依赖。

### Impact / Dependencies

- **API:** 依赖 root `CRL-20260811-006` 提供仅适用于 `cleaning_offline_tasks` 的 `POST /mzapp/work-tasks/:id/completion-photos` 与 `append_completion_photo`。
- **Database / migration / config / dependencies:** none；移动端不做本地“已保存”推断；本地仅保存私有远端引用和任务/用户归属，不保存 token 或公开 R2 URL。
- **Related units:** root/mobile `CRL-20260811-006` 必须作为同一配对版本发布；不得用 OTA 单独假设后端接口已存在。

### Validation

- `npm test -- --runInBand --no-cache src/screens/tasks/TaskDetailScreen.test.tsx src/lib/workTaskCompletionPhotoPending.test.ts` — passed：2 suites / 35 tests，含上传成功后业务保存失败的持久化、重开后只重试保存不重传、确认后清除。
- `npm run typecheck` — passed in isolated candidate using the existing dependency tree; no dependency install.
- `npm run lint` — passed：0 errors；114 existing warnings（本次未新增 lint error）。
- `npm run check:ci` — passed：P1 retry repair后的完整移动端门禁，55 suites / 278 tests，0 errors / 114 existing warnings；详见 `RA-20260811-mobile-feedback-p1-03`。

### Release Attempts

- `RA-20260811-mobile-feedback-p1-01` — same selected mobile release attempt recorded under `CRL-20260811-005`; the root/mobile `CRL-20260811-006` dependency and all commit/push gates apply unchanged.

### Risks / Release Notes

- Runtime risk: 后端未同步部署时服务器不会下发 action，客户端入口保持隐藏；服务端返回失败时照片不会被标示为已保存，而是保留任务/用户范围的待保存引用并只重试业务保存。若设备本地待保存记录写入也失败，页面会明确要求留在当前页重试，且不会在未持久化前发起业务保存。不得将该候选单独作为“已完成照片已保存”的发布证据。
- Rollback: 删除补充 action 的客户端调用和入口；不影响已有维修动作或既有完成照片。
- Sensitive-information review: 未添加或记录 secrets、`.env`、token、数据库 URL、生产数据或敏感日志。
- Git state: candidate content commits `02428463785cc9ed42a264b57683d894478b04a0` and `e934cb0f2ee5cc3c6dc10c0d6eeb33f4a7978cf7` are pushed with audit head `999fe13b94789a7e0dae5403730dac141b2fa930` on `origin/codex/release-feedback-p1-20260811-mobile`; PR not created, not merged, not deployed, OTA not published and device/production verification not run.

## CRL-20260811-007 — 线下任务缩略图失败原因可见（mobile）

- **Status:** candidate
- **Updated:** 2026-08-11 Australia/Melbourne
- **Request:** 线下任务私有照片读取失败时不能只显示空灰框；需要区分权限、对象缺失和可重试读取失败，以便继续追踪实际服务端根因。
- **Outcome:** 缩略图组件保留认证媒体加载的失败分类：403/404 显示明确终态原因且不重试；网络、超时或 5xx 显示“点击重试”。不暴露私有 R2 URL、token 或原始请求内容。

### Files / Areas

- `src/components/CleaningMediaImage.tsx` — 保存媒体读取失败状态并渲染终态原因或重试入口，替代空白占位。
- `src/components/CleaningMediaImage.test.tsx` — 覆盖 403/404 原因可见和可重试失败的重试入口。
- `docs/change-release-ledger.md` — 记录本移动端候选。

### Impact / Dependencies

- **API / database / migration / config / dependencies:** none；继续经已有认证媒体代理读取，不改照片授权。
- **Related units:** 依赖既有私有媒体代理；实际请求是 403、404、部署不同步还是网络问题，仍需与已部署服务配对后做一次受控真机读取追踪。

### Validation

- `jest --runInBand --no-cache src/components/CleaningMediaImage.test.tsx src/components/CleaningMediaPreview.test.tsx src/lib/cleaningMediaCache.test.ts` — passed：3 suites / 12 tests。
- `npm run typecheck` — passed in isolated candidate using the existing dependency tree; no dependency install.
- `npm run lint` — passed：0 errors；114 existing warnings（本次未新增 lint error）。
- `npm run check:ci` — passed：同一候选的完整移动端门禁，54 suites / 275 tests；详见 `RA-20260811-mobile-feedback-p1-02`。

### Release Attempts

- `RA-20260811-mobile-feedback-p1-01` — same selected mobile release attempt recorded under `CRL-20260811-005`; this diagnostic-thumbnail unit has no server deployment dependency but must pass the same selected-range review.

### Risks / Release Notes

- Runtime risk: 本修复让失败可诊断，不会自行修复未部署、授权、对象缺失或网络根因；禁止据此宣称线上照片已恢复。
- Rollback: 恢复原缩略图失败占位；不修改任何远端媒体对象、授权或缓存清理。
- Sensitive-information review: 未添加或记录 secrets、`.env`、token、数据库 URL、生产数据或敏感日志。
- Git state: candidate content commits `02428463785cc9ed42a264b57683d894478b04a0` and `e934cb0f2ee5cc3c6dc10c0d6eeb33f4a7978cf7` are pushed with audit head `999fe13b94789a7e0dae5403730dac141b2fa930` on `origin/codex/release-feedback-p1-20260811-mobile`; PR not created, not merged, not deployed, OTA not published and device/production verification not run.

## CRL-20260731-007 — 检查照片上传进度不重载草稿

- **Status:** candidate
- **Updated:** 2026-08-11 12:43 AEST
- **Request:** 将 PR #11 中的检查照片上传进度稳定性修复正确合入当前 `Dev`。
- **Outcome:** 队列进度事件仅更新当前批次状态与错误展示；完整草稿只在初始加载或明确重试时读取，过期异步读取不会回写界面。

### Implementation

- Previous behavior: 上传队列每一次进度通知都会触发完整 `loadLocalState()`，重复还原草稿并造成检查页滚动闪动。
- New behavior: 仅当批次状态或错误实际变化时更新批次展示；用读取版本号阻止迟到的异步结果覆盖当前页面。
- Key decisions: 只迁移 `deba0fe` 中的检查页与测试改动；不带入旧分支的 `main` 合并提交、版本配置、工作流、依赖或其他历史台账内容。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.tsx` — 队列进度展示与草稿完整读取解耦，并保护过期异步读取。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — 覆盖队列进度不重读草稿、状态仍刷新和同任务来源变化时受控重读。
- `docs/change-release-ledger.md` — 记录本次从旧 PR 正确迁移的发布单元与尝试。

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Related unit: `CRL-20260731-005` 随同一原始提交进入本候选；不依赖新的后端变更。
- Protected behavior: 上传顺序、幂等处理、本地媒体保留、服务端任务 action、权限与弱网队列语义不变。

### Validation

- `npm test -- --runInBand --no-cache src/screens/tasks/InspectionPanelScreen.test.tsx` — passed: 1 suite / 13 tests, including server-authoritative pure-checkin submission, queue progress without draft reload and controlled source refresh.
- `npm run check:ci` — passed: ledger-range tests (11), working-tree ledger coverage (3/3), TypeScript, ESLint (0 errors / 113 existing warnings), strict button audit, fast Jest (3 suites / 18 tests) and serial full Jest.
- `git diff --cached --check` — passed.
- Independent review — GO for `commit` only; no P0/P1 found. The non-blocking P2 follow-up is recorded in this attempt and does not authorize push, PR merge, EAS, deployment or production action.

### Release Attempts

#### RA-20260811-mobile-inspection-stability-01

- Repository: `mobile`
- Selected CRLs: `CRL-20260731-005`, `CRL-20260731-007`
- Intended action: `commit`
- Branch: `codex/release-inspection-stability-20260811`
- Base: `origin/Dev@6539fb59dac7adaa36a16d9075550f885e9b0407`; fetched at 2026-08-11 12:41 AEST.
- Candidate patch SHA-256: `f563c2c4679b6b68f2e9ac972c165c28a0923c1ba7d4b491878e94d7681b73de` excluding `docs/change-release-ledger.md`.
- Commit SHA: `ffa0da0b69f98dfd7f1e313139506e0bf4fb5192` (candidate content commit).
- Dependencies: none; current client continues to use the existing server-authoritative `submit_inspection` action.
- Required validation: PASS; target Jest and `npm run check:ci` passed in this exact candidate.
- Shared-hunk review: PASS; only the selected screen, its test and ledger records are in scope.
- Generated-file review: PASS; no generated output, cache, environment file or dependency artifact is selected.
- Technical state: committed.
- User authorization: selected-for-commit; evidence: user instructed “那你合并吧” after confirming the PR #11 repair on 2026-08-11.
- Independent review: GO for commit — independent read-only review rechecked the exact staged fingerprint, full diff, target Jest, `npm run check:ci`, ledger coverage, whitespace and sensitive/production-write risk; no P0/P1 found. Non-blocking P2 items are the root `FR-004` traceability receipt and an explicit `cleaning_submission_required` negative regression.
- Action conclusion: GO for commit completed; blockers: exact commit-bound push authorization, PR creation and merge remain pending.

#### RA-20260811-mobile-inspection-stability-02

- Repository: `mobile`
- Selected CRLs: `CRL-20260731-005`, `CRL-20260731-007`
- Intended action: `push`
- Branch: `codex/release-inspection-stability-20260811`
- Base: `origin/Dev@6539fb59dac7adaa36a16d9075550f885e9b0407`; fetched at 2026-08-11 13:51 AEST and verified unchanged.
- Candidate patch SHA-256: `f563c2c4679b6b68f2e9ac972c165c28a0923c1ba7d4b491878e94d7681b73de` excluding `docs/change-release-ledger.md`.
- Commit SHA: `ffa0da0b69f98dfd7f1e313139506e0bf4fb5192` (candidate content commit).
- Dependencies: none; current client continues to use the existing server-authoritative `submit_inspection` action.
- Required validation: PASS; evidence retained in RA-20260811-mobile-inspection-stability-01.
- Shared-hunk review: PASS; evidence retained in RA-20260811-mobile-inspection-stability-01.
- Generated-file review: PASS; no generated output, cache, environment file or dependency artifact is selected.
- Technical state: pushed.
- User authorization: approved-for-push; evidence: user approved the exact mobile branch, candidate content commit `ffa0da0b69f98dfd7f1e313139506e0bf4fb5192` and earlier audit head `1b64ecc885020a55ad9bea01b9f3dbd7fa5a71a2` on 2026-08-11, including PR creation and merge to `Dev` after checks.
- Independent review: GO for push — independent read-only review accepted `origin/Dev@6539fb59dac7adaa36a16d9075550f885e9b0407...01310106c305106c11328b40d18fac491ad685ef`, candidate content commit `ffa0da0b69f98dfd7f1e313139506e0bf4fb5192` and fingerprint `f563c2c4679b6b68f2e9ac972c165c28a0923c1ba7d4b491878e94d7681b73de`; no P0/P1. P2: explicit `cleaning_submission_required` negative regression remains a follow-up.
- Remote push evidence: `origin/codex/release-inspection-stability-20260811@b8a0feec3051e36afb03bb452e3c7a4ad6a60963` created at 2026-08-11 14:02 AEST.
- Action conclusion: GO for push completed. PR creation and merge to `Dev` remain separate actions subject to current PR checks.

### Risks / Release Notes

- Real-device scroll behavior, weak-network recovery, native build, OTA, deployment and production acceptance are not inferred from source tests.
- Rollback: revert the exact `Dev` merge commit in a later reviewed change; no data rollback is required.
- Sensitive-information review: no secrets, `.env` values, tokens, credentials, private media, logs or production data are selected.

## CRL-20260731-005 — 纯入住检查不再错误要求清洁提交

- **Status:** candidate
- **Updated:** 2026-08-11 12:43 AEST
- **Request:** 将 PR #11 中纯入住检查被旧本地字段错误阻断的修复正确合入当前 `Dev`。
- **Outcome:** 客户端不再将遗留 `cleaning_submission_ready=false` 作为本地否决条件；仅遵从服务端 `submit_inspection` action 的明确禁用原因。

### Implementation

- Previous behavior: 服务端已允许的纯入住检查可能被客户端旧字段误判并阻止提交。
- New behavior: 仅服务端返回 `cleaning_submission_required` 时显示清洁提交前置阻断。
- Key decisions: 不放宽服务端前置、照片/视频门槛、权限或任务状态；该变更删除客户端的重复推断。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.tsx` — 删除遗留字段的本地阻断。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — 覆盖旧字段为 false 但服务端 action 允许时可提交。
- `docs/change-release-ledger.md` — 记录同一候选中的独立功能单元。

### Impact / Dependencies

- API: 依赖既有 `/mzapp/work-tasks` `submit_inspection` action 与其 `disabled_reason`；根仓库 `docs/feature-regression-registry.md` 的 `FR-004` 记录该服务端权威 action 契约。不修改 API、数据库、迁移、配置或依赖。
- Related unit: 与 `CRL-20260731-007` 同一候选、同一 Release Attempt。
- Protected behavior: 服务端对清洁提交、照片、客人到达、挂钥匙/密码视频和权限的决定保持最终权威。

### Validation

- See the shared target Jest, typecheck, `npm run check:ci`, ledger, whitespace and independent-review evidence in `CRL-20260731-007`.

### Release Attempts

- See `RA-20260811-mobile-inspection-stability-01` in `CRL-20260731-007`.

### Risks / Release Notes

- The client no longer blocks an allowed action locally; the server still rejects disallowed submissions. No production data or external sync is performed.
- Sensitive-information review: no secrets, tokens, credentials, private media, logs or production records are selected.

## CRL-20260810-001 — 线下任务照片稳定引用与终态读取边界（mobile）

- **Status:** candidate
- **Updated:** 2026-08-10 00:55 AEST
- **Request:** 将原本与 mobile TestFlight 诊断冲突的离线任务照片客户端部分重新编号，随 root `CRL-20260809-001` 发布。
- **Outcome:** 上传响应保留兼容 URL 并读取 `remoteReference`；线下任务优先保存稳定服务端引用。当前 `r2://` 引用带 `work_task_id` 走认证 proxy，权限/缺失响应不再重试，网络/服务暂不可用仍可由用户重试。

### Implementation

- Previous behavior: 客户端将公共 URL 作为任务照片身份，canonical 引用未带任务上下文；终态读取错误可被缓存或重试 UI 误判。
- New behavior: 任务照片保存 `remoteReference` 优先、URL 回退兼容旧后端；认证读取使用精确任务上下文，终态失败清除缓存并只展示说明。
- Key decisions: 新 CRL 仅替代本次 mobile 照片客户端范围；保留 `CRL-20260809-001` 的历史 TestFlight runtime 诊断，不更改其事实或发布结论。

### Files / Areas

- `src/lib/api.ts` — 暴露上传 `remoteReference`。
- `src/lib/api.test.ts` — 上传响应兼容回归。
- `src/lib/cleaningMedia.ts` — canonical 线下引用走认证 proxy 并携带任务上下文。
- `src/lib/cleaningMedia.test.ts` — proxy 参数回归。
- `src/lib/cleaningMediaCache.ts` — 终态读取错误分类和缓存清理。
- `src/lib/cleaningMediaCache.test.ts` — 403/404 与网络重试边界。
- `src/components/CleaningMediaPreview.tsx` — 终态错误展示且不提供重试。
- `src/components/CleaningMediaPreview.test.tsx` — 终态/可恢复失败和本地预览回归。
- `src/screens/tasks/TaskDetailScreen.tsx` — 线下任务照片保存稳定引用和认证读取上下文。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — 共享任务详情 mock 与回归。
- `docs/change-release-ledger.md` — 本次 mobile 发布记录。

### Impact / Dependencies

- API: depends on root `CRL-20260809-001` returning `remote_reference` and enforcing `work_task_id` association.
- Database / migration / config / dependencies: none.
- Related units: root `CRL-20260809-001`; mobile `CRL-20260809-004`.

### Validation

- `jest --runInBand --no-cache src/lib/api.test.ts src/lib/cleaningMedia.test.ts src/lib/cleaningMediaCache.test.ts src/components/CleaningMediaPreview.test.tsx` — passed: 4 suites / 34 tests in the clean candidate.
- `tsc -p tsconfig.json` — passed.
- `eslint .` — passed with 0 errors and 113 existing warnings.

### Release Attempts

#### RA-20260810-mobile-maintenance-media-01

- Repository: mobile.
- Selected CRLs: CRL-20260809-004, CRL-20260810-001.
- Intended action: push.
- Branch: codex/release-20260809-001-003-004-006.
- Base: origin/Dev@316f59f0862e0fc29f866304854aa3c8797b4a2d; fetched at 2026-08-10 21:36:03 AEST and unchanged on recheck.
- Candidate patch SHA-256: c555e5db93decec2b3da6844c375481fda6418df443d7b0af3fa9f8a7c4f2618 (staged content excluding `docs/change-release-ledger.md`).
- Commit SHA: ec505ff26b4b51747d5eb20c2c4d4059dea3b6a8 (candidate content commit).
- Dependencies: root `CRL-20260809-001` must be deployed before this mobile client is expected to receive the new server reference contract.
- Required validation: PASS; five targeted suites, TypeScript and ESLint passed.
- Shared-hunk review: PASS; the staged candidate contains only CRL-20260809-004 and CRL-20260810-001 files, including their shared task-detail hunks.
- Generated-file review: PASS; staged paths contain no generated output, cache, coverage or map file.
- Technical state: pushed.
- User authorization: approved-for-push; user approved the exact mobile candidate content commit `ec505ff26b4b51747d5eb20c2c4d4059dea3b6a8` and branch `codex/release-20260809-001-003-004-006` on 2026-08-10.
- Independent review: GO for `c555e5db93decec2b3da6844c375481fda6418df443d7b0af3fa9f8a7c4f2618`; paired review covered the full staged mobile diff, ledger, scope, generated-file and sensitive-information checks. No P0/P1 found; root server-contract deployment remains a dependency.
- Remote push evidence: `origin/codex/release-20260809-001-003-004-006@99ce293984f91402a63f2cee5c9bcb817ded9106` created at 2026-08-10 21:37:55 AEST; `Dev` unchanged.
- PR evidence: NOT VERIFIED; this environment has no `gh` command and no `GITHUB_TOKEN`/`GH_TOKEN`, so no mobile PR was created automatically.
- Action conclusion: GO for push completed; mobile PR creation against `Dev` remains pending external GitHub authorization.

### Risks / Release Notes

- Device receipt, deployed service behavior, real historical object availability and manager/assignee/outsider checks remain unverified.
- Sensitive-information review: no credentials, tokens, private photo URLs, media bytes, database URLs, `.env` values or logs are included.
- Git state: release metadata receipts are pushed; the exact remote branch head is verified separately with post-push `git ls-remote`; `Dev` remains unchanged pending PR.

## CRL-20260809-004 — 内部维修详情缓存前照片回填（mobile）

- **Status:** candidate
- **Updated:** 2026-08-10 00:55 AEST
- **Request:** 已有 `property_maintenance` 缓存缺少维修前照片字段时，详情只刷新一次并显示服务端回填结果。
- **Outcome:** 同一任务/用户/列表视图只刷新一次现有任务列表；成功后显示维修前照片，失败仍保留可用缓存。

### Implementation

- Previous behavior: 缓存任务直接渲染，缺失字段时不再向既有任务列表刷新。
- New behavior: 仅内部维修缓存走一次既有列表刷新，正常 UI 以回填字段和认证图片组件显示照片；非维修任务保持原行为。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx` — 一次性刷新和维修前照片展示。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — 回填、只刷新一次和刷新失败回归。
- `docs/change-release-ledger.md` — 本次 mobile 发布记录。

### Impact / Dependencies

- API: depends on existing `GET /mzapp/work-tasks` `maintenance_before_photo_urls` projection.
- Database / migration / config / dependencies: none.
- Related units: root `CRL-20260809-004`, root `CRL-20260809-006`, mobile `CRL-20260810-001`.

### Validation

- `jest --runInBand --no-cache src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite / 17 tests in the clean candidate.
- TypeScript and ESLint evidence is retained in `CRL-20260810-001` for this exact candidate.

### Release Attempts

- See `RA-20260810-mobile-maintenance-media-01` in CRL-20260810-001.

### Risks / Release Notes

- Authenticated proxy/device verification remains separate from source tests.

## CRL-20260809-002 — 新建可复现的 TestFlight iOS OTA 基线（mobile）

- **Status:** ready
- **Updated:** 2026-08-09 01:07 AEST
- **Request:** 用户授权基于当前已合并的 `Dev` 新建 iOS 外部 TestFlight 原生基线包，使维修任务修复可由精确源码交付，并为后续 OTA 建立可验证的 runtime。
- **Outcome:** iOS 应用版本设置为 1.0.26、build number 设置为 27；该原生构建将从当前候选源码生成新的 fingerprint，并直接包含已合并的维修照片预览、提交状态和完成/未完成等宽按钮修复。

### Implementation

- Previous behavior: 当前 `Dev` 无法复现已安装 TestFlight build 26 的历史 fingerprint，不能向该二进制安全发布 OTA。
- New behavior: 创建一个来自精确候选提交的 iOS TestFlight build 27；以后仅向这个新 fingerprint 发布兼容 OTA。新基线二进制本身包含当前已合并的 JS 修复，不另外发布无意义的同代码 OTA。
- Key decisions: 仅递增 iOS build number；Android `versionCode` 保持 25，因为本次不发布 Android。保留 `runtimeVersion.policy: fingerprint`，不手工指定或覆盖 runtime，不改业务代码、权限、依赖或后端。

### Files / Areas

- `app.json` — modified: iOS TestFlight 基线版本 1.0.26/build 27。
- `docs/change-release-ledger.md` — modified: 记录原生基线与后续 OTA 的审计证据。

### Impact / Dependencies

- API: none.
- Database / migration: none.
- Config / environment: iOS native release metadata changes intentionally require a new EAS build; production API environment remains from the existing `testflight` profile.
- Dependencies: none; no package manifest or native module change.
- Related units: `CRL-20260809-001` documents why the existing binary cannot receive this OTA; merged `CRL-20260808-001`, `CRL-20260808-002`, and `CRL-20260808-006` are included in the base. Root service changes remain separately merged but not yet deployed.

### Validation

- iOS fingerprint — passed: local pre-build fingerprint is `d1323f38006e6b8d651efc4d07b24dd5c263880f`; the new native build must publish this exact runtime, so comparison to obsolete build 26 is intentionally not required.
- `npm run check:ci` — passed: ledger auditor 11/11; working-tree coverage 2/2; TypeScript passed; ESLint 0 errors / 113 existing warnings; strict button audit passed; 53 Jest suites / 256 tests passed.
- `npx expo export --platform ios --output-dir <temporary directory>` — passed: Metro bundled 1,574 modules and wrote output outside the repository.
- EAS iOS build — authorized, not run yet.
- App Store Connect/TestFlight submission and external-device acceptance — not authorized or run yet.

### Release Attempt

#### RA-20260809-mobile-testflight-baseline-01

- Repository: `mobile`.
- Selected CRLs: `CRL-20260809-001`, `CRL-20260809-002`.
- Intended action: `commit`.
- Branch: `codex/mobile-testflight-runtime-20260809`.
- Base: `origin/Dev@43427b10d60bbf5a226081155c1377218cec69cd`; fetched at 2026-08-09 00:45 AEST.
- Candidate patch SHA-256: `cd3841884ddc89a4f85ebb5809959ee92c0abc07e9c5b0afce90d1f8403a5607` from the staged `app.json` diff excluding `docs/change-release-ledger.md`.
- Commit SHA: `1a096698978a61f707e84fa705d1dad972ba5563` (candidate content commit).
- Dependencies: merged mobile maintenance content `77b05e5f9334f31850b390f834d3a0c5946ff737`; EAS iOS build is authorized only after a reviewed merged source candidate exists.
- Required validation: PASS; full CI, iOS export, fingerprint generation and ledger coverage passed.
- Shared-hunk review: PASS; `app.json` has no selected/unselected shared hunk, and both ledger records are selected release-attempt evidence.
- Generated-file review: PASS; `node_modules` is ignored verification-only material and the export output is outside the repository; neither is in the candidate.
- Technical state: committed.
- User authorization: selected-for-commit; evidence: user authorized the new iOS TestFlight native baseline on 2026-08-09. Push, merge and App Store Connect submission remain commit-SHA-bound actions.
- Independent review: GO for commit — 2026-08-09 independent read-only review accepted the exact staged fingerprint `cd3841884ddc89a4f85ebb5809959ee92c0abc07e9c5b0afce90d1f8403a5607`, complete two-file scope, validation and sensitive/generated-file review.
- Action conclusion: GO for commit; blockers: commit-bound push authorization is still required before any push or merge.

#### RA-20260809-mobile-testflight-baseline-02

- Repository: `mobile`.
- Selected CRLs: `CRL-20260809-001`, `CRL-20260809-002`.
- Intended action: `push`.
- Branch: `codex/mobile-testflight-runtime-20260809`.
- Base: `origin/Dev@43427b10d60bbf5a226081155c1377218cec69cd`; fetched at 2026-08-09 00:45 AEST.
- Candidate patch SHA-256: `cd3841884ddc89a4f85ebb5809959ee92c0abc07e9c5b0afce90d1f8403a5607`.
- Commit SHA: `1a096698978a61f707e84fa705d1dad972ba5563` (candidate content commit).
- Dependencies: merged mobile maintenance content `77b05e5f9334f31850b390f834d3a0c5946ff737`.
- Required validation: PASS; evidence is retained in RA-20260809-mobile-testflight-baseline-01.
- Shared-hunk review: PASS; evidence is retained in RA-20260809-mobile-testflight-baseline-01.
- Generated-file review: PASS; evidence is retained in RA-20260809-mobile-testflight-baseline-01.
- Technical state: committed.
- User authorization: approved-for-push; evidence: user confirmed the independent `mobile` repository, branch `codex/mobile-testflight-runtime-20260809`, candidate content commit `1a096698978a61f707e84fa705d1dad972ba5563`, and audited receipt head `e4ba249a9ec568abde498c0926f3eef5ed40dbcc` on 2026-08-09. The following ledger-only receipt does not alter the selected base, branch, CRLs, or non-ledger candidate patch.
- Independent review: GO for push technical review — 2026-08-09 independent read-only review accepted `origin/Dev@43427b10d60bbf5a226081155c1377218cec69cd...e4ba249a9ec568abde498c0926f3eef5ed40dbcc`, the candidate content commit and exact non-ledger fingerprint.
- Action conclusion: GO for push; blockers: none for this exact candidate. PR merge, EAS build, App Store Connect submission, backend deployment, OTA and device acceptance remain separate actions.

### Risks / Release Notes

- Risk: EAS build success is not App Store Connect submission, external TestFlight availability, OTA publication, backend deployment, or device acceptance proof.
- Rollback: abandon the cloud build before submission; revert this two-field metadata change in a subsequent reviewed release if the build must be withdrawn.
- Sensitive-information review: no secrets, `.env` contents, tokens, credentials, private keys, device logs, production data, or signed URLs are included.
- Git state: candidate content committed at `1a096698978a61f707e84fa705d1dad972ba5563`; a ledger-only commit receipt is pending, with no push or merge performed.

## CRL-20260809-001 — 诊断 TestFlight OTA runtime 基线不匹配（mobile）

- **Status:** blocked
- **Updated:** 2026-08-09 00:52 AEST
- **Request:** 在已合并的维修任务移动端修复上发布外部 TestFlight OTA；先修复当前 `Dev` 与已安装 TestFlight 基线的 runtime 不匹配。
- **Outcome:** 已确认当前 `Dev` 无法可靠地复现已安装 TestFlight 二进制的 runtime；未发布不可接收的 OTA，也未保留任何业务或版本配置改动。

### Implementation

- Previous behavior: `Dev` 记录为 1.0.25/iOS build 25，生成的 iOS fingerprint 为 `d749479f96ec94dd91a4c58eade8239f96f4e51b`，与 TestFlight 1.0.26/26 的 `e5f4cc520509f2b64df725bf8eef5a9a42dc0e8a` 不匹配，OTA 无可接收设备。
- Attempted behavior: 曾在干净候选中临时恢复为 1.0.26/iOS build 26；新 fingerprint 为 `fb584acb02cb88354c1f8d5822d6eac5177affba`，仍不匹配，已在提交前撤回。
- Key decisions: 不改变 runtime policy、原生依赖、权限、插件、Android 配置、API 或后端；不以手工覆盖 runtime 方式绕过兼容性保护，也不发布无人可接收的 OTA。

### Files / Areas

- `app.json` — investigated: 临时的 version/buildNumber 恢复在 fingerprint 校验失败后已撤回，未保留改动。
- `docs/change-release-ledger.md` — modified: 记录这一独立的 OTA 兼容性阻断与证据。

### Impact / Dependencies

- API: none.
- Database / migration: none.
- Config / environment: no retained configuration change; `runtimeVersion.policy` 保持 `fingerprint`。
- Dependencies: none; 复用与 `package-lock.json` 哈希一致的本地依赖树仅作 fingerprint 验证。
- Related units: `CRL-20260808-001`, `CRL-20260808-002`, `CRL-20260808-006`; root 已合并的配套维修服务端修复仍需单独部署才构成完整端到端生产验证。

### Validation

- iOS fingerprint parity — failed: current `Dev` is `d749479f96ec94dd91a4c58eade8239f96f4e51b`; temporary 1.0.26/26 metadata restoration was `fb584acb02cb88354c1f8d5822d6eac5177affba`; neither matches the installed TestFlight build `e5f4cc520509f2b64df725bf8eef5a9a42dc0e8a`.
- EAS build-source provenance — failed to reproduce: the EAS-reported commit `614dbd11545895488fc001138d30e2c63d970748` is an ancestor but its committed `package.json` lacks `expo-updates`; this is evidence that the finished binary was built from a non-identical source snapshot. The exact additional fingerprint input cannot be reconstructed safely from the committed history.
- `npm run check:ci` — not run: runtime parity gate blocked the candidate before a releasable source change existed.
- `npx expo export --platform ios` — not accepted as evidence: an earlier clean-worktree attempt lacked physical `node_modules` and Metro could not resolve `react-native-gesture-handler`; that is an environment setup failure, not a source verdict.
- EAS/TestFlight device validation — not run; no OTA was published.

### Release Attempt

#### RA-20260809-mobile-testflight-runtime-01

- Repository: `mobile`.
- Selected CRLs: `CRL-20260809-001`.
- Intended action: `commit`.
- Branch: `codex/mobile-testflight-runtime-20260809`.
- Base: `origin/Dev@43427b10d60bbf5a226081155c1377218cec69cd`; fetched at 2026-08-09 00:45 AEST.
- Candidate patch SHA-256: not created; no retained source candidate.
- Commit SHA: not committed.
- Dependencies: TestFlight iOS build 1.0.26/26 with fingerprint `e5f4cc520509f2b64df725bf8eef5a9a42dc0e8a`; merged mobile maintenance content `77b05e5f9334f31850b390f834d3a0c5946ff737` is already contained in the base.
- Required validation: FAIL; fingerprint parity is absent.
- Shared-hunk review: not applicable; `app.json` has no selected/unselected shared hunk.
- Generated-file review: PASS; no generated output, dependency link, environment file, secret, or cache is retained.
- Technical state: candidate.
- User authorization: selected-for-commit; evidence: user confirmed the minimal metadata repair, merge to `Dev`, and TestFlight OTA on 2026-08-09; push/merge confirmation remains commit-SHA-bound.
- Independent review: not run.
- Action conclusion: BLOCKED; this historical OTA attempt is closed because build 26 cannot be reproduced from `Dev`; the separately authorized replacement baseline is tracked by `CRL-20260809-002`.

### Risks / Release Notes

- Risk: a manual runtime override could target a binary whose native/config source is not proven compatible; it is intentionally not used.
- Rollback: no source change remains; keep the `testflight` channel unchanged.
- Sensitive-information review: no secrets, `.env` contents, tokens, credentials, private keys, device logs, production data, or signed URLs are recorded.
- Git state: only this blocked ledger record is uncommitted on the temporary release branch; no app/business configuration change remains.

## CRL-20260808-001 — 维修完工照片本地预览与安全关联（mobile）

- **Status:** candidate; selected-for-commit.
- **Outcome:** 完工照片先持久化为按“任务 + 执行人”归属的本地草稿并立即预览；只有专用动作已保存远端引用且任务回读确认关联后才清理本地文件。
- **Files / Areas:** `src/lib/maintenanceCompletionPhotoDraft.ts`, `src/lib/maintenanceCompletionPhotoDraft.test.ts`, `src/lib/localMediaDrafts.ts`, `src/lib/api.ts`, `src/components/CleaningMediaImage.tsx`, `src/components/CleaningMediaPreview.tsx`, `src/screens/tasks/TaskDetailScreen.tsx`.
- `src/lib/maintenanceCompletionPhotoDraft.ts` — 本地草稿归属、状态与安全清理。
- `src/lib/maintenanceCompletionPhotoDraft.test.ts` — 本地草稿恢复和清理回归。
- **Validation:** `npm run typecheck` and the four targeted Jest suites passed.
- **Risk / dependency:** depends on root CRL-20260808-001/007 and the authenticated media proxy; a pre-existing unassociated remote object without a local draft remains intentionally unavailable.

### Files / Areas

- `src/lib/maintenanceCompletionPhotoDraft.ts`
- `src/lib/maintenanceCompletionPhotoDraft.test.ts`
- `src/lib/localMediaDrafts.ts`
- `src/lib/api.ts`
- `src/components/CleaningMediaImage.tsx`
- `src/components/CleaningMediaPreview.tsx`
- `src/screens/tasks/TaskDetailScreen.tsx`
- `docs/change-release-ledger.md`

## CRL-20260808-002 — 维修提交后的状态收口与完成/未完成按钮等宽（mobile）

- **Status:** candidate; selected-for-commit.
- **Outcome:** 专用回执把当前任务缓存收口为 `pending_review` 并清除执行动作；受派执行人显示“已完成”、其他角色显示“待审核”；完成/未完成两个按钮在宽屏等宽、窄屏满宽。
- **Files / Areas:** `src/screens/tasks/TaskDetailScreen.tsx`, `src/screens/tasks/TaskDetailScreen.test.tsx`, `src/lib/workTasksStore.ts`, `src/lib/workTasksStore.test.ts`, `src/lib/taskVisualTheme.ts`, `src/lib/taskVisualTheme.test.ts`, `src/screens/tabs/TasksScreen.tsx`, `scripts/audit_button_contract.py`.
- **Validation:** `npm run check:ci` passed: ledger audit, typecheck, lint (0 errors / 113 warnings), strict button-contract audit and 53 Jest suites / 256 tests; targeted suite includes the maintenance equal-width control test.
- **Risk / dependency:** depends on root CRL-20260808-002 returning authoritative `status` and `available_actions`; no client-side permission inference or state-machine rewrite.

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx`
- `src/screens/tasks/TaskDetailScreen.test.tsx`
- `src/lib/workTasksStore.ts`
- `src/lib/workTasksStore.test.ts`
- `src/lib/taskVisualTheme.ts`
- `src/lib/taskVisualTheme.test.ts`
- `src/screens/tabs/TasksScreen.tsx`
- `scripts/audit_button_contract.py`

## CRL-20260808-006 — 历史网页维修照片的认证代理展示（mobile）

- **Status:** candidate; selected-for-commit.
- **Outcome:** 历史 `completion_photo_urls` 纳入反馈详情的后照片；`maintenance/` 引用、缩略图和大图都携带当前任务上下文经认证代理读取，不提供浏览器直链。
- **Files / Areas:** `src/lib/cleaningMedia.ts`, `src/lib/cleaningMedia.test.ts`, `src/lib/api.ts`, `src/components/CleaningMediaImage.tsx`, `src/components/CleaningMediaPreview.tsx`, `src/screens/tasks/FeedbackFormScreen.tsx`, `src/screens/tasks/FeedbackFormScreen.test.tsx`.
- **Validation:** targeted private-media tests, typecheck, strict button audit and `npm run check:ci` passed.
- **Risk / dependency:** must ship with root CRL-20260808-006; device and deployed authenticated proxy validation remain outstanding.

### Files / Areas

- `src/lib/cleaningMedia.ts`
- `src/lib/cleaningMedia.test.ts`
- `src/lib/api.ts`
- `src/components/CleaningMediaImage.tsx`
- `src/components/CleaningMediaPreview.tsx`
- `src/screens/tasks/FeedbackFormScreen.tsx`
- `src/screens/tasks/FeedbackFormScreen.test.tsx`

### Release Attempt

#### RA-20260808-mobile-maintenance-01

- Repository: mobile
- Intended action: commit
- Branch: `codex/release-maintenance-20260808-mobile`
- Selected CRLs: `CRL-20260808-001`, `CRL-20260808-002`, `CRL-20260808-006`.
- Base: `origin/Dev@2aef8d392ce0208d412e74bd6034667dcb94e1b9`; fetched at 2026-08-08 23:04:22 AEST.
- Candidate patch SHA-256: `65af759982ea71da466c1fe4302802b97188b6acbf2ce3efb4883c69f3a06235`, from the staged candidate excluding `docs/change-release-ledger.md`.
- Commit SHA: `77b05e5f9334f31850b390f834d3a0c5946ff737` (candidate content commit)
- Dependencies: root RA-20260808-root-maintenance-01 for CRL-20260808-001/002/006.
- Required validation: PASS — `npm run check:ci` passed (ledger audit, typecheck, lint 0 errors / 113 warnings, strict button audit, 53 Jest suites / 256 tests); six targeted suites / 52 tests also passed.
- Shared-hunk review: PASS — the two shared test files are hunk-verified maintenance assertions; all changed source paths belong to selected CRLs.
- Generated-file review: PASS — no dependency link, cache, environment file, token, private media value or build output is selected.
- Independent review: GO — commit-only review accepted exact fingerprint `65af759982ea71da466c1fe4302802b97188b6acbf2ce3efb4883c69f3a06235` after removal of scope collisions and full CI.
- User authorization: selected-for-commit — user confirmation on 2026-08-08.
- Technical state: committed

## CRL-20260807-002 — CI 台账测试无缓存执行（mobile）

- **Status:** committed
- **Updated:** 2026-08-07 Australia/Melbourne
- **Request:** 修复 PR #15 合并前 CI 的非交互质量门失败。
- **Outcome:** 台账审计单测不再在工作树生成 Python 字节码缓存，后续台账覆盖检查不会把该测试产物误判为未登记改动。

### Implementation

- Previous behavior: `test:ledger-range-audit` 会写入 `scripts/__pycache__/`；紧随其后的 `check:ledger` 将该未跟踪文件报告为未覆盖，`npm run check:ci` 失败。
- New behavior: 测试进程以 `PYTHONDONTWRITEBYTECODE=1` 执行，不产生 `.pyc` 文件；实际源文件和台账路径仍由原有审计覆盖。
- Key decisions: 仅调整测试命令的进程环境，不修改审计规则、业务逻辑或 GitHub 工作流。

### Files / Areas

- `package.json` — 修改 `test:ledger-range-audit`，禁止本测试写入 Python 字节码缓存。
- `docs/change-release-ledger.md` — 记录此独立 CI 质量门修复。

### Impact / Dependencies

- API: none.
- Database / migration: none.
- Config / environment: 仅质量命令子进程环境变量；不影响 Expo 运行时。
- Dependencies: none.
- Related units: `CRL-20260807-001`（PR 范围审计兼容）。

### Validation

- `npm run check:ci` — passed: ledger range-audit tests 11/11; working-tree ledger coverage 2/2; TypeScript passed; ESLint 0 errors/111 pre-existing warnings; button contract passed; Jest 51 suites/246 tests passed.
- `python3 scripts/audit_change_release_ledger.py` — passed: 2 changed paths, 2 recorded paths.
- `git diff --check` — passed.

### Release Attempt

#### RA-20260807-mobile-pr15-ci-02

- Repository: `mobile`.
- Selected CRLs: `CRL-20260731-001`, `CRL-20260803-003`, `CRL-20260807-001`, `CRL-20260807-002`.
- Intended action: `push`.
- Branch: `codex/release-blockers-20260807-mobile` (PR #15 to `Dev`).
- Base: `origin/Dev@817b803a88177a8d43b4e02965fffde59e852789`; fetched at 2026-08-07 18:11 AEST.
- Candidate patch SHA-256: `be559e7b25dfcdb4054e37f146f3219fddbed2ab914b68f60cd554c19e801a0c` from the exact `origin/Dev...candidate` content excluding the ledger.
- Commit SHA: `c01d7543cc385d02fe4cb18daa95ed398148fc18`; candidate content commit. The exact audit head is emitted separately by the report command.
- Dependencies: `CRL-20260807-001` must travel with this fix because the quality gate runs its auditor immediately before the coverage audit; previous PR #15 units remain in the same exact range.
- Required validation: PASS; evidence: `npm run check:ci` passed locally (auditor 11/11, TypeScript, ESLint 0 errors, button contract, Jest 51/246, ledger coverage).
- Shared-hunk review: PASS; `package.json` is shared with selected `CRL-20260731-001` and only the test command hunk changed; the selected ledger records are contiguous but independently attributed.
- Generated-file review: PASS; the generated `.pyc` was removed and no generated output, dependency directory, secret, local environment file or cache is selected.
- Technical state: committed.
- User authorization: approved-for-push; evidence: user confirmed the exact mobile PR #15 range ending at `cee2674a59707b0fce400c71f60f96c2854f19fd` on 2026-08-07, limited to pushing this branch; merge, EAS build, TestFlight and OTA publication remain unauthorized.
- Independent review: GO; evidence: 2026-08-07 independent read-only pre-push review accepted `origin/Dev@817b803a88177a8d43b4e02965fffde59e852789...fdb38aaca30760f3a959be5a539edc09366df5e2`, matching `be559e7b…` fingerprint, all 8 selected paths, authorization receipt, shared-hunk, generated-file and sensitive-information checks for push only.
- Action conclusion: GO; blockers: none for pushing this branch. Merge, EAS build, TestFlight and OTA publication remain outside the authorized action.

### Risks / Release Notes

- Risk: 仅防止测试副产物污染工作树；不会掩盖实际未登记的源文件改动。
- Rollback: 恢复该 npm script 的原命令。
- Sensitive-information review: no sensitive files or values involved.
- Git state: candidate content committed at `c01d7543cc385d02fe4cb18daa95ed398148fc18`; push authorized for the exact PR #15 range, pending independent review and final range report.

## CRL-20260807-001 — 移动端 PR 台账范围审计兼容（mobile）

- **Status:** ready
- **Updated:** 2026-08-07 Australia/Melbourne
- **Request:** PR #15 的 “Audit pull request Ledger range” 失败，参数 `--base`、`--head` 被错误要求必须使用 Release Attempt 模式。
- **Outcome:** `--base` 与 `--head` 在非 Release Attempt 模式下执行只读 `base...head` 台账覆盖与空白检查；`--repo`、`--crl` 仍只允许 Release Attempt 模式，避免弱化精确发布审计。

### Files / Areas

- `scripts/audit_change_release_ledger.py` — 新增 PR 范围覆盖审计入口，并保留 Release Attempt 参数边界。
- `scripts/tests/test_audit_change_release_ledger.py` — 覆盖已记录范围通过及未记录路径失败。
- `docs/change-release-ledger.md` — 记录本次 CI 修复。

### Validation / Risks

- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/tests/test_audit_change_release_ledger.py` — passed: 11 tests.
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/audit_change_release_ledger.py --base 817b803a88177a8d43b4e02965fffde59e852789 --head HEAD` — passed: 8 changed / 8 recorded, coverage pass.
- `git diff --check` — passed.
- 此修复只恢复 PR 的路径覆盖审计；它不替代 `--release-report` 的授权、候选 hash、敏感信息或 Release Attempt 审计。

### Release Attempt

#### RA-20260807-mobile-pr15-ci-01

- Repository: `mobile`.
- Selected CRLs: `CRL-20260731-001`, `CRL-20260803-003`, `CRL-20260807-001`.
- Intended action: `push`.
- Branch: `codex/release-blockers-20260807-mobile`.
- Base: `origin/Dev@817b803a88177a8d43b4e02965fffde59e852789`; fetched at 2026-08-07 Australia/Melbourne.
- Candidate patch SHA-256: `d2687376f3b3255fe03d62b63942eced62878b68b7a8bef0b4180af51eb3f923` from the exact staged `origin/Dev...candidate` content excluding the ledger.
- Commit SHA: `7d370ce079fb10f40fc262d2df1bdda9791f6528`; candidate content commit, with the exact audit head emitted separately by the release report.
- Dependencies: prior pushed PR content `ec578d219aea20a8fdc64c7569aa97208fff22a0`, local push-receipt commit `26f6da7cec982fdd3dcca0eb4b5c0867db356a3c`, and this CI compatibility unit travel together on PR #15.
- Required validation: PASS; evidence: 11 auditor regression tests, current PR-range invocation syntax, working-tree ledger coverage, and whitespace check pass. The exact committed PR range will be rerun after the content commit.
- Shared-hunk review: PASS; `scripts/audit_change_release_ledger.py` and its test deliberately update the earlier `CRL-20260803-003` Release Attempt auditor, which is selected in this same PR scope.
- Generated-file review: PASS; no generated output, dependency directory, secret, local environment file or cache is selected.
- Technical state: `committed`.
- User authorization: `approved-for-push`; evidence: user confirmed `codex/release-blockers-20260807-mobile@334893b6f0defd4495c68adf6c0d35a073d354da` on 2026-08-07. No merge, EAS build, TestFlight or OTA publication is authorized.
- Independent review: GO; evidence: 2026-08-07 independent read-only review accepted full PR scope, hash `d2687376f3b3255fe03d62b63942eced62878b68b7a8bef0b4180af51eb3f923`, CI semantics, and sensitive/generated-file review for commit only.
- Action conclusion: NOT VERIFIED for push until the authorization receipt is committed and the exact range audit is rerun.

## CRL-20260731-001 — MZStay 外部 TestFlight OTA 原生基线（mobile）

- **Status:** candidate
- **Updated:** 2026-08-07 Australia/Melbourne
- **Outcome:** 增加 `expo-updates`、`fingerprint` runtime、启动时检查更新，以及 `preview` / `testflight` / `production` channel。外部 TestFlight 用户只有安装新的 iOS 原生基线后才能接收兼容 OTA。

### Files / Areas

- `app.json` — Update URL、fingerprint runtime 与 iOS/Android 基线版本。
- `eas.json` — preview、testflight、production channel 绑定。
- `package.json` — Expo SDK 兼容的 `expo-updates` 依赖。
- `package-lock.json` — `expo-updates` 的锁定解析。
- `docs/eas-update-release-runbook.md` — 基线构建、外部 TestFlight 验证、OTA 与回滚边界。
- `docs/change-release-ledger.md` — 本次候选记录。

### Validation / Risks

- Expo public-config 断言、`npm run typecheck`、`npm test -- --runInBand`（51 suites / 246 tests）和 `npx expo export --platform ios` 均通过；导出仅写入仓库外临时目录。
- EAS iOS build、TestFlight 上传/外部测试、OTA 发布和设备验证均未执行。旧 TestFlight 包不会因此获得 OTA 能力。

## CRL-20260803-003 — 移动端精确 Release Attempt 重建（mobile）

- **Status:** candidate
- **Updated:** 2026-08-07 Australia/Melbourne
- **Outcome:** 不再从混合工作区推断发布范围；此干净候选以最新 `origin/Dev` 为 base，并新增可读、只读的 exact base...head Release Attempt 审计器与回归测试。

### Files / Areas

- `scripts/audit_change_release_ledger.py` — 覆盖审计之外的精确 Release Attempt 报告、范围、hash、敏感信息与字段契约检查。
- `scripts/tests/test_audit_change_release_ledger.py` — 审计器的成功、字段缺失、范围和敏感风险回归测试。
- `docs/change-release-ledger.md` — 本次候选与精确 Release Attempt 记录。

### Validation / Risks

- `python3 scripts/tests/test_audit_change_release_ledger.py`（9 tests）及 `python3 -m py_compile ...` 均通过。
- 提交前只能验证审计器可解析候选元数据；提交后才可使用实际 `base...head` 检查该精确范围。

### Release Attempt

#### RA-20260807-mobile-blockers-01

- Repository: `mobile`.
- Selected CRLs: `CRL-20260731-001`, `CRL-20260803-003`.
- Intended action: `push`.
- Branch: `codex/release-blockers-20260807-mobile`.
- Base: `origin/Dev@817b803a88177a8d43b4e02965fffde59e852789`; fetched at 2026-08-07 Australia/Melbourne.
- Candidate patch SHA-256: `d9d2629fddb8b909cf9bae0dcb7d804ae785e8ae0078d8a9fefe69b1a649705b` from the exact staged non-ledger candidate content.
- Commit SHA: `ec578d219aea20a8fdc64c7569aa97208fff22a0`; candidate content commit, with the exact audit head emitted separately by the release report.
- Required validation: PASS; evidence: ledger audit 8/8、Expo public-config assertions、`git diff --cached --check`、`npm run typecheck`、`npm test -- --runInBand`（51 suites / 246 tests）、`npx expo export --platform ios`、auditor 9 tests 及 Python compile 均通过；导出只落在仓库外临时目录。
- Dependencies: OTA configuration/runbook、exact Release Attempt auditor and its test plus this ledger; no current `CRL-20260806-001` feedback-capability code is present or claimed.
- Shared-hunk review: PASS — the manifest, lockfile and EAS configuration are deliberately one OTA-baseline unit; no hunk is borrowed from the rejected 59-file candidate.
- Generated-file review: PASS — no generated output, cache, dependency directory, secret or local environment file is staged; the successful export directory is outside the repository.
- User authorization: `approved-for-push`; evidence: the user replied “推送” on 2026-08-07 after `codex/release-blockers-20260807-mobile` and candidate content commit `ec578d219aea20a8fdc64c7569aa97208fff22a0` were presented. EAS, TestFlight, OTA and production actions remain separately unauthorized.
- Independent review: GO; evidence: 2026-08-07 independent read-only review accepted exact hash `d9d2629fddb8b909cf9bae0dcb7d804ae785e8ae0078d8a9fefe69b1a649705b`, all 8 staged paths, validation evidence, and sensitive/generated-file review for commit only.
- Technical state: `pushed`.
- Remote push: `origin/codex/release-blockers-20260807-mobile@1eaf3757f0b62f1009e22dd8e9c778316ae1b0a6`, confirmed by `git ls-remote` on 2026-08-07 Australia/Melbourne.
- Action conclusion: GO for push (completed); not merged to `Dev`, built by EAS, installed through TestFlight, deployed, or published as OTA.

## CRL-20260805-003 — 入住检查退房动作类型保护（mobile）

- **Status:** ready
- **Updated:** 2026-08-05 Australia/Melbourne
- **Request:** 入住检查不得显示“标记已退房”。
- **Outcome:** 客户端隐藏不匹配的旧缓存退房动作；合并卡只在有真实退房来源时保留该动作并提交来源 ID。

### Files / Areas

- `src/lib/workTaskActions.ts` — action display filter.
- `src/screens/tasks/TaskDetailScreen.tsx` — source-ID routing.
- `src/lib/workTaskActions.test.ts` — 入住检查与缓存 action regression.
- `src/screens/tabs/TasksScreen.tsx` — 合并卡退房动作来源 ID routing.
- `src/screens/tabs/TasksScreen.test.tsx` — 客服合并卡退房来源 regression.
- `docs/change-release-ledger.md` — 记录本单元。

### Impact / Dependencies

- Related units: root `CRL-20260805-013`.

### Validation

- Passed: `npm run check:ci` (51 suites, 246 tests), `workTaskActions.test.ts`, `TasksScreen.test.tsx`, `audit_change_release_ledger.py`, and `git diff --check`. Existing lint warnings contain no errors.

### Release Attempts

#### RA-20260805-001

- Repository: mobile
- Selected CRLs: `CRL-20260805-001`, `CRL-20260805-002`, `CRL-20260805-003`
- Intended action: commit
- Branch: `codex/release-20260805-all-mobile`
- Base: `origin/Dev@606e2c8911f7e25e28a88759898cc34626d669ab`; fetched at `2026-08-05 20:41:52 +1000`
- Candidate patch SHA-256: `4c4ed26d113c7dcb7f0c16229914c8241c983dbfb0372402cf307c2e14c18d94` (excluding `docs/change-release-ledger.md`)
- Commit SHA: not committed; audit head is emitted by the release report.
- Dependencies: root `CRL-20260805-009`, `CRL-20260805-010`, and `CRL-20260805-013` are selected in the paired independent root candidate; no dependency SHA exists yet.
- Required validation: PASS; mobile `check:ci`, ledger coverage, and whitespace checks passed; lint had existing warnings but no errors.
- Shared-hunk review: PASS; all staged files are covered by the selected mobile CRLs, including the shared ledger.
- Generated-file review: PASS; no build artifacts or local caches are staged.
- Technical state: candidate
- User authorization: selected-for-commit; evidence: 2026-08-05 instruction “我要全部提交 推送到Dev分支”.
- Independent review: NOT VERIFIED; evidence: pending read-only release review.
- Action conclusion: NOT VERIFIED; blockers: independent review has not yet issued a commit verdict.

- 2026-08-06 update: independent review of RA-20260805-001 was NO-GO because the list action discarded the merged checkout `source_id`; the ID now flows through the action handler and is covered by a regression test in RA-20260805-002.

#### RA-20260805-002

- Repository: mobile
- Selected CRLs: `CRL-20260805-001`, `CRL-20260805-002`, `CRL-20260805-003`
- Intended action: commit
- Branch: `codex/release-20260805-all-mobile`
- Base: `origin/Dev@606e2c8911f7e25e28a88759898cc34626d669ab`; fetched at `2026-08-05 20:41:52 +1000`
- Candidate patch SHA-256: `73fe603fbb1b79883fd443a808b0812a693855fdce383098801b36a270171ee1` (excluding `docs/change-release-ledger.md`)
- Commit SHA: not committed; audit head is emitted by the release report.
- Dependencies: paired root RA-20260805-002 covers root `CRL-20260805-009`, `CRL-20260805-010`, and `CRL-20260805-013`; no dependency SHA exists yet.
- Required validation: PASS; remediation and complete `npm run check:ci` passed (51 suites, 245 tests); lint has existing warnings but no errors.
- Shared-hunk review: PASS; all staged files are covered by the selected mobile CRLs, including the shared ledger.
- Generated-file review: PASS; no generated output is staged.
- Technical state: committed
- User authorization: selected-for-commit; evidence: 2026-08-05 instruction “我要全部提交 推送到Dev分支”.
- Independent review: GO; evidence: 2026-08-06 independent read-only review found no P0/P1/P2; GO for commit only.
- Action conclusion: GO; blockers: none for the commit action.

- 2026-08-06 update: independent review of RA-20260805-002 was NO-GO because the customer-service compatibility action discarded a valid merged-card checkout `source_id`; it now retains only the server-confirmed source and is covered by a customer-service request regression in RA-20260805-003.

#### RA-20260805-003

- Repository: mobile
- Selected CRLs: `CRL-20260805-001`, `CRL-20260805-002`, `CRL-20260805-003`
- Intended action: commit
- Branch: `codex/release-20260805-all-mobile`
- Base: `origin/Dev@606e2c8911f7e25e28a88759898cc34626d669ab`; fetched at `2026-08-05 20:41:52 +1000`
- Candidate patch SHA-256: `b814bf269eec292043cf0d5c53c32c63771616c94f4f1f8a9f8e58dab9668112` (excluding `docs/change-release-ledger.md`)
- Commit SHA: `98f01b4c756a1f0cb79d7c89907251e5ddc9ba1f`; candidate content commit.
- Dependencies: paired root RA-20260805-002 covers root `CRL-20260805-009`, `CRL-20260805-010`, and `CRL-20260805-013`; no dependency SHA exists yet.
- Required validation: PASS; complete `npm run check:ci` passed after remediation (51 suites, 246 tests); lint has existing warnings but no errors.
- Shared-hunk review: PASS; `TasksScreen` hunks are owned by selected CRL-002 and CRL-003, and all staged files are within selected CRLs.
- Generated-file review: PASS; no generated output is staged.
- Technical state: committed
- User authorization: selected-for-commit; evidence: 2026-08-05 instruction “我要全部提交 推送到Dev分支”.
- Independent review: GO; evidence: 2026-08-06 independent read-only review found no P0/P1/P2; GO for commit only.
- Action conclusion: GO; blockers: none for the commit action.

### Risks / Release Notes

- Physical device and weak-network verification remain separate. No secrets or production data included.

## CRL-20260805-002 — “全部”管理与“我的”执行入口分流（mobile）

- **Status:** ready
- **Updated:** 2026-08-05 Australia/Melbourne
- **Request:** “全部”进入管理详情，“我的”进入执行详情。
- **Outcome:** 管理详情跳转仅在 `view === 'all'` 使用；“我的”保持既有任务执行导航。

### Files / Areas

- `src/screens/tabs/TasksScreen.tsx` — view-specific navigation gate.
- `src/screens/tabs/TasksScreen.test.tsx` — view-specific navigation regression.
- `docs/change-release-ledger.md` — 记录本单元。

### Impact / Dependencies

- Related units: root `CRL-20260805-010`.

### Validation

- Passed: `npm run check:ci` (51 suites, 244 tests), `TasksScreen.test.tsx`, `audit_change_release_ledger.py`, and `git diff --check`. Existing lint warnings contain no errors.

### Release Attempts

#### RA-20260805-001

- Repository: mobile
- Selected CRLs: `CRL-20260805-001`, `CRL-20260805-002`, `CRL-20260805-003`
- Intended action: commit
- Branch: `codex/release-20260805-all-mobile`
- Base: `origin/Dev@606e2c8911f7e25e28a88759898cc34626d669ab`; fetched at `2026-08-05 20:41:52 +1000`
- Candidate patch SHA-256: `4c4ed26d113c7dcb7f0c16229914c8241c983dbfb0372402cf307c2e14c18d94` (excluding `docs/change-release-ledger.md`)
- Commit SHA: not committed; audit head is emitted by the release report.
- Dependencies: root `CRL-20260805-009`, `CRL-20260805-010`, and `CRL-20260805-013` are selected in the paired independent root candidate; no dependency SHA exists yet.
- Required validation: PASS; mobile `check:ci`, ledger coverage, and whitespace checks passed; lint had existing warnings but no errors.
- Shared-hunk review: PASS; all staged files are covered by the selected mobile CRLs, including the shared ledger.
- Generated-file review: PASS; no build artifacts or local caches are staged.
- Technical state: candidate
- User authorization: selected-for-commit; evidence: 2026-08-05 instruction “我要全部提交 推送到Dev分支”.
- Independent review: NOT VERIFIED; evidence: pending read-only release review.
- Action conclusion: NOT VERIFIED; blockers: independent review has not yet issued a commit verdict.

- 2026-08-06 update: independent review of RA-20260805-001 was NO-GO because the list action discarded the merged checkout `source_id`; the ID now flows through the action handler and is covered by a regression test in RA-20260805-002.

#### RA-20260805-002

- Repository: mobile
- Selected CRLs: `CRL-20260805-001`, `CRL-20260805-002`, `CRL-20260805-003`
- Intended action: commit
- Branch: `codex/release-20260805-all-mobile`
- Base: `origin/Dev@606e2c8911f7e25e28a88759898cc34626d669ab`; fetched at `2026-08-05 20:41:52 +1000`
- Candidate patch SHA-256: `73fe603fbb1b79883fd443a808b0812a693855fdce383098801b36a270171ee1` (excluding `docs/change-release-ledger.md`)
- Commit SHA: not committed; audit head is emitted by the release report.
- Dependencies: paired root RA-20260805-002 covers root `CRL-20260805-009`, `CRL-20260805-010`, and `CRL-20260805-013`; no dependency SHA exists yet.
- Required validation: PASS; remediation and complete `npm run check:ci` passed (51 suites, 245 tests); lint has existing warnings but no errors.
- Shared-hunk review: PASS; all staged files are covered by the selected mobile CRLs, including the shared ledger.
- Generated-file review: PASS; no generated output is staged.
- Technical state: committed
- User authorization: selected-for-commit; evidence: 2026-08-05 instruction “我要全部提交 推送到Dev分支”.
- Independent review: GO; evidence: 2026-08-06 independent read-only review found no P0/P1/P2; GO for commit only.
- Action conclusion: GO; blockers: none for the commit action.

- 2026-08-06 update: independent review of RA-20260805-002 was NO-GO because the customer-service compatibility action discarded a valid merged-card checkout `source_id`; it now retains only the server-confirmed source and is covered by a customer-service request regression in RA-20260805-003.

#### RA-20260805-003

- Repository: mobile
- Selected CRLs: `CRL-20260805-001`, `CRL-20260805-002`, `CRL-20260805-003`
- Intended action: commit
- Branch: `codex/release-20260805-all-mobile`
- Base: `origin/Dev@606e2c8911f7e25e28a88759898cc34626d669ab`; fetched at `2026-08-05 20:41:52 +1000`
- Candidate patch SHA-256: `b814bf269eec292043cf0d5c53c32c63771616c94f4f1f8a9f8e58dab9668112` (excluding `docs/change-release-ledger.md`)
- Commit SHA: `98f01b4c756a1f0cb79d7c89907251e5ddc9ba1f`; candidate content commit.
- Dependencies: paired root RA-20260805-002 covers root `CRL-20260805-009`, `CRL-20260805-010`, and `CRL-20260805-013`; no dependency SHA exists yet.
- Required validation: PASS; complete `npm run check:ci` passed after remediation (51 suites, 246 tests); lint has existing warnings but no errors.
- Shared-hunk review: PASS; `TasksScreen` hunks are owned by selected CRL-002 and CRL-003, and all staged files are within selected CRLs.
- Generated-file review: PASS; no generated output is staged.
- Technical state: candidate
- User authorization: selected-for-commit; evidence: 2026-08-05 instruction “我要全部提交 推送到Dev分支”.
- Independent review: NOT VERIFIED; evidence: remediation requires a new read-only review.
- Action conclusion: NOT VERIFIED; blockers: independent review has not yet issued a commit verdict.

### Risks / Release Notes

- No backend or production-data change.

## CRL-20260805-001 — 检查与补充新增可选阳台照片（mobile）

- **Status:** ready
- **Updated:** 2026-08-05 Australia/Melbourne
- **Request:** 检查面板新增可选阳台照片，最多三张，不能阻止没有阳台的任务提交。
- **Outcome:** 阳台进入既有照片草稿、上传队列和同步回看；验证仍只要求原五个必拍区域。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.tsx` — optional balcony card and state cloning.
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — optional balcony card rendering regression.
- `src/lib/inspectionPanelDraft.ts` — persisted draft support.
- `src/lib/inspectionPanelSubmitQueue.ts` — queue snapshot/media support and optional validation boundary.
- `docs/change-release-ledger.md` — 记录本单元。

### Impact / Dependencies

- Related units: root `CRL-20260805-009`.

### Validation

- Passed: `npm run check:ci` (51 suites, 244 tests), `InspectionPanelScreen.test.tsx`, `inspectionPanelSubmitQueue.test.ts`, `audit_change_release_ledger.py`, and `git diff --check`. Existing lint warnings contain no errors.

### Release Attempts

#### RA-20260805-001

- Repository: mobile
- Selected CRLs: `CRL-20260805-001`, `CRL-20260805-002`, `CRL-20260805-003`
- Intended action: commit
- Branch: `codex/release-20260805-all-mobile`
- Base: `origin/Dev@606e2c8911f7e25e28a88759898cc34626d669ab`; fetched at `2026-08-05 20:41:52 +1000`
- Candidate patch SHA-256: `4c4ed26d113c7dcb7f0c16229914c8241c983dbfb0372402cf307c2e14c18d94` (excluding `docs/change-release-ledger.md`)
- Commit SHA: not committed; audit head is emitted by the release report.
- Dependencies: root `CRL-20260805-009`, `CRL-20260805-010`, and `CRL-20260805-013` are selected in the paired independent root candidate; no dependency SHA exists yet.
- Required validation: PASS; mobile `check:ci`, ledger coverage, and whitespace checks passed; lint had existing warnings but no errors.
- Shared-hunk review: PASS; all staged files are covered by the selected mobile CRLs, including the shared ledger.
- Generated-file review: PASS; no build artifacts or local caches are staged.
- Technical state: candidate
- User authorization: selected-for-commit; evidence: 2026-08-05 instruction “我要全部提交 推送到Dev分支”.
- Independent review: NOT VERIFIED; evidence: pending read-only release review.
- Action conclusion: NOT VERIFIED; blockers: independent review has not yet issued a commit verdict.

- 2026-08-06 update: independent review of RA-20260805-001 was NO-GO because the list action discarded the merged checkout `source_id`; the ID now flows through the action handler and is covered by a regression test in RA-20260805-002.

#### RA-20260805-002

- Repository: mobile
- Selected CRLs: `CRL-20260805-001`, `CRL-20260805-002`, `CRL-20260805-003`
- Intended action: commit
- Branch: `codex/release-20260805-all-mobile`
- Base: `origin/Dev@606e2c8911f7e25e28a88759898cc34626d669ab`; fetched at `2026-08-05 20:41:52 +1000`
- Candidate patch SHA-256: `73fe603fbb1b79883fd443a808b0812a693855fdce383098801b36a270171ee1` (excluding `docs/change-release-ledger.md`)
- Commit SHA: not committed; audit head is emitted by the release report.
- Dependencies: paired root RA-20260805-002 covers root `CRL-20260805-009`, `CRL-20260805-010`, and `CRL-20260805-013`; no dependency SHA exists yet.
- Required validation: PASS; remediation and complete `npm run check:ci` passed (51 suites, 245 tests); lint has existing warnings but no errors.
- Shared-hunk review: PASS; all staged files are covered by the selected mobile CRLs, including the shared ledger.
- Generated-file review: PASS; no generated output is staged.
- Technical state: candidate
- User authorization: selected-for-commit; evidence: 2026-08-05 instruction “我要全部提交 推送到Dev分支”.
- Independent review: NOT VERIFIED; evidence: remediation requires a new read-only review.
- Action conclusion: NOT VERIFIED; blockers: independent review has not yet issued a commit verdict.

- 2026-08-06 update: independent review of RA-20260805-002 was NO-GO because the customer-service compatibility action discarded a valid merged-card checkout `source_id`; it now retains only the server-confirmed source and is covered by a customer-service request regression in RA-20260805-003.

#### RA-20260805-003

- Repository: mobile
- Selected CRLs: `CRL-20260805-001`, `CRL-20260805-002`, `CRL-20260805-003`
- Intended action: commit
- Branch: `codex/release-20260805-all-mobile`
- Base: `origin/Dev@606e2c8911f7e25e28a88759898cc34626d669ab`; fetched at `2026-08-05 20:41:52 +1000`
- Candidate patch SHA-256: `b814bf269eec292043cf0d5c53c32c63771616c94f4f1f8a9f8e58dab9668112` (excluding `docs/change-release-ledger.md`)
- Commit SHA: `98f01b4c756a1f0cb79d7c89907251e5ddc9ba1f`; candidate content commit.
- Dependencies: paired root RA-20260805-002 covers root `CRL-20260805-009`, `CRL-20260805-010`, and `CRL-20260805-013`; no dependency SHA exists yet.
- Required validation: PASS; complete `npm run check:ci` passed after remediation (51 suites, 246 tests); lint has existing warnings but no errors.
- Shared-hunk review: PASS; `TasksScreen` hunks are owned by selected CRL-002 and CRL-003, and all staged files are within selected CRLs.
- Generated-file review: PASS; no generated output is staged.
- Technical state: candidate
- User authorization: selected-for-commit; evidence: 2026-08-05 instruction “我要全部提交 推送到Dev分支”.
- Independent review: NOT VERIFIED; evidence: remediation requires a new read-only review.
- Action conclusion: NOT VERIFIED; blockers: independent review has not yet issued a commit verdict.

### Risks / Release Notes

- No property attribute is inferred; inspectors choose whether a balcony photo exists. No secrets or production data included.

## CRL-20260805-006 — 钥匙照片异步测试并行 CI 时限

- **Status:** candidate
- **Updated:** 2026-08-05 Australia/Melbourne
- **Request:** 修复 GitHub 并行完整 Jest 中，钥匙照片入队、同步和任务刷新测试超过默认 5 秒而超时的问题。
- **Outcome:** 仅该异步 UI 测试拥有明确的 15 秒执行上限；它仍必须验证入队、同步和任务投影刷新，生产上传、离线队列、任务状态及全局 Jest 超时均不变。

### Implementation

- **Previous behavior:** 同一测试在串行本地验证通过，但 CI 并行运行 51 个测试套件时可能超过 Jest 默认 5 秒，导致 Full Regression 失败。
- **New behavior:** 用例使用 15 秒的局部时限，以容纳 CI worker 调度；断言和 `waitFor` 行为不变，超时以外的任何业务行为失败仍会失败。
- **Key decisions:** 不改产品代码、不增加重试、不修改 Jest 全局配置；只针对已从 CI 日志确认的单个异步 UI 用例。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.test.tsx` — 为钥匙照片队列/刷新测试设置局部 15 秒上限。
- `docs/change-release-ledger.md` — 记录本移动端 CI 稳定性修复。

### Impact / Dependencies

- API / database / migration / dependencies: none.
- Downstream CI consumer: root PR #286 consumes this test only after this mobile candidate is merged to `Dev`; this is not a source-code or package dependency.
- Related unit: root `CRL-20260805-006` independently eliminates Fast Regression's Python-cache false positive.

### Validation

- CI evidence before edit: Root Quality Gate run #67 checked out `mobile Dev@a6e4fbe` and failed only this test at Jest's default 5-second ceiling; 50 suites / 242 tests passed.
- `npm test -- src/screens/tasks/TaskDetailScreen.test.tsx` — passed in normal Jest worker mode: 1 suite / 26 tests; protected case completed in 3.347 seconds.
- `npm test` — passed in normal parallel Jest mode: 51 suites / 243 tests in 7.439 seconds. Jest emitted its pre-existing worker graceful-exit warning after success; no test failed.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 111 existing warnings.
- `npm run check:ci` — passed: ledger-range audit, ledger audit, typecheck, lint, button audit, fast tests and serial full Jest; 51 suites / 243 tests.
- `python3 scripts/audit_change_release_ledger.py` — passed: 2 changed paths / 2 recorded paths.
- `git diff --check` — passed.

### Release Attempts

#### RA-20260805-mobile-key-timeout-01

- Repository: `mobile`
- Selected CRLs: `CRL-20260805-006`
- Intended action: `commit`
- Branch: `codex/ci-mobile-timeout-20260805`
- Base: `origin/Dev@a6e4fbed79f2071a31faaeee04fd845e8320ee5a`; fetched and read back on 2026-08-05 Australia/Melbourne.
- Candidate patch SHA-256: `4a562d8d645b9a64d5a73fb6a751c17b70c452e3308bdd4784fcb6fcfc8c0471` (staged implementation diff excluding `docs/change-release-ledger.md`).
- Commit SHA: `c2d4e5401bd77db4aec3c71b11e137353fda15f4`; candidate content commit for this exact implementation range.
- Dependencies: none; root PR #286 is a downstream CI consumer after a future merge to mobile `Dev`, not a prerequisite for this candidate.
- Required validation: PASS — normal-worker targeted Jest, normal parallel full Jest 51/243, typecheck, lint 0 errors, local ledger audit and whitespace check.
- Shared-hunk review: PASS — the test-file timeout and ledger entry are exclusive to this CI repair.
- Generated-file review: not applicable — no generated files selected.
- Technical state: `committed`
- User authorization: `selected-for-commit`; evidence: user explicitly specified the single-test 15-second ceiling on 2026-08-05 Australia/Melbourne.
- Independent review: GO for commit — independent read-only review verified the exact staged test/ledger scope, fingerprint, `check:ci` evidence and no P0/P1/P2 finding.
- Action conclusion: `GO` for commit completed; no push, PR merge, deployment or production action is authorized.

### Risks / Release Notes

- 15 秒是测试执行上限，不是产品重试或用户可见等待时间；测试仍验证同一三项真实副作用。
- Feature regression registry: unchanged — no product workflow, permission, status transition or user-visible behavior is altered.
- Sensitive-information review: no secrets, `.env` values, tokens, credentials, database URLs, sensitive logs or local caches are selected.

## CRL-20260805-005 — 钥匙照片同步回归测试稳定性修复

- **Status:** candidate
- **Updated:** 2026-08-05 Australia/Melbourne
- **Request:** 修复 root PR 的 Fast/Full Regression 在检出 mobile `Dev` 后，`TaskDetailScreen` 钥匙照片测试偶发超过 Jest 默认 5 秒而失败的问题。
- **Outcome:** 测试直接验证上传按钮触发的入队、队列同步和任务投影刷新，不再轮询仅用于用户反馈的弹窗调用；生产端钥匙照片上传、离线队列和任务状态逻辑均不改动。

### Implementation

- **Previous behavior:** 用例在首屏异步加载后依次等待按钮、任意弹窗和任务刷新；弹窗不是该行为的核心证据，多个轮询在 CI 资源紧张时使测试接近默认超时。
- **New behavior:** 在按钮已显示后清除首屏加载的 mock 调用，再在同一受控等待中断言本次操作已入队、启动同步，并使用当前登录人与范围刷新任务投影。
- **Key decisions:** 不扩大 Jest 全局/测试超时；不改变 `TaskDetailScreen`、相机权限、上传队列或业务状态，仅提高测试的确定性与断言质量。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.test.tsx` — 将钥匙照片测试绑定到实际异步副作用，并消除与业务无关的 Alert 轮询。
- `docs/change-release-ledger.md` — 记录本移动端 CI 测试修复。

### Impact / Dependencies

- API / database / migration / dependencies: none.
- Consumer: root `Dev` 的 Fast/Full Regression 检出 mobile `Dev` 后运行此测试；此修复须先经 mobile PR 合入 `Dev`，root #286 才能从该失败根因恢复。

### Validation

- Pre-change reproduction: 本地完整测试文件通过但耗时 4.839 秒，首个用例耗时 3.2 秒，距离 Jest 单例默认 5 秒上限过近；CI 已记录同一用例实际超时。
- `npm test -- --runInBand src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite / 26 tests in 1.751 seconds; repaired test 425 ms.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 111 existing warnings.
- `npm run check:buttons` — passed: no suspicious hard-coded dimensions; 22 documented legacy exceptions remain.
- `npm run test:fast` — passed: 3 suites / 13 tests.
- `npm test -- --runInBand` — passed: 51 suites / 243 tests in 15.013 seconds.
- `python3 scripts/audit_change_release_ledger.py` — passed: 2 changed paths / 2 recorded paths.
- `git diff --check` — passed.

### Release Attempts

#### RA-20260805-mobile-ci-key-upload-01

- Repository: `mobile`
- Selected CRLs: `CRL-20260805-005`
- Intended action: `commit`
- Branch: `codex/ci-mobile-key-upload-test-20260805`
- Base: `origin/Dev@f9a927d1231a7302db989ad90b7aed1cbebb5683`; fetched and read back on 2026-08-05 Australia/Melbourne.
- Candidate patch SHA-256: `d359b444d73a9473ffd86ec64402384b102478100f4ec6b31a3a97c416791ffb` (staged implementation diff excluding `docs/change-release-ledger.md`).
- Commit SHA: `ba31af7`; candidate content commit for this exact implementation range.
- Dependencies: none. Root `CRL-20260805-005` consumes this fix only after this independent mobile candidate is merged to `Dev`.
- Required validation: PASS — targeted 26 tests, typecheck, lint 0 errors / 111 existing warnings, button audit, fast tests 13/13, and full Jest 51 suites / 243 tests all passed.
- Shared-hunk review: PASS — the test file and ledger entry are exclusive to this CI repair.
- Generated-file review: not applicable — no generated files selected.
- Technical state: `committed`
- User authorization: `selected-for-commit`; evidence: user explicitly instructed execution of this two-repository repair on 2026-08-05 Australia/Melbourne.
- Independent review: GO for commit — independent read-only recheck confirmed the exact two staged paths, candidate fingerprint, Release Attempt metadata and no P0/P1 finding.
- Action conclusion: `GO` for commit completed; no push, PR merge, deployment, or production action is authorized.

### Risks / Release Notes

- 测试仍会在入队、同步或任务刷新任一环节缺失时失败；此变更不掩盖真实产品错误。
- Sensitive-information review: no secrets, `.env` values, tokens, credentials, database URLs, sensitive logs or local caches are included.

## CRL-20260731-008 — 管理端清洁照片多图展示与重试

- **Status:** ready
- **Updated:** 2026-07-31 Australia/Melbourne
- **ID allocation:** 2026-07-31 Australia/Melbourne — 从 `CRL-20260731-001` 重编号为 `CRL-20260731-008`，与根仓库媒体单元保持配对；范围、验证与发布状态不变。
- **Request:** 管理端清洁任务只显示第一张照片，其余照片灰色或不可见。
- **Outcome:** 管理端按全部客厅照片引用展示，而非只读历史单值字段；每张任务/补品照片使用现有受控预览组件，加载失败时可在当前页重试，且不暴露存储错误细节。

### Files / Areas

- `src/lib/api.ts` — modified: 接收清洁补品接口返回的多张客厅照片。
- `src/lib/managerDailyTaskPhotos.ts` — modified: 归并新旧客厅照片字段并稳定去重。
- `src/lib/managerDailyTaskPhotos.test.ts` — added: 覆盖多图、新旧兼容和去重。
- `src/screens/tasks/ManagerDailyTaskScreen.tsx` — modified: 展示所有客厅照片，并给照片块接入现有失败反馈及重试。
- `docs/change-release-ledger.md` — modified: 记录本移动端独立发布单元。

### Impact / Dependencies

- API: 依赖根仓库 `CRL-20260731-008` 的多图读取和受控照片代理。
- Database / migration / dependencies: none.
- Related unit: root repository `CRL-20260731-008`。

### Validation

- `npm test -- --runInBand --no-cache src/lib/managerDailyTaskPhotos.test.ts src/screens/tasks/ManagerDailyTaskScreen.test.ts` — passed: 2 suites / 6 tests.
- `npm run check:full` — passed: ledger audit, typecheck, button audit, lint 0 errors / 111 existing warnings, and full Jest 51 suites / 243 tests.
- `git diff --check` and `python3 scripts/audit_change_release_ledger.py` — passed: 5 changed files / 5 recorded files.
- Independent review — paired root CRL-20260731-008 inventory-manager route-entry P1 was corrected and second independent read-only review returned GO with no P0/P1. Non-blocking P2: this mobile candidate has helper-level multi-photo coverage, while screen-level grid/retry rendering remains partial.

### Risks / Release Notes

- Risk: 源存储对象已缺失时，客户端只能显示可重试的失败状态；对象恢复仍由独立的生产恢复单元处理。
- Rollback: 恢复单图展示和原有图片组件。
- Sensitive-information review: no secrets, tokens, credentials, database URLs, or production media references are recorded.
- Git state: isolated worktree, approved for exact stage, commit, and paired root/mobile push; no deployment or production action.

## CRL-20260730-001 — 稳定任务页异步 UI 回归测试

- **Status:** pushed
- **Updated:** 2026-07-30 Australia/Melbourne
- **Request:** 在不降低 mobile `check:fast`、`check:full` 或 `check:ci` 质量门槛的前提下，修复 CI 中两个移动端业务屏幕测试的失败。
- **Outcome:** 任务页的既有折叠、展开和复制反馈断言保持不变；仅为完整异步 UI 场景显式设置 10 秒测试上限，避免 `--detectOpenHandles` 或较慢 CI 因 Jest 默认 5 秒而误报。该测试级 UI 稳定性不直接对应现有 FR，页面、API、权限、任务数据和质量脚本不变。

### Files / Areas

- `src/screens/tabs/TasksScreen.test.tsx` — modified: 保留默认收起、展开详情和复制反馈断言，设置受控的异步测试上限。
- `docs/change-release-ledger.md` — modified: 记录本独立 P2 测试稳定性单元。

### Impact / Dependencies

- API / database / migration / dependencies: none.
- Related FR / CRL: no existing FR directly covers this collapsed Wi-Fi/detail test; Registry is intentionally unchanged. Related test-history CRL: `CRL-20260720-006`.
- Quality commands: test remains part of full Jest, which remains invoked by `check:full` and `check:ci`; Fast and CI command definitions are not changed.

### Validation

- Passed before edit: targeted and full Jest both pass normally; targeted `--detectOpenHandles` reproduces the previous 5-second timeout.
- Passed: `npm test -- --runInBand --no-cache --detectOpenHandles src/screens/tabs/TasksScreen.test.tsx` — 24 tests passed; the protected scenario completed in 5.901 seconds without changing its business assertions.
- Passed: `npm test -- --runInBand --no-cache src/screens/tabs/TasksScreen.test.tsx src/screens/tasks/InspectionPanelScreen.test.tsx` — 2 suites / 34 tests.
- Passed: `npm run check:fast`; `npm run check:full`; `npm run check:ci` — Fast includes Ledger/typecheck/lint/button/contract tests; Full and CI each completed 50 suites / 242 tests. Lint remains 0 errors / 111 pre-existing warnings.
- Passed: mobile Ledger audit (3 changed / 3 recorded), root `python3 scripts/audit_feature_regression_registry.py` (8 FRs / 90 mappings), and `git diff --check`.
- Passed: independent read-only review — GO; no P0/P1/P2 after FR scope correction. GitHub PR #7 (`codex/governance-ledger-mobile-20260729` → `Dev`) is open and unmerged; `Mobile quality` run #8 passed its Ledger-range audit and non-interactive quality gate.

### Risks / Release Notes

- The 10-second ceiling is a test-runner allowance, not a retry or product behavior change; a real assertion failure still fails.
- Sensitive-information review: no secrets, production data, API calls, or deployment configuration.
- Git state: pushed to `origin/codex/governance-ledger-mobile-20260729` at `eb8c853fd785f153d799185584524825a18a0a17`; GitHub PR #7 to `Dev` is open and unmerged. No deployment or force push.

## CRL-20260730-002 — 稳定检查问题照片追加重试测试

- **Status:** pushed
- **Updated:** 2026-07-30 Australia/Melbourne
- **Request:** 在不降低 mobile `check:fast`、`check:full` 或 `check:ci` 质量门槛的前提下，修复 CI 中两个移动端业务屏幕测试的失败。
- **Outcome:** FR-005 的检查后问题照片追加断言保持不变；第二次异步追加仍须成功、且不得重新上传已确认照片。仅将该等待窗口设为 5 秒并将该测试总上限设为 10 秒，以容纳慢速 CI mock 调度。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.test.tsx` — modified: 保留首次业务保存失败、二次追加成功、上传仅一次的断言，设置受控的异步等待上限。
- `docs/change-release-ledger.md` — modified: 记录本独立 P2 测试稳定性单元。

### Impact / Dependencies

- API / database / migration / dependencies: none.
- Related FR / CRL: root `FR-005`; `CRL-20260728-001`.
- Quality commands: test remains part of full Jest, which remains invoked by `check:full` and `check:ci`; Fast and CI command definitions are not changed.

### Validation

- Passed before edit: targeted and full Jest both pass normally; remote CI failure showed the final default 1-second `waitFor` did not observe the second mocked append in time.
- Passed: `npm test -- --runInBand --no-cache --detectOpenHandles src/screens/tasks/InspectionPanelScreen.test.tsx` — 10 tests passed; the retry/no-duplicate-upload scenario completed in 1.252 seconds.
- Passed: `npm test -- --runInBand --no-cache src/screens/tabs/TasksScreen.test.tsx src/screens/tasks/InspectionPanelScreen.test.tsx` — 2 suites / 34 tests.
- Passed: `npm run check:fast`; `npm run check:full`; `npm run check:ci` — Fast includes Ledger/typecheck/lint/button/contract tests; Full and CI each completed 50 suites / 242 tests. Lint remains 0 errors / 111 pre-existing warnings.
- Passed: mobile Ledger audit (3 changed / 3 recorded), root `python3 scripts/audit_feature_regression_registry.py` (8 FRs / 90 mappings), and `git diff --check`.
- Passed: independent read-only review — GO; no P0/P1/P2 after FR scope correction. GitHub PR #7 (`codex/governance-ledger-mobile-20260729` → `Dev`) is open and unmerged; `Mobile quality` run #8 passed its Ledger-range audit and non-interactive quality gate.

### Risks / Release Notes

- The 5-second wait and 10-second ceiling preserve the exact retry/no-duplicate-upload invariant; they do not add retries, alter API calls, or suppress assertion failures.
- Sensitive-information review: no secrets, production data, API calls, or deployment configuration.
- Git state: pushed to `origin/codex/governance-ledger-mobile-20260729` at `eb8c853fd785f153d799185584524825a18a0a17`; GitHub PR #7 to `Dev` is open and unmerged. No deployment or force push.

## CRL-20260729-004 — 移动端 PR 精确范围 Ledger 审计

- **Status:** in-progress
- **Updated:** 2026-07-29 Australia/Melbourne
- **Request:** 修复独立移动端仓库的 PR 范围 Ledger 审计：精确 base/head、三点 diff、whitespace 检查和无回退失败语义。
- **Outcome:** 移动端 Ledger 审计支持 `--base/--head` 严格范围；CI 在 PR 中完整 fetch 后传入 GitHub payload 的两端 SHA。审计在 ref 缺失、fetch 不完整、Git diff 错误或 whitespace 问题时非零退出，并将 rename 的旧/新路径及删除路径纳入 Ledger 覆盖。

### Files / Areas

- `scripts/audit_change_release_ledger.py` — modified: 增加严格范围解析、三点 diff、rename/delete 与 whitespace 检查。
- `scripts/tests/test_audit_change_release_ledger.py` — added: 覆盖未登记已提交文件、错误 SHA、rename/delete、detached HEAD 与 whitespace 失败。
- `package.json` — modified: Ledger 范围回归测试进入 Fast。
- `.github/workflows/quality.yml` — modified: PR workflow 使用精确 base/head 并启用完整 fetch。
- `docs/change-release-ledger.md` — modified: 记录本治理单元。

### Impact / Dependencies

- API / database / migration / dependencies: none.
- Related units: root `CRL-20260729-012`; 两端保持相同失败语义，避免根/移动端 PR 审计范围不一致。

### Validation

- Passed: `npm run test:ledger-range-audit` — 5 tests cover an unregistered committed file, invalid SHA without a zero-change fallback, rename/delete coverage, detached HEAD, and `git diff --check` whitespace failure.
- Passed: `python3 scripts/audit_change_release_ledger.py` (5 changed / 5 recorded), Ruby YAML parse for `.github/workflows/quality.yml`, static confirmation that the PR workflow passes `github.event.pull_request.base.sha` and `.head.sha` after `fetch-depth: 0`, and `git diff --check`.
- Passed: a second independent read-only review found no P0/P1, reran the 5 range regressions, Ledger coverage, YAML parse and diff checks, and confirmed no business logic, secret, production-write or deployment surface.
- Pending: a GitHub PR run proving the exact payload SHA behavior. `npm run check:fast` is not run in this fresh worktree because dependencies have not been installed; installing them requires the repository's explicit permission gate.
- Not run: production API、数据库写入、外部同步、EAS/native 或业务功能测试；均不属于本治理修正。

### Risks / Release Notes

- 缺失或不可解析的 base/head 故意失败，不会降级为 `Changed files: 0`。
- Rename 要求同时记录旧路径和新路径；删除文件也必须在 Ledger 中出现。
- Sensitive-information review: no secrets, `.env` values, tokens, cookies, passwords, database URLs, private keys, production data, or sensitive logs are added.
- Git state: governance-only commit `e3cad7b144adf499adef16fe9e7a23779c3d4f49` is pushed to `origin/codex/governance-ledger-mobile-20260729`; it is not merged into `Dev`/`main` and nothing is deployed.

+## CRL-20260729-001 — 移动端质量防护独立基线
45:## CRL-20260725-023 — 普通清洁员隐藏挂钥匙视频
87:## CRL-20260725-021 — 修复检查与补品保存的超长幂等 ID失败
129:## CRL-20260725-020 — 检查页补品加载态与读取失败防止误判为空
171:## CRL-20260725-019 — 检查照片本机就绪后才允许视频并支持客人到达豁免
217:## CRL-20260725-018 — 检查人员补充项新增入口区分本次与下次退房
258:## CRL-20260725-017 — 修复退房标记覆盖清洁与检查进行状态
303:## CRL-20260725-016 — 检查人员任务同步显示客服标记的退房状态
# Change Release Ledger

## CRL-20260729-003 — 移动端质量命令层级

- **Status:** pushed
- **Updated:** 2026-07-29 Australia/Melbourne
- **Request:** Phase 2：建立移动端 `check:fast`、`check:full`、`check:ci`、`check:release` 的稳定语义，并与根仓库质量命令兼容。
- **Outcome:** 移动端 Fast 运行 Ledger、typecheck、lint、严格按钮审计和三项高价值 action/store/status Jest；Full 直接继承 Fast 后执行全量 Jest；CI 非交互调用 Full；Release 复用 Full，不擅自执行 EAS、真机、migration 或生产 smoke。

### Files / Areas

- `package.json` — modified: 新增高价值 Fast Jest 和四层质量入口。
- `.github/workflows/quality.yml` — modified: 明确 workflow 调用非交互质量入口。
- `docs/change-release-ledger.md` — modified: 记录本治理单元。

### Impact / Dependencies

- API / database / migration / dependencies: none.
- Cross-repository dependency: 根 CRL-20260729-011 调用本仓库的 `check:fast` / `check:full`；两个 CRL 必须一同发布，避免根 CI checkout 到尚未具备新命令的移动端 `Dev`。
- Related units: 根 CRL-20260729-009、CRL-20260729-010、CRL-20260729-011。

### Validation

- Passed: package command graph confirms `check:full` directly calls `check:fast`, while `check:ci` and `check:release` call Full; Ruby YAML parse for `.github/workflows/quality.yml` and `git diff --check` passed.
- Passed: `npm run check:release` — Fast passed Ledger audit (3/3), typecheck, lint (0 errors / 111 existing warnings), strict button audit (22 documented legacy exceptions), and selected action/store/status Jest (3 suites / 13 tests); Full then passed Jest (50 suites / 242 tests).
- Passed: `npm run check:ci` — the same non-interactive Full path passed.
- Passed: independent read-only release review returned GO with no P0/P1, no business/lockfile/generated-file/secret mixing, and no production-write path.
- Passed after code commit `5622c800939ea2164aab9ee73a7b4bfeee3f871d`: the nested new mobile worktree used its own fresh `npm ci` result and `npm run check:ci` passed (Fast 3 suites / 13 tests; Full Jest 50 suites / 242 tests; Ledger audit began at 0 changed files / 0 recorded files). Jest retained its existing asynchronous-handle exit notice but returned exit code 0.

### Risks / Release Notes

- Risk: Fast Jest 只覆盖 action/store/status 的高价值纯客户端规则，不代替全量 Jest、真机、模拟器、EAS/native、相机/弱网或通知点击验证。
- Release order: 先推送本条 CRL-20260729-003，再推送根 CRL-20260729-011；两者不可拆分，避免根 CI checkout 到尚无新 Fast 命令的移动端 `Dev`。
- Remote rollout: 本条移动端候选已先以非 force 快进从 `a946150c8760a86eef2cd362109eac653680d4c7` 推送至 `33915d050aab68f10d684cfe657c7a7474806d2c`，确认本地与 `origin/Dev` 为 ahead 0 / behind 0；根仓库 CRL-20260729-011 随后从 `90c6e553da816f43e7843f0e4fb6592a84911fd3` 非 force 快进至 `edd8056f0abc0fa5ce70ca575e6f73d40ae1be4c`，同样已确认 ahead 0 / behind 0。
- Sensitive-information review: no secrets, `.env` values, tokens, cookies, passwords, database URLs, private keys, production data, or sensitive logs are added.
- Dependency audit note: fresh `npm ci` reported 30 existing audit advisories; no dependency, lockfile or audit-fix change was made.
- Git state: code commit `5622c800939ea2164aab9ee73a7b4bfeee3f871d` and its initial documentation receipt `33915d050aab68f10d684cfe657c7a7474806d2c` are pushed to `origin/Dev` from isolated `codex/phase2-mobile-quality-command-layers`; this final remote-status receipt is documentation-only and awaits its own reviewed push.

## CRL-20260729-001 — 移动端质量防护独立基线

- **Status:** pushed
- **Updated:** 2026-07-29 Australia/Melbourne
- **Request:** 固化独立移动端仓库的 Agent 规则、CI、质量入口、按钮审计和台账审计，使干净 clone/worktree 不依赖父仓库未提交文件。
- **Outcome:** 移动端拥有自己的 `AGENTS.md`、Node 版本、GitHub Actions 质量 workflow、`check:ci`、按钮审计和 Ledger 审计；干净候选 worktree 可独立执行完整质量命令。跨仓库功能仍需引用根仓库 FR/CRL 并等待后续精确组合验证。

### Implementation

- Previous behavior: 本地 `check:ci` 和 workflow 依赖未提交文件；按钮审计从父仓库 `.codex` 路径读取；独立移动端仓库没有 Agent 规则或自身 Ledger 审计。
- New behavior: 所有运行时质量脚本位于移动端仓库；`check:ci` 先执行本仓库 Ledger 审计，再执行 typecheck、lint、严格按钮审计和非交互 Jest；Agent 规则明确真机、模拟器、EAS/native 与自动测试的证据边界。按钮审计列出 22 条路径/样式/属性/数值精确、且当前源码仍命中的既有例外，其中 4 条是本候选针对当前 `Dev` 复核的布局/视觉例外：两个 44pt `AppButton` 的 `minWidth: 0` 均分布局、一个基础 `minHeight: 44` 按钮的等宽布局，以及一个 44×44 `AppIconButton` 外层中的 40×40 视觉框。`--strict` 只阻断未登记的新尺寸；22 条例外是待迁移/设备验证的已知债务，不构成完整 44pt 合规证明。
- Key decisions: 不修改应用逻辑、版本号、依赖或锁文件；`package.json` 只选择质量 scripts 的 hunk，候选基线继续使用已提交的 `version: 1.0.23`，主工作区另有的 `1.0.25` 版本改动明确排除。Phase 2 才拆分并统一 `check:fast`、`check:full`、`check:release` 语义。

### Files / Areas

- `AGENTS.md` — added: 独立移动端 Agent、安全、跨仓库和验证规则。
- `.github/workflows/quality.yml` — added: locked install 后运行非交互质量门。
- `.nvmrc` — added: 固定 CI Node `20.19.4`。
- `package.json` — modified: 仅 quality scripts hunk 增加本地 Ledger/按钮审计并将其接入 `check:ci`。
- `scripts/audit_change_release_ledger.py` — added: 审计独立移动端仓库的当前 Git 变更路径是否在本地 ledger 记录。
- `scripts/audit_button_contract.py` — added: 移动端按钮尺寸静态审计的唯一运行时来源。
- `docs/change-release-ledger.md` — modified: 记录本治理单元，并与旧的未完成质量门禁单元澄清归属。

### Impact / Dependencies

- API / database / migration / dependencies: none.
- Config / environment: CI 只使用 lockfile `npm ci` 和 Node `20.19.4`，不需要 production secret。
- Related units: 根仓库 `CRL-20260729-009`、`CRL-20260729-010`；已有 `CRL-20260720-006` 中的业务屏幕测试和安全区改动继续独立，不随本单元选择性发布。

### Validation

- Passed in the clean mobile candidate worktree before stale-exception cleanup: `npm ci`; `npm run check:ci` (ledger audit 7/7, typecheck, lint 0 errors / 111 existing warnings, strict button audit with 57 documented legacy exceptions, Jest 50 suites / 242 tests); `git diff --check`; and Ruby YAML parse for `.github/workflows/quality.yml`. The 35 stale exceptions were then removed; a final full rerun is pending.
- Passed after stale-exception cleanup: source scan found 22 configured / 22 current matches / 0 stale / 0 unrecorded findings; `npm run check:ci` passed again (ledger 7/7, typecheck, lint 0 errors / 111 existing warnings, strict button audit reporting 22 documented exceptions, Jest 50 suites / 242 tests), followed by `git diff --check`, ledger audit, and workflow YAML parse.
- Passed: independent read-only review returned GO after removing 35 stale allowlist records; it found no P0/P1/P2, business/UI/API/version/EAS/lockfile mixing, secret, production-write, or external-sync risk.
- Pending: `actionlint` is unavailable locally; GitHub Actions dispatch, iOS/Android simulator, physical devices, EAS/native build, production API, production-data writes, and external sync are not run.
- Not run: EAS/native build、iOS/Android 模拟器、真实设备、生产 API、生产数据写入或外部同步；均不属于本治理单元。

### Risks / Release Notes

- Risk: 当前移动端 worktree 含有大量业务改动；必须只 stage 本单元文件及 `package.json` 的 quality hunk，不能带入版本号或业务源文件。
- Audit scope: 通过 `check:buttons --strict` 只证明不存在未登记的新可疑按钮尺寸；它不证明 22 条当前历史例外都满足 44pt 触控契约。每条例外都保留在脚本中作为精确债务记录；扫描不再命中的 35 条陈旧例外已删除，后续迁移或真机验证后才能继续删除。
- Sensitive-information review: 本单元不读取、不记录或提交 `.env`、token、cookie、密码、数据库 URL、私钥、设备日志或本地缓存。
- Rollback: 回退本单元列出的治理文件及对应 package scripts hunk；无需回退应用逻辑或数据。
- **Git state:** 已以非 force 快进从 `b45d84529ba734b17fabf9bd0c786517394abafd` 推送候选至移动端 `origin/Dev` 的 `25d1f8963fae93e02130035071cb67d7be98444e`；同步根治理基线为 `origin/Dev` 的 `8074849a7a85a3c13767ad03346b1ed3578f82e4`。推送后 `git fetch origin Dev` 确认本候选与 `origin/Dev` 为 ahead 0 / behind 0。

## CRL-20260729-002 — 已选跨仓库发布单元的移动端映射

- **Status:** pushed
- **Updated:** 2026-07-29 Australia/Melbourne
- **Request:** 用户选择推送已本地提交的 CRL-20260725-023、CRL-20260725-002，以及根仓库台账标记 ready 的 31 个单元到 `Dev`；后续明确纳入 CRL-20260724-002、CRL-20260724-003、CRL-20260729-009、CRL-20260724-010、CRL-20260725-004、CRL-20260725-005、CRL-20260725-010、CRL-20260725-011、CRL-20260725-012、CRL-20260725-016、CRL-20260725-017、CRL-20260725-021、CRL-20260724-012。
- **Outcome:** 本记录只将所选 CRL 的移动端文件显式映射到独立仓库台账，以便在保留并发改动和暂存内容的情况下进行候选提交审计；本次补入任务表单照片读取、浴室检查照片、检查后待挂钥匙、短幂等 ID、媒体预览变体、任务内容展示、小缩略图网格和退房状态优先级依赖。业务规则、完整跨层说明和测试映射以根仓库 `docs/change-release-ledger.md` 为准。

### Files / Areas

- `package.json` — selected button-contract scripts hunk only; version and local quality-baseline hunk excluded.
- `src/components/CleaningMediaImage.tsx` — selected authenticated cleaning-media rendering.
- `src/components/CleaningMediaPreview.test.tsx` — selected media preview contract tests.
- `src/components/CleaningMediaPreview.tsx` — selected media preview error/retry UX.
- `src/components/GuestLuggageCard.tsx` — selected button contract migration.
- `src/components/ui/AppButton.test.tsx` — selected button contract tests.
- `src/components/ui/AppButton.tsx` — selected shared button contract.
- `src/components/ui/AppIconButton.test.tsx` — selected icon button tests.
- `src/components/ui/AppIconButton.tsx` — selected shared icon button contract.
- `src/components/ui/ResponsiveImageGrid.test.tsx` — selected fixed-thumbnail-width tests.
- `src/components/ui/ResponsiveImageGrid.tsx` — selected fixed-thumbnail-width grid behavior.
- `src/lib/api.ts` — selected media and task API behavior.
- `src/lib/inspectionPanelDraft.ts` — selected bathroom inspection-draft compatibility.
- `src/lib/cleaningConsumablesDraft.ts` — selected consumables draft behavior.
- `src/lib/cleaningConsumablesSubmitQueue.test.ts` — selected queue tests.
- `src/lib/cleaningConsumablesSubmitQueue.ts` — selected queue behavior.
- `src/lib/cleaningMediaCache.test.ts` — selected authenticated media cache tests.
- `src/lib/cleaningMediaCache.ts` — selected authenticated media cache.
- `src/lib/cleaningMedia.test.ts` — selected image-variant URL tests.
- `src/lib/cleaningMedia.ts` — selected authenticated media image variants.
- `src/lib/consumableRestockStandards.test.ts` — selected standards tests.
- `src/lib/consumableRestockStandards.ts` — selected consumable standards.
- `src/lib/dayEndHandoverQueue.ts` — selected handover queue behavior.
- `src/lib/i18n.tsx` — selected UI copy.
- `src/lib/imageCompression.test.ts` — selected image conversion tests.
- `src/lib/imageCompression.ts` — selected image conversion behavior.
- `src/lib/inspectionMediaQueue.test.ts` — selected inspection queue tests.
- `src/lib/inspectionMediaQueue.ts` — selected inspection queue behavior.
- `src/lib/inspectionPanelSubmitQueue.test.ts` — selected inspection submit tests.
- `src/lib/inspectionPanelSubmitQueue.ts` — selected inspection submit behavior.
- `src/lib/keyUploadQueue.test.ts` — selected key-upload tests.
- `src/lib/keyUploadQueue.ts` — selected key-upload behavior.
- `src/lib/localMediaDrafts.ts` — selected local media draft helper when present in the release base.
- `src/lib/managerDailyTaskPhotos.ts` — selected manager media behavior.
- `src/lib/profileStore.test.ts` — selected profile persistence tests.
- `src/lib/profileStore.ts` — selected profile persistence behavior.
- `src/lib/propertyFollowupTaskDisplay.test.ts` — selected property follow-up display tests.
- `src/lib/propertyFollowupTaskDisplay.ts` — selected property follow-up display behavior.
- `src/lib/taskVisualTheme.test.ts` — selected task-status priority tests.
- `src/lib/taskVisualTheme.ts` — selected task-status priority behavior.
- `src/lib/theme.ts` — selected button token contract.
- `src/lib/taskFormPhotos.test.ts` — selected task-form photo aggregation tests.
- `src/lib/taskFormPhotos.ts` — selected task-form photo aggregation and deduplication.
- `src/lib/workTaskActions.test.ts` — selected action tests.
- `src/lib/workTaskActions.ts` — selected action behavior.
- `src/lib/workTasksStore.test.ts` — selected task store tests.
- `src/lib/workTasksStore.ts` — selected task store behavior.
- `src/navigation/RootNavigator.tsx` — selected navigation behavior.
- `src/screens/LoginScreen.tsx` — selected button contract migration.
- `src/screens/contacts/ContactDetailScreen.tsx` — selected contact action contract.
- `src/screens/me/AccountScreen.tsx` — selected button contract migration when present in the release base.
- `src/screens/me/ProfileEditScreen.test.tsx` — selected profile tests.
- `src/screens/me/ProfileEditScreen.tsx` — selected profile behavior.
- `src/screens/notices/InfoCenterDetailScreen.tsx` — selected information detail UI.
- `src/screens/notices/NoticeDetailScreen.test.tsx` — selected manager task-entry regression test.
- `src/screens/notices/NoticeDetailScreen.tsx` — selected notice detail UI.
- `src/screens/tabs/MeScreen.test.tsx` — selected profile tab tests.
- `src/screens/tabs/MeScreen.tsx` — selected profile tab UI.
- `src/screens/tabs/NoticesScreen.tsx` — selected notice tab UI.
- `src/screens/tabs/TasksScreen.test.tsx` — selected task tab tests.
- `src/screens/tabs/TasksScreen.tsx` — selected task tab behavior.
- `src/screens/tasks/CleaningSelfCompleteScreen.test.tsx` — selected self-completion tests.
- `src/screens/tasks/CleaningSelfCompleteScreen.tsx` — selected self-completion behavior.
- `src/screens/tasks/DayEndBackupKeysScreen.tsx` — selected day-end action UI.
- `src/screens/tasks/FeedbackFormScreen.tsx` — selected feedback behavior.
- `src/screens/tasks/InspectionCompleteScreen.test.tsx` — selected inspection completion tests.
- `src/screens/tasks/InspectionCompleteScreen.tsx` — selected inspection completion behavior.
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — selected inspection panel tests.
- `src/screens/tasks/InspectionPanelScreen.tsx` — selected inspection panel behavior.
- `src/screens/tasks/ManagerDailyTaskScreen.test.ts` — selected manager-detail tests.
- `src/screens/tasks/ManagerDailyTaskScreen.tsx` — selected manager-detail behavior.
- `src/screens/tasks/SuppliesFormScreen.test.tsx` — selected supplies tests.
- `src/screens/tasks/SuppliesFormScreen.tsx` — selected supplies behavior.
- `src/screens/tasks/TaskDetailScreen.test.tsx` — selected task-detail tests.
- `src/screens/tasks/TaskDetailScreen.tsx` — selected task-detail behavior.
- `docs/change-release-ledger.md` — this release mapping.

### Impact / Dependencies

- API / database / migration: none introduced by this mapping.
- Dependencies: selected root CRL IDs are the canonical behavior records; the root button audit script is included with CRL-20260727-002. CRL-20260724-010, CRL-20260725-010, CRL-20260725-011 and CRL-20260725-012 provide the form-photo and bathroom/inspection-state contract required by FR-004; CRL-20260725-021 provides short submit-id generation and the shared backend length limit. CRL-20260724-012, CRL-20260725-004, CRL-20260725-005, CRL-20260725-016 and CRL-20260725-017 supply the required display helpers and their regression tests.
- Excluded: `.env.example`, mobile version/EAS/lockfile/CI/AGENTS changes, local quality-baseline scripts, and every file outside the selected CRL mapping.

### Validation

- Root `npm run check:full` — passed after the selected P1 media authorization correction; Web lint retains existing warnings only.
- Root ledger audit — passed: 57 changed files / 57 recorded files.
- Root feature registry audit — passed: 8 FRs / 90 test mappings.
- Root button audit — passed: no suspicious hard-coded dimensions.
- Candidate commit must run this mobile repository's ledger audit from a clean selected-worktree view before push.

### Risks / Release Notes

- Candidate assembly must use an alternate Git index: this worktree has unrelated staged and unstaged changes that must remain untouched.
- Device/EAS/native verification and any production API/data write are not part of this release.
- Sensitive-information review: no `.env`, token, credential, database URL, cookie, private key, local cache, or sensitive log is selected.
- **Git state:** `8c658e7` (`Release selected mobile CRL updates`) was pushed to `origin/Dev` on 2026-07-29 after the isolated candidate passed typecheck, lint, button audit and 50 Jest suites / 242 tests. The root repository release remains a separate remote-credential follow-up.

## CRL-20260725-023 — 普通清洁员隐藏挂钥匙视频

- **Status:** ready
- **Updated:** 2026-07-25 22:56 Australia/Melbourne
- **Request:** 清洁人员不需要看到挂钥匙视频；检查员、兼任检查员和管理角色保持查看能力。
- **Outcome:** 任务详情按角色隐藏普通 cleaner 的挂钥匙视频；后端 root repo 同步过滤 `/mzapp/work-tasks` 的视频字段，客户端保留防御性判断。

### Implementation

- **Previous behavior:** 详情页只要任务有 `lockbox_video_url` 就渲染执行人视频。
- **New behavior:** 只有 admin、offline_manager、customer_service、cleaning_inspector 和 cleaner_inspector 渲染该视频；普通 cleaner 不显示。
- **Key decisions:** 只改任务详情展示和回归测试，不改变上传/完成动作；不读取或提交本地环境文件。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 增加挂钥匙视频查看角色判断。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 覆盖普通 cleaner 不可见；允许角色列表由 root backend 角色能力测试覆盖。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** 依赖 root backend CRL-20260725-023 对普通 cleaner 过滤 `lockbox_video_url`。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** mobile `Dev` branch 由 root CI workflow 直接 checkout 验证。
- **Related units:** root CRL-20260725-023；FR-006。

### Validation

- `npm run typecheck` — passed。
- `npm run lint` — passed with existing warnings, 0 errors。
- `npm run test -- --runInBand --no-cache src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite, 25 tests。
- `npm run test` — passed: 44 suites, 190 tests；存在 Jest worker teardown warning。
- 真机/EAS/TestFlight 和真实通知收件人验证 — not run。

### Risks / Release Notes

- Risk: 已经缓存到本地的旧 payload 可能在刷新前仍保留字段，服务端下一次同步会清除；客户端也不会渲染普通 cleaner 的视频。
- **Rollback:** 回退 `TaskDetailScreen.tsx` 的角色判断和对应测试；无需数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥或生产数据。
- **Git state:** mobile 本地 `Dev` commit `ab3cf11` 已创建；未执行 push 或部署；其他线程预先未提交改动保持不动，并明确排除 `.env.local`、`.env.example` 和 `.index.ts.swp`。

## CRL-20260725-021 — 修复检查与补品保存的超长幂等 ID失败

- **Status:** ready
- **Updated:** 2026-07-25 18:31 Australia/Melbourne
- **Request:** 检查与补品照片上传成功后，保存业务照片记录因 `String must contain at most 120 character(s)` 失败；需要保留照片并支持重试。
- **Outcome:** 移动端改用不依赖完整任务 ID的短 `submit_id`；历史本地队列中的超长 ID会自动迁移；重试时跳过已成功的媒体上传，只执行失败的业务保存步骤。

### Implementation

- **Previous behavior:** `inspection_batch_${task_id}_...` 可能超过后端 120 字符限制，导致补品和检查照片业务保存同时失败。
- **New behavior:** 新批次使用短随机幂等 ID；读取旧队列时替换并持久化超长 ID；既有本机照片和远端引用不变，上传成功步骤不重复执行。
- **Key decisions:** 不删除本地照片、不清理远端引用、不新增队列或数据库系统；服务端契约由 root 仓库 CRL-20260725-021 同步放宽。

### Files / Areas

- `src/lib/inspectionPanelSubmitQueue.ts` — modified: 生成短 ID、迁移历史超长 ID并保留分步重试。
- `src/lib/inspectionPanelSubmitQueue.test.ts` — modified: 覆盖历史队列迁移、长任务 ID和仅重试失败步骤。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** 新生成的 `submit_id` 不超过 96 字符；依赖 root 仓库后端接受历史兼容范围。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** CRL-20260725-019、CRL-20260725-020。

### Validation

- `npm test -- --runInBand --no-cache src/lib/inspectionPanelSubmitQueue.test.ts` — passed: 1 suite, 15 tests。
- `npm test -- --runInBand` — passed: 44 suites, 189 tests。
- `npm run typecheck` — passed: `tsc -p tsconfig.json`。
- `npx eslint src/lib/inspectionPanelSubmitQueue.ts src/lib/inspectionPanelSubmitQueue.test.ts` — passed: 0 errors, 4 existing warnings。
- 真机、断网、App 重启和恢复网络流程 — not run。

### Risks / Release Notes

- Risk: 历史队列迁移依赖本地存储可写；若本地存储不可写，需要重新打开任务页生成批次。
- **Rollback:** 回退短 ID生成和历史队列迁移；无需数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥或生产数据。
- **Git state:** independent mobile `Dev` worktree 保持未提交；未执行 stage、commit、push 或部署。

## CRL-20260725-020 — 检查页补品加载态与读取失败防止误判为空

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 检查人员打开检查页时，缺少护发素等补充项不应在异步读取完成前被显示为“没有待补充项”；读取失败时应能识别并重试。
- **Outcome:** 补充项区域增加独立加载态；补品接口使用 settled 结果识别失败来源；加载失败时显示“补充项读取失败”和重试入口，成功读取后才显示空状态或缺失项目。

### Implementation

- **Previous behavior:** `getCleaningConsumables` 的异常被转换为 `null`，且补充项数组初始为空；异步请求完成前页面直接渲染“当前没有待补充项”，接口失败也会落入同一空状态。
- **New behavior:** 补充项请求完成前只显示“正在读取补充项”；任一补品来源读取失败时不显示虚假空状态，并提供重试；成功读取的项目仍会显示，成功且无缺失项后才显示原有确认/新增入口。
- **Key decisions:** 只调整移动端显示状态和现有读取重试路径，不改 API、数据库、提交门槛或服务端数据。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.tsx` — modified: 增加补品专用 loading/error 状态，使用 `Promise.allSettled` 识别读取失败，并在补品区域阻止过早空状态。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — modified: 增加读取中、读取失败、重试后显示护发素的回归测试；该文件此前已由其他移动端工作以未跟踪文件存在，本单元仅归属新增回归内容。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** none；继续使用现有 `getCleaningConsumables` 读取接口和页面内 `loadLocalState` 重试路径。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** CRL-20260725-018、CRL-20260725-019。

### Validation

- `npm test -- --runInBand src/screens/tasks/InspectionPanelScreen.test.tsx --no-cache` — passed: 1 suite, 7 tests。
- `npm run typecheck` — passed: `tsc -p tsconfig.json`。
- `npm run lint` — passed: 0 errors, 111 existing warnings。
- `git diff --check -- src/screens/tasks/InspectionPanelScreen.tsx docs/change-release-ledger.md` plus scoped trailing-whitespace scan of the untracked mobile test/ledger — passed；未读取或修改既有 `.env.local`。
- `python3 scripts/audit_change_release_ledger.py` from the root repository — passed: 27 changed files, 27 recorded files, coverage PASS。

### Risks / Release Notes

- Risk: 本次修复能区分“读取中/读取失败/成功为空”，但真实任务是否返回护发素仍取决于服务端任务来源 ID 和 `cleaning_consumable_usages` 数据；本次未调用生产接口。
- **Rollback:** 移除补品专用 loading/error 状态、settled 结果和对应回归测试；无需数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` worktree 保持未提交；未执行 stage、commit、push 或部署。

## CRL-20260725-019 — 检查照片本机就绪后才允许视频并支持客人到达豁免

- **Status:** ready
- **Updated:** 2026-07-25 17:52 Australia/Melbourne
- **Request:** 普通检查任务必须先完成检查与补充照片并成功保存到本机，才允许拍摄/上传视频；弱网下仍可分别排队重试；客人已到达且急需入住时允许明确跳过房间检查照片。
- **Outcome:** 完成页在普通任务照片批次未就绪时禁用视频入口；本机照片完整但尚未同步时允许继续拍视频并保持任务未完成；客人到达确认的空照片批次通过现有同步队列提交显式豁免。

### Implementation

- **Previous behavior:** 完成页提示可以先保存/提交视频，客户端没有验证检查与补充照片是否已经完整保存到本机；弱网和空批次状态容易让视频入口与照片前置顺序不一致。
- **New behavior:** 普通任务必须存在非草稿检查批次，必需照片具有本机文件或可靠远端引用后才启用视频；客人到达确认时允许无房间照片批次进入视频流程；弱网只影响同步，不影响本机就绪判断。
- **Key decisions:** 复用 `inspectionPanelSubmitQueue` 和现有本地媒体文件检查，不新增平行队列；`password_only` 继续走原有特殊流程；服务端豁免契约由 root 仓库 CRL-20260725-019 同步支持。

### Files / Areas

- `src/lib/api.ts` — modified: 检查照片提交类型增加 `guest_arrival_confirmed`。
- `src/lib/inspectionPanelSubmitQueue.ts` — modified: 增加视频前置照片就绪判断，并在客人到达空批次提交豁免字段。
- `src/lib/inspectionPanelSubmitQueue.test.ts` — modified: 覆盖普通任务照片门槛、本机文件缺失、客人到达豁免和弱网提交 payload。
- `src/screens/tasks/InspectionCompleteScreen.tsx` — modified: 普通任务照片未就绪时禁用视频入口，调整弱网提示和提交门槛。
- `src/screens/tasks/InspectionCompleteScreen.test.tsx` — modified: 覆盖普通任务阻止视频、弱网已保存本机和客人到达豁免入口。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** 现有检查照片提交 payload 增加可选豁免字段；视频接口不变。
- **Database / migration:** none；依赖 root 仓库复用现有操作审计记录豁免。
- **Config / environment:** none。
- **Dependencies:** none；继续使用本地媒体草稿、检查提交队列和视频媒体队列。
- **Related units:** CRL-20260723-006、CRL-20260725-001、CRL-20260725-011、CRL-20260725-012、CRL-20260725-018。

### Validation

- `npm test -- --runInBand --no-cache src/lib/inspectionPanelSubmitQueue.test.ts src/screens/tasks/InspectionCompleteScreen.test.tsx` — passed: 2 suites, 20 tests；首次执行有 1 个旧文案断言失败，更新断言后重跑通过。
- `npm test -- --runInBand` — passed: 44 suites, 185 tests。
- `npm run typecheck` — passed: `tsc -p tsconfig.json`。
- `npx eslint src/lib/inspectionPanelSubmitQueue.ts src/lib/api.ts src/screens/tasks/InspectionCompleteScreen.tsx src/lib/inspectionPanelSubmitQueue.test.ts src/screens/tasks/InspectionCompleteScreen.test.tsx` — passed: 0 errors, 39 existing warnings。
- 真机/EAS 构建与断网设备流程 — not run。

### Risks / Release Notes

- Risk: 客人到达豁免必须由有权限执行人明确确认；客户端不自行依据时间放行普通任务。
- Risk: 尚未在真实 iOS 设备执行相机、断网、重启 App、恢复网络和任务列表刷新验证。
- **Rollback:** 回退视频就绪判断、豁免 payload 和对应测试；无需数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥或生产数据。
- **Git state:** independent mobile `Dev` worktree 保持未提交；未 staging、commit、push 或部署。

## CRL-20260725-018 — 检查人员补充项新增入口区分本次与下次退房

- **Status:** ready
- **Updated:** 2026-07-25 17:28 Australia/Melbourne
- **Request:** 移动端检查人员在“消耗品补充”区域需要分别使用“添加其他要补充项”和“添加下次要补充项”两个入口。
- **Outcome:** 检查页显示两个独立入口；“其他要补充项”沿用现有待处理流程，“下次要补充项”加入后直接记录为 `carry_forward`，继续复用原有补品提交队列和后端状态。

### Implementation

- **Previous behavior:** 检查页只有“添加下次要补充项”按钮，两个新增场景无法在入口处区分；手动新增项统一以未选择状态加入，检查人员还需后续手动选择“下次退房补”。
- **New behavior:** 新增“添加其他要补充项”和“添加下次要补充项”两个并排入口；弹窗标题和提示跟随入口变化；后者新增的项目直接使用既有 `carry_forward` 状态，不要求本次补货照片。
- **Key decisions:** 只在移动端选择器入口决定新增项初始状态，不新增 API、数据库字段、依赖或第二套提交逻辑；保留现有“已补充 / 下次退房补 / 现场够用”后续调整能力。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.tsx` — modified: 增加两个补充项入口、选择器模式提示、`carry_forward` 初始状态和小屏并排布局。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — modified: 覆盖两个入口、弹窗模式以及下次补充项直接呈现 `carry_forward` 状态；该文件此前已由其他移动端工作以未跟踪文件存在，本单元仅归属新增回归内容。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** none；继续使用现有 `saveRestockProof` payload 和 `status='carry_forward'`。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** CRL-20260725-009、CRL-20260725-010、CRL-20260725-011、CRL-20260725-012、CRL-20260725-013、CRL-20260725-015、CRL-20260725-017。

### Validation

- `npm test -- --runInBand src/screens/tasks/InspectionPanelScreen.test.tsx --no-cache` — passed: 1 suite, 5 tests。
- `npm run typecheck` — passed: `tsc -p tsconfig.json`。
- `npm run lint` — passed: 0 errors, 111 existing warnings。
- `git diff --check -- src/screens/tasks/InspectionPanelScreen.tsx src/screens/tasks/InspectionPanelScreen.test.tsx` — passed；完整移动端 diff check 仍会报告既有 `.env.local` 文件末尾空行，未读取或修改该文件。

### Risks / Release Notes

- Risk: “其他要补充项”加入后仍需检查人员选择最终处理状态；若未选择，现有提交校验会继续阻止提交，这是既有门槛。
- **Rollback:** 移除两个入口和 picker mode，恢复单一选择器入口；无需数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` worktree 保持未提交；未执行 stage、commit、push 或部署。

## CRL-20260725-017 — 修复退房标记覆盖清洁与检查进行状态

- **Status:** ready
- **Updated:** 2026-07-25 17:08 Australia/Melbourne
- **Request:** 清洁人员开始任务后客服页面应显示“进行中”；登记补品后客服和检查人员页面不能回退为“已退房”。
- **Outcome:** 移动端合并任务和每日任务详情优先显示进行中、待检查等真实流程状态，退房标记仅用于未开始任务。

### Implementation

- **Previous behavior:** 合并 payload 同时带有 `assigned` 和 `checked_out_at` 时，移动端将任务显示为“已退房”，覆盖清洁/检查流程状态。
- **New behavior:** 移动端读取 `cleaning_status/inspection_status`，将进行中和清洁完成后的待检查状态置于退房标记之前。
- **Key decisions:** 复用现有任务状态映射，不新增客户端 API、缓存或依赖。

### Files / Areas

- `src/lib/taskVisualTheme.ts` — modified: 统一合并任务状态优先级。
- `src/lib/taskVisualTheme.test.ts` — modified: 增加进行中和待检查展示测试。
- `src/screens/tasks/ManagerDailyTaskScreen.tsx` — modified: 每日任务详情复用统一状态判断。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** none；依赖后端继续返回现有 `cleaning_status/inspection_status` 字段。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** CRL-20260725-016；FR-002、FR-004。

### Validation

- `npm run test -- --runInBand src/lib/taskVisualTheme.test.ts` — passed: 1 suite, 6 tests。
- `npm run typecheck` — passed。
- `npm test -- --runInBand` — passed: 44 suites, 180 tests。
- `npm run lint` — passed: 0 errors, 111 existing warnings。
- `npm run typecheck` — passed。
- `npm run check:fast` in root — passed its mobile typecheck step。
- `git diff --check` for changed mobile implementation/test/ledger files — passed。

### Risks / Release Notes

- Risk: 真机视觉验证尚未执行；本次只调整状态展示优先级。
- **Rollback:** 回退状态优先级 helper 和每日任务详情调用；无需数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile worktree 保持未提交；未执行 stage、commit、push 或部署。

## CRL-20260725-016 — 检查人员任务同步显示客服标记的退房状态

- **Status:** ready
- **Updated:** 2026-07-25 15:27 Australia/Melbourne
- **Request:** 客服标记房源已退房后，相关检查人员任务应显示“已退房”，不能继续显示“已分配”。
- **Outcome:** 移动端检查任务状态组件读取服务端同步的 `checked_out_at`，在任务未完成且非进行中时显示“已退房”。

### Files / Areas

- `src/lib/taskVisualTheme.ts` — modified: 检查任务的退房状态展示。
- `src/lib/taskVisualTheme.test.ts` — modified: 覆盖检查任务收到退房标记后的状态文案和颜色语义。
- `src/screens/tasks/ManagerDailyTaskScreen.tsx` — modified: 检查人员任务页独立状态文案的退房状态展示。
- `docs/change-release-ledger.md` — recorded this mobile release unit。

### Impact / Dependencies

- **API:** none；依赖 root CRL-20260725-016 让关联检查任务获得 `checked_out_at`。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** CRL-20260725-015；共享任务状态展示链路，选择性发布需按 hunk 审核。

### Validation

- `npm test -- --runInBand src/lib/taskVisualTheme.test.ts` — passed: 1 suite, 4 tests。
- `npm test -- --runInBand` — passed: 44 suites, 178 tests。
- `npm run typecheck` — passed。
- `npm run lint` — passed: 0 errors, 111 existing warnings。
- `git diff --check -- src/lib/taskVisualTheme.ts src/lib/taskVisualTheme.test.ts` — passed。

### Risks / Release Notes

- Risk: 只覆盖未完成、非进行中的检查任务；已完成、进行中和取消状态继续使用原有状态语义。
- **Rollback:** 删除检查任务退房标记分支和对应测试；无需数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署。

## CRL-20260725-015 — 已挂钥匙任务保留单一完成状态并支持只读查看检查照片

- **Status:** ready
- **Updated:** 2026-07-25 15:09 Australia/Melbourne
- **Request:** 检查照片已同步完成后，已挂钥匙任务不应重复显示两个“任务已完成”按钮；检查人员仍需能进入查看之前拍的照片。
- **Outcome:** 完成态检查入口显示为“查看检查照片”，进入后从服务端加载已同步照片，并以只读方式展示；上传、编辑和再次提交入口保持关闭。

### Implementation

- **Previous behavior:** 完成态 `submit_inspection` 被移动端和上传视频动作一起渲染为“任务已完成”，检查人员无法重新进入检查面板。
- **New behavior:** 服务端 action payload 为完成态检查入口增加 `read_only` 标记；移动端携带 `readOnly` 导航参数，检查面板读取现有远端照片并隐藏所有写操作。
- **Key decisions:** 保留服务端已挂钥匙完成状态和完成动作权限，不通过客户端旧状态逻辑重新开放提交。

### Files / Areas

- `src/lib/api.ts` — modified: 增加只读动作类型字段。
- `src/lib/workTaskActions.ts` — modified: 只读检查动作导航。
- `src/navigation/RootNavigator.tsx` — modified: 检查面板支持只读参数。
- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 单一“任务已完成”与“查看检查照片”展示。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 覆盖完成态按钮和只读导航。
- `src/screens/tasks/InspectionPanelScreen.tsx` — modified: 远端照片加载和只读页面。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — modified: 覆盖已同步照片查看和写入口隐藏。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** 复用现有 inspection photos GET 接口；无新增接口。
- **Database / migration:** none；无生产写入。
- **Config / environment:** none。
- **Dependencies:** 依赖 root CRL-20260725-015 提供 `read_only` action payload；无新增依赖。
- **Related units:** CRL-20260725-011、CRL-20260725-013、CRL-20260725-014；共享页面文件包含其他工作区改动，发布需按 hunk 审核。

### Validation

- `npm run test -- --runInBand src/screens/tasks/TaskDetailScreen.test.tsx src/screens/tasks/InspectionPanelScreen.test.tsx` — passed: 2 suites, 28 tests。
- `npm run typecheck` — passed。
- `npm run lint` — passed: 0 errors, 111 warnings（仓库既有 warnings）。
- `npm test -- --runInBand` — passed: 44 suites, 177 tests。
- Root `npm run check:fast` — passed: backend build、frontend tests、mobile typecheck、ledger and feature-registry audits。
- `git diff --check -- . ':(exclude).env.local'` — passed；完整移动端检查只因既有 `.env.local` 末尾空行报告，未修改或读取该敏感本地配置文件。

### Risks / Release Notes

- Risk: 尚未在真实 iOS 设备验证服务端权限、图片代理和大图预览；自动化测试已覆盖只读入口和远端照片映射。
- **Rollback:** 恢复任务详情完成态按钮和检查面板写入入口的原有分支；无需数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-014 — 任务详情钥匙照片与钥匙视频统一媒体尺寸

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 上方钥匙照片要跟下方执行人上传的视频一样宽度高度显示。
- **Outcome:** 钥匙照片改为与钥匙视频相同的全宽、`moderateScale(220)` 高媒体容器，保持图片 `contain` 展示；上传、删除、预览和任务状态逻辑不变。

### Implementation

- **Previous behavior:** 钥匙照片使用固定 `96×96` 缩略图，钥匙视频使用全宽媒体卡片。
- **New behavior:** 钥匙照片容器和钥匙视频容器均为全宽、`moderateScale(220)` 高；照片继续保持完整内容展示。
- **Key decisions:** 只调整任务详情页媒体展示尺寸，复用现有媒体容器样式语义，不改变 API、媒体队列、权限或任务状态。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx` — 统一钥匙照片与视频容器宽高，增加展示测试标识。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — 断言钥匙照片与视频容器宽高一致。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** none。
- **Database / migration:** none；未写入生产数据。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** CRL-20260725-013；root 仓库同步记录同一移动端发布单元。

### Validation

- `npm run test -- --runInBand src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite, 23 tests。
- targeted `npx eslint src/screens/tasks/TaskDetailScreen.tsx src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 0 errors, 3 existing warnings。
- mobile full Jest — passed: 44 suites, 175 tests。
- mobile lint — passed: 0 errors, 111 warnings（现有 warning；本次无新增错误）。
- root `npm run check:fast` — passed: backend build、frontend 39 files/170 tests、mobile typecheck、ledger and feature-registry audits。
- final ledger audit and `git diff --check` — pending after updating this entry。

### Risks / Release Notes

- Risk: 尚未在真机确认视频控件和不同图片比例下的视觉效果；照片和视频统一为约 220 高，窄屏仍需实际设备确认。
- **Rollback:** 恢复 `photoWrap/photo` 的固定缩略图样式；不需要数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-013 — 检查面板客厅提示与同步状态位置调整

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 第一张房间照片卡改为拍客厅整体；同步/状态更新信息移动到第 5 部分下方。
- **Outcome:** 客厅卡显示“建议拍客厅整体”，沙发卡继续显示“建议拍沙发表面”；同步状态、失败步骤、本地媒体摘要和冻结提示统一显示在“5. 标记已完成”之后。

### Implementation

- **Previous behavior:** 客厅卡错误显示沙发表面提示；同步状态信息位于顶部房源信息卡。
- **New behavior:** 客厅和沙发分别提示对应拍摄内容；状态更新区域移动到第 5 部分下方，提交逻辑和状态数据不变。
- **Key decisions:** 只调整移动端文案和布局位置，不改变照片必拍校验、提交队列、API 或任务状态流转。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.tsx` — 修正客厅提示并移动同步状态卡。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — 验证客厅/沙发提示和状态卡存在。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** none。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** mobile `CRL-20260725-012`、root `CRL-20260725-013`；检查面板文件含其他工作区改动，选择性发布需按 hunk 审核。

### Validation

- `npm run test -- --runInBand src/screens/tasks/InspectionPanelScreen.test.tsx` — passed: 1 suite, 3 tests。
- targeted `npx eslint src/screens/tasks/InspectionPanelScreen.tsx src/screens/tasks/InspectionPanelScreen.test.tsx` — passed: 0 errors。
- mobile full Jest — passed: 44 suites, 175 tests。
- mobile lint — passed: 0 errors, 111 warnings（现有 warning；本次无新增错误）。
- root `npm run check:fast` — passed: backend build、frontend 39 files/170 tests、mobile typecheck、ledger and feature-registry audits。
- final ledger audit and feature-registry audit — passed after updating this entry。

### Risks / Release Notes

- Risk: 真机滚动位置和窄屏视觉布局尚未验证。
- **Rollback:** 恢复客厅提示文案和状态卡原位置；不需要数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-012 — 浴室整体照片上限调整为三张

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 浴室整体照片卡片从最多 1 张调整为最多 3 张。
- **Outcome:** 移动端浴室卡片允许拍摄 3 张，显示 `3/3` 后停止添加；后端接口限制由 root 仓库同步调整。

### Implementation

- **Previous behavior:** 浴室卡片最多拍摄 1 张。
- **New behavior:** 浴室卡片最多拍摄 3 张，达到上限后显示 `3/3` 和“已达上限”。
- **Key decisions:** 不改变必拍要求、其他区域上限、本地草稿、媒体类型或上传队列语义。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.tsx` — 浴室照片上限改为 3。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — 覆盖连续拍摄三张并停止添加。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** none in the mobile repository；依赖 root `CRL-20260725-012` 的后端数量限制同步。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** mobile `CRL-20260725-008`、root `CRL-20260725-012`；共享检查面板文件含其他工作区改动，选择性发布需按 hunk 审核。

### Validation

- `npm run test -- --runInBand src/screens/tasks/InspectionPanelScreen.test.tsx src/lib/inspectionPanelSubmitQueue.test.ts` — passed: 2 suites, 14 tests。
- targeted `npx eslint src/screens/tasks/InspectionPanelScreen.tsx src/screens/tasks/InspectionPanelScreen.test.tsx` — passed: 0 errors。
- `npm run typecheck` — passed。
- `npm run lint` — passed: 0 errors, 111 warnings（既有 lint warnings）。
- `npm run test -- --runInBand` — passed: 44 suites, 175 tests。
- root `npm run check:fast` — passed: ledger/feature-registry audits, backend build, frontend 39 files/170 tests, mobile typecheck。
- root ledger audit — passed: Changed files 27, Recorded changed files 27, Coverage PASS。
- root feature-registry audit — passed: 5 FRs, 32 test mappings。

### Risks / Release Notes

- Risk: 真机连续拍摄三张照片和窄屏布局尚未验证。
- **Rollback:** 恢复 `bathroom` 卡片上限为 1 并回退对应测试；不需要数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-011 — 检查提交后待挂钥匙状态与刷新稳定性修复

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 检查人员提交检查照片后，任务不应在未拍钥匙视频前标记完成；重新进入检查完成页不能闪屏，并且仍可查看照片、上传钥匙视频。
- **Outcome:** 普通检查的 `inspected` 作为等待钥匙视频的中间状态；重复绑定相同检查任务不再触发本地队列刷新循环；实时任务状态继续显示为待挂钥匙；浴室照片门槛由根仓库后端同步支持。

### Implementation

- **Previous behavior:** 本地队列重复保存相同绑定数据并 emit，页面订阅刷新可能循环；实时 `inspected` 被移动端投影为完成。
- **New behavior:** 队列仅在实际变化时保存并 emit；普通检查的实时 `inspected` 投影为 `to_hang_keys`，password-only 仍为 `done`。
- **Key decisions:** 复用现有检查提交队列、任务 store 和服务端 action；不新增依赖、接口或数据库迁移。

### Files / Areas

- `src/lib/inspectionPanelSubmitQueue.ts` — no-op queue update guard。
- `src/lib/inspectionPanelSubmitQueue.test.ts` — repeated binding regression。
- `src/lib/workTasksStore.ts` — scope-aware realtime status projection。
- `src/lib/workTasksStore.test.ts` — inspected intermediate/terminal projection regression。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** none in the mobile repository；依赖 root `CRL-20260725-011` 的服务端状态/action 投影。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** mobile `CRL-20260725-008`、root `CRL-20260725-011`；共享队列和任务 store 文件含其他工作区改动，选择性发布需按 hunk 审核。

### Validation

- `npm run test -- --runInBand src/lib/inspectionPanelSubmitQueue.test.ts src/lib/workTasksStore.test.ts` — passed: 2 suites, 14 tests。
- `npm run test -- --runInBand src/screens/tasks/InspectionCompleteScreen.test.tsx src/screens/tasks/TaskDetailScreen.test.tsx src/screens/tasks/InspectionPanelScreen.test.tsx` — passed: 3 suites, 30 tests。
- `npm run test -- --runInBand` — passed: 44 suites, 174 tests。
- targeted `npx eslint src/lib/inspectionPanelSubmitQueue.ts src/lib/inspectionPanelSubmitQueue.test.ts src/lib/workTasksStore.ts src/lib/workTasksStore.test.ts` — passed: 0 errors, 6 warnings（既有 warning）。
- `npm run typecheck` — passed: `tsc -p tsconfig.json`。
- `npm run lint` — passed: 0 errors, 111 warnings（既有 lint warnings）。
- root `npm run check:fast` — passed: ledger/feature-registry audits, backend build, frontend 39 files/170 tests, mobile typecheck。
- root ledger audit — passed: Changed files 27, Recorded changed files 27, Coverage PASS。
- root feature-registry audit — passed: 5 FRs, 32 test mappings。

### Risks / Release Notes

- Risk: 真机原生导航、相机权限、弱网和生产任务状态尚未验证。
- **Rollback:** 回退 no-op queue guard、scope-aware realtime projection 和对应测试；不需要数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-008 — 检查照片新增浴室整体区域

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 检查与补充页增加浴室整体照片，并把客厅提示改为“需要拍沙发表面”。
- **Outcome:** 房间检查照片增加“浴室 / 需要拍浴室整体”卡片，最多拍 1 张；缺少浴室照片时不能提交必拍检查照片；客厅提示已更新。

### Implementation

- **Previous behavior:** 移动端房间检查照片只有客厅、沙发、卧室、厨房四个区域；浴室照片没有进入本地 snapshot 或提交校验。
- **New behavior:** 新增浴室区域及默认草稿、历史照片标签、检查照片类型和必拍校验；提交仍复用既有 inspection photo API 和队列。
- **Key decisions:** 不改变清洁完成照片流程、数据库、权限、上传队列语义或其他页面。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.tsx` — 更新客厅提示并增加浴室照片卡片。
- `src/lib/inspectionPanelSubmitQueue.ts` — 增加浴室类型、默认 snapshot 和缺失校验。
- `src/lib/inspectionPanelDraft.ts` — 旧草稿兼容及浴室默认空数组。
- `src/lib/api.ts` — inspection photo area 类型增加 `bathroom`。
- `src/lib/taskFormPhotos.ts` — 历史浴室照片显示“浴室”。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — 覆盖浴室卡片和客厅提示。
- `src/lib/inspectionPanelSubmitQueue.test.ts` — 覆盖缺少浴室照片时拒绝提交。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** existing inspection photo payload adds the `bathroom` area；无新接口。
- **Database / migration:** none；未写入生产数据。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** root `CRL-20260725-010`、mobile `CRL-20260725-007`；共享文件含其他工作区改动，选择性发布需按 hunk 审核。

### Validation

- `npm run test -- --runInBand src/screens/tasks/InspectionPanelScreen.test.tsx src/lib/inspectionPanelSubmitQueue.test.ts` — passed: 2 suites, 12 tests。
- `npm run typecheck` — passed: `tsc -p tsconfig.json`。
- targeted `eslint` — passed: 0 errors, 39 existing warnings。
- Backend area contract test — passed: `test_mzapp_form_photo_read: ok`。
- `npm run build --prefix backend` — passed。
- `npm run lint` — passed: 0 errors, 111 warnings（既有 lint warnings）。
- Root `npm run check:fast` — passed: ledger/feature-registry audits, backend build, frontend 39 files/170 tests, mobile typecheck。
- EAS/native/device validation — not run；真实相机和窄屏布局仍需真机验证。

### Risks / Release Notes

- Risk: 旧的未提交必拍草稿重新打开后会新增浴室缺失提示，这是新增拍照要求的预期行为。
- Risk: 五张照片卡的真机窄屏布局尚未验证。
- **Rollback:** 恢复 bathroom 类型、区域卡片、默认值和校验；不需要数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-007 — 检查人员点击“已补充”自动打开相机

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 检查人员点击补品项“已补充”时要弹出相机，明确引导现场拍摄补货照片。
- **Outcome:** “已补充”现在先打开相机；只有拍照成功后才标记 `restocked` 并保存补货照片，取消拍摄不会写入无照片的已补充状态。

### Implementation

- **Previous behavior:** 点击“已补充”只更新状态，检查人员还要另找“拍照上传”入口；提交校验会因缺少补货照片而阻止提交。
- **New behavior:** “已补充”和“拍照上传/继续拍照”复用同一相机函数；拍照成功后同时追加本地补货照片与 `restocked` 状态。
- **Key decisions:** 不改变 API、上传队列、权限、数据库或其他补品状态；相机取消/无照片/无权限时保持原状态。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.tsx` — current-task hunk: “已补充”拍照成功后写入状态与 `proof_media`，原拍照入口复用相机函数。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — current-task regression: 验证“已补充”会调用相机，成功拍照后保留本地补货照片。
- `docs/change-release-ledger.md` — recorded this release unit。

### Impact / Dependencies

- **API:** none；继续使用现有补品照片上传与保存链路。
- **Database / migration:** none；未写入生产数据。
- **Config / environment:** none；继续使用现有相机权限配置。
- **Dependencies:** none。
- **Related units:** root `CRL-20260725-009`、`CRL-20260725-001`、`CRL-20260724-014`；`InspectionPanelScreen.tsx` 含其他工作区改动，选择性发布时需按 hunk 审核。

### Validation

- `npm test -- --runInBand src/screens/tasks/InspectionPanelScreen.test.tsx` — passed: 1 suite, 2 tests。
- `npm test -- --runInBand src/screens/tasks/InspectionPanelScreen.test.tsx src/lib/inspectionPanelSubmitQueue.test.ts` — passed: 2 suites, 11 tests。
- `npm run typecheck` — passed: `tsc -p tsconfig.json`。
- `npm run lint` — passed: 0 errors, 111 existing warnings。
- Root `npm run check:fast` — passed: ledger audit, feature-registry audit, backend build, frontend tests (39 files / 170 tests), and mobile typecheck。
- EAS/native/device camera flow — not run；当前只完成 mocked camera interaction test，真实相机权限和原生行为仍需设备验证。

### Risks / Release Notes

- Risk: 相机权限被拒绝或用户取消拍摄时，补品不会标记为“已补充”；这是为了满足现有 `restocked` 必须有补货照片的提交门槛。
- Risk: 真实相机、弱网同步和生产接口未在本次执行；上传队列使用既有定向测试覆盖，设备级行为仍未验证。
- **Rollback:** 恢复 `onMarkRestocked` 的直接状态更新，并删除对应 screen regression test；不需要数据库回滚。
- **Sensitive-information review:** 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- **Git state:** independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-006 — 任务详情操作按钮统一高度

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 任务详情页的删除钥匙照片、钥匙/补品记录和房源问题反馈按钮高度不一致，需要统一视觉尺寸。
- **Outcome:** 任务操作按钮统一使用 48 的最小高度和一致的垂直内边距；横向等宽、全宽布局、禁用状态和点击行为保持不变。

### Implementation

- **Previous behavior:** 普通任务操作按钮使用 `minHeight: 36` 加上下内边距，删除钥匙照片按钮使用 `minHeight: 40` 和另一套内边距，导致截图中三组操作按钮视觉高度不一致。
- **New behavior:** 任务操作按钮和删除钥匙照片按钮统一为 `minHeight: 48`、`paddingVertical: 0`，内容继续垂直居中；带额外说明的按钮仍可按内容自然撑开。
- **Key decisions:** 只调整任务详情页 UI 尺寸，不改 action 路由、权限、按钮文案、状态或 API。

### Files / Areas

- `mz-cleaning-app-frontend/src/screens/tasks/TaskDetailScreen.tsx` — modified: 统一操作按钮和删除钥匙照片按钮高度/垂直内边距。
- `mz-cleaning-app-frontend/src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 更新等宽操作按钮尺寸回归断言。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** none。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260725-004`、`CRL-20260725-005`；共享 `TaskDetailScreen.tsx`，选择性发布时需按 hunk 审核。

### Validation

- `npm run typecheck` — passed。
- `npm test -- --runInBand src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite, 23 tests。
- `npm run lint` — passed: 0 errors, 111 warnings（既有 warning）。
- `git diff --check` — passed for the modified task detail and ledger files。
- `python3 ../scripts/audit_change_release_ledger.py` — passed: Changed files 26, Recorded changed files 26, Coverage PASS。
- EAS/native build — not run；本仓库没有 build script，本次未执行原生构建。

### Risks / Release Notes

- Risk: 包含额外说明文案的动作按钮可能因内容需要略高于 48，这是为了避免文字被截断；截图中的三组单行按钮会保持一致高度。
- Rollback: 恢复 `actionBtn` 和 `dangerBtn` 原有最小高度/内边距，并恢复对应测试断言。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-005 — 移动端任务照片预览加速与加载态优化

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 移动端任务照片点击放大后等待时间过长，期间显示纯黑，需要优化加载速度和预览反馈。
- **Outcome:** 清洁媒体代理支持缩略图/预览图变体；所有任务照片全屏预览先显示小图，再异步加载预览图；失败时保留小图并支持重试；页面内照片统一请求缩略图。

### Implementation

- **Previous behavior:** 任务照片页面内的小图和全屏预览都可能直接请求原始大图；放大后原图请求/解码较慢时只看到黑色背景。
- **New behavior:** 统一 `CleaningMediaPreview` 在全屏打开时先渲染缩略图，再加载预览变体；清洁对象 key/private R2 URL 通过既有鉴权代理请求 `thumbnail`（最长边 480）或 `preview`（最长边 1600）。
- **Key decisions:** 复用现有媒体引用、鉴权 token、R2 key 和本地草稿逻辑；不改变上传、删除、任务状态、数据库或队列；不新增移动端依赖。

### Files / Areas

- `src/lib/cleaningMedia.ts` — modified: 支持清洁媒体图片变体。
- `src/lib/cleaningMedia.test.ts` — modified: 覆盖缩略图和预览图代理 URL。
- `src/components/CleaningMediaImage.tsx` — modified: 页面媒体默认使用缩略图变体。
- `src/components/CleaningMediaPreview.tsx` — added: 统一全屏小图占位、预览图加载、失败重试。
- `src/components/CleaningMediaPreview.test.tsx` — added: 覆盖加载态、成功和失败重试。
- `src/components/GuestLuggageCard.tsx` — modified: 行李提醒照片使用缩略图/统一全屏预览。
- `src/screens/tasks/CleaningSelfCompleteScreen.tsx` — modified: 自完成照片使用缩略图/统一全屏预览。
- `src/screens/tasks/DayEndBackupKeysScreen.tsx` — modified: 日终照片使用缩略图/统一全屏预览。
- `src/screens/tasks/FeedbackFormScreen.tsx` — modified: 反馈照片使用缩略图/统一全屏预览。
- `src/screens/tasks/InspectionPanelScreen.tsx` — modified: 检查面板全屏预览复用本地/缓存小图。
- `src/screens/tasks/ManagerDailyTaskScreen.tsx` — modified: 每日清洁照片使用缩略图/统一全屏预览。
- `src/screens/tasks/SuppliesFormScreen.tsx` — modified: 补品照片使用缩略图/统一全屏预览。
- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 任务详情照片使用缩略图/统一全屏预览。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** 依赖根仓库 `CRL-20260725-006` 对 `/cleaning-app/media/image` 增加变体支持；默认原图读取保持兼容。
- **Database / migration:** none；未写入数据库或生产数据。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260725-004`；共享移动端任务照片展示页面，选择性发布时需按 hunk 审核。

### Validation

- `npm run typecheck` — passed。
- `npm run lint` — passed: 0 errors, 111 warnings（既有 warning）。
- `npm test -- --runInBand` — passed: 43 suites, 168 tests。
- Targeted media/task tests — passed: 7 suites, 40 tests。
- `git diff --check` — passed for the modified mobile media/task files。
- EAS/native build — not run；本仓库没有 build script，本次未执行原生构建。

### Risks / Release Notes

- Risk: 清洁媒体变体首次请求仍受后端 R2 读取和转换耗时影响；移动端已先显示小图，且预览响应不再传输原始大图；本次未在生产网络测量具体秒数。
- Risk: 非清洁公开 URL 继续使用原有直连地址，不经过清洁媒体变体代理。
- Rollback: 恢复各页面原始全屏 `Image` 和二参数媒体 source 调用即可。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-004 — 移动端任务照片统一小图并排展示

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 所有角色任务照片页面不要直接展示大图；页面内统一显示小缩略图，可点击查看大图，并尽量并排排列，减少纵向占用。
- **Outcome:** 补品记录、清洁自完成、检查面板、任务详情、每日清洁、日终交接、问题反馈和行李提醒中的页面内照片统一为约 96×96 缩略图；每日清洁的完成照片改为带名称的横向网格；原有点击全屏预览、删除、上传和离线媒体逻辑保持不变。

### Implementation

- **Previous behavior:** 客厅照片、清洁完成照片及部分检查/交接照片使用整行或两列大图；每日清洁完成照片按照片类型逐块纵向排列。
- **New behavior:** 页面内照片使用固定小方图，网格空间不足时自动换行；每日清洁完成照片在同一网格中并排显示名称；点击缩略图仍打开原有全屏预览。
- **Key decisions:** 只调整移动端页面展示尺寸和排列，不改变照片 URL、上传队列、读取接口、删除动作、数据库或全屏预览容器。

### Files / Areas

- `src/components/ui/ResponsiveImageGrid.tsx` — modified: 支持调用方指定固定缩略图宽度。
- `src/components/ui/ResponsiveImageGrid.test.tsx` — added: 覆盖固定小缩略图宽度。
- `src/components/GuestLuggageCard.tsx` — modified: 行李提醒照片统一为小缩略图。
- `src/screens/tasks/SuppliesFormScreen.tsx` — modified: 补品各类现场照片统一小图并排排列。
- `src/screens/tasks/CleaningSelfCompleteScreen.tsx` — modified: 自完成库存/完成照片使用固定小缩略图网格。
- `src/screens/tasks/InspectionPanelScreen.tsx` — modified: 检查、补品证明和问题照片统一小图。
- `src/screens/tasks/ManagerDailyTaskScreen.tsx` — modified: 每日清洁全部照片改为小图；完成照片按名称横向网格展示。
- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 钥匙照片和任务处理照片改为小缩略图。
- `src/screens/tasks/DayEndBackupKeysScreen.tsx` — modified: 日终照片改为小缩略图网格。
- `src/screens/tasks/FeedbackFormScreen.tsx` — modified: 问题反馈照片缩略图统一尺寸。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** none；继续使用既有照片读取、上传和预览链路。
- **Database / migration:** none；不执行生产写入。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260725-001`、`CRL-20260725-002`、`CRL-20260725-003`；共享照片展示组件和任务页面，选择性发布时需按 hunk 审核。

### Validation

- `npm test -- --runInBand src/components/ui/ResponsiveImageGrid.test.tsx src/screens/tasks/SuppliesFormScreen.test.tsx src/screens/tasks/CleaningSelfCompleteScreen.test.tsx src/screens/tasks/InspectionPanelScreen.test.tsx src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 5 suites, 32 tests。
- `npm run check:ci` — passed: typecheck passed; lint 0 errors with 111 warnings; 42 suites and 165 tests passed。
- `git diff --check --`（本 release 涉及的 10 个移动端源文件）— passed。
- `npm run check:feature-registry`（root）— passed；本次为展示层调整，不新增业务不变量。
- `python3 ../scripts/audit_change_release_ledger.py` — passed after ledger update: `Changed files: 26; Recorded changed files: 26; Coverage: PASS`。
- EAS/native build — not run；本仓库没有 build script，且本次未执行原生构建。

### Risks / Release Notes

- Risk: 缩略图固定为约 96×96，窄屏会自动换行；全屏查看仍使用原图/原有预览逻辑，视频尺寸不变。
- Rollback: 恢复本 release unit 中各页面缩略图尺寸和每日清洁完成照片的网格渲染即可。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-003 — 移动端完成/补品按钮直接显示完成文案

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 移动端任务完成或补品已记录时，按钮直接变灰并修改按钮文案，不额外增加状态描述。
- **Outcome:** 完成类按钮直接显示“任务已完成”并使用灰色样式；补品类按钮直接显示“补品已记录”并使用灰色样式；移除任务详情中额外的补品记录状态行，同时保留补品只读查看入口。

### Implementation

- **Previous behavior:** 完成类按钮在按钮内额外显示“任务已完成”原因文本；补品已完成时按钮仍为蓝色，并在按钮上方显示独立的“补品记录状态 / 任务已完成”状态行。
- **New behavior:** 完成类和补品已记录类按钮均直接使用单行完成文案和灰色按钮；补品按钮仍可进入只读页查看已保存照片，不改变提交权限或任务状态。
- **Key decisions:** 只调整移动端任务详情展示和只读入口交互；不修改服务端 `available_actions`、状态流转、API、数据库或照片接口。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 完成/补品 action 的单行文案、灰色样式和额外状态行移除。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 覆盖完成类与补品类按钮文案、灰色样式、无额外状态行和只读导航。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** none；继续使用服务端已有 action 和既有补品只读读取链路。
- **Database / migration:** none；不执行生产写入。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260725-002`；共享 `TaskDetailScreen.tsx` 和测试文件，选择性发布时需按 hunk 审核。

### Validation

- `npm test -- --runInBand src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite, 23 tests。
- `npm run check:ci` — failed on a separate pre-existing `src/components/ui/ResponsiveImageGrid.test.tsx` change: expected fixed thumbnail width `96`, received `undefined`; in the same run typecheck passed, lint had 0 errors with 111 existing warnings, and the task-related suites passed. An earlier full run before that unrelated test appeared passed with 41 suites and 164 tests。
- `git diff --check` — passed for the current mobile task/ledger files。
- `python3 ../scripts/audit_change_release_ledger.py` — passed: `Changed files: 26; Recorded changed files: 26; Coverage: PASS`。
- EAS/native build — not run；本仓库没有 build script，且本次未执行原生构建。

### Risks / Release Notes

- Risk: 补品已记录按钮仍是只读查看入口，灰色表示不可编辑/重复提交；点击后仍可查看既有照片。
- Rollback: 恢复完成类按钮的服务端原因副文案、补品状态行和原有按钮文案/样式即可。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted；未 staging、commit、push 或部署；其他工作区变更保持不动。

## CRL-20260725-002 — 已完成补品任务只读查看

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 任务详情中“任务已完成”不应作为补品按钮内部副文案；已完成任务仍需进入补品记录查看已拍照片，不能弹出“暂不可操作”。
- **Outcome:** 完成状态改为按钮上方独立标签；“补品记录”在已完成状态下可进入只读页面查看照片，隐藏拍照和提交入口，并禁用删除、修改操作。

### Implementation

- **Previous behavior:** `fill_supplies` 遇到 `task_completed` 会被禁用并弹出“暂不可操作”；按钮内部同时显示“补品记录 / 任务已完成”。
- **New behavior:** 已完成的 `fill_supplies` 作为只读查看入口，导航参数携带 `readOnly: true`；TaskDetail 使用独立状态标签；SuppliesForm 只读模式保留照片查看和全屏预览，隐藏拍照/提交入口并禁用删除、修改。
- **Key decisions:** 不改变任务完成状态、服务端 action 权限或照片读取接口；只调整移动端入口和只读展示边界。

### Files / Areas

- `src/navigation/RootNavigator.tsx` — modified: 为补品路由增加可选 `readOnly` 参数。
- `src/lib/workTaskActions.ts` — modified: 已完成补品 action 导航到只读补品页。
- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 完成状态独立展示并允许补品记录查看入口。
- `src/screens/tasks/SuppliesFormScreen.tsx` — modified: 增加只读模式，保留照片查看并隐藏编辑/提交操作。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 覆盖完成状态标签和只读导航参数。
- `src/screens/tasks/SuppliesFormScreen.test.tsx` — modified: 覆盖只读页照片状态及编辑控件隐藏。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** 继续使用既有补品记录读取和照片读取链路；无接口变更。
- **Database / migration:** none；不新增或修改数据库结构，不执行生产写入。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260725-001`；共享 `SuppliesFormScreen.tsx`，发布时需按 hunk 审核上传状态与只读模式。

### Validation

- `npm test -- --runInBand src/screens/tasks/TaskDetailScreen.test.tsx src/screens/tasks/SuppliesFormScreen.test.tsx` — passed: 2 suites, 28 tests。
- `npm run check:ci` — passed: typecheck passed; lint 0 errors with 111 existing warnings; 41 suites and 163 tests passed。
- `git diff --check -- src/navigation/RootNavigator.tsx src/lib/workTaskActions.ts src/screens/tasks/TaskDetailScreen.tsx src/screens/tasks/TaskDetailScreen.test.tsx src/screens/tasks/SuppliesFormScreen.tsx src/screens/tasks/SuppliesFormScreen.test.tsx docs/change-release-ledger.md` — passed。
- `python3 scripts/audit_change_release_ledger.py` — passed after final ledger update。
- EAS/native build — not run; independent mobile repository has no build script in scope。

### Risks / Release Notes

- Risk: 已完成任务进入的是只读补品页，若需修改必须走新的业务流程；这是为保留完成状态和避免重复提交而设定的边界。
- Rollback: 恢复 `fill_supplies` 的 completed 禁用逻辑、移除 `readOnly` 路由参数和只读 UI 即可。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted; no staging, commit, push, or deployment performed。

## CRL-20260725-001 — 明确补品照片上传状态

- **Status:** ready
- **Updated:** 2026-07-25 Australia/Melbourne
- **Request:** 清洁人员在补品记录页面看到了照片，但无法判断照片是否已上传；底部按钮仍显示可提交，上传与离线同步状态不清楚。
- **Outcome:** 页面明确区分“待上传”“待同步”和“已上传并同步”；提交按钮按状态显示“上传并保存”“上传并保存中…”或“重试上传”。

### Implementation

- **Previous behavior:** 拍照后的本地 `file://` 图片只显示缩略图，页面没有提示其尚未上传；提交按钮始终使用“提交/保存修改”文案。
- **New behavior:** 识别本地照片数量并显示待上传提示；已有远端照片显示已上传并同步；点击提交时明确告知会上传并保存；离线待同步记录显示重试上传，上传期间沿用提交锁避免重复点击。
- **Key decisions:** 保留“拍摄后本地保存、提交时上传、弱网进入队列”的既有数据链路，只补充移动端可见状态和回归测试；不增加接口或数据库字段。

### Files / Areas

- `src/screens/tasks/SuppliesFormScreen.tsx` — modified: 统计本地待上传照片、显示状态提示、区分提交按钮文案并增加测试标识。
- `src/screens/tasks/SuppliesFormScreen.test.tsx` — modified: 覆盖本地待上传、离线待同步和既有拍照流程。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** 继续使用既有 `uploadCleaningMedia` 和 `submitCleaningConsumables`，无接口变更。
- **Database / migration:** none；不新增或修改数据库结构。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260724-014`；共享 `SuppliesFormScreen.tsx`，发布时需按 hunk 审核两个移动端修复单元。

### Validation

- `npm test -- --runInBand src/screens/tasks/SuppliesFormScreen.test.tsx` — passed: 1 suite, 5 tests。
- `npm run check:ci` — passed: typecheck passed; lint 0 errors with 111 existing warnings; 41 suites and 161 tests passed。
- `git diff --check -- src/screens/tasks/SuppliesFormScreen.tsx src/screens/tasks/SuppliesFormScreen.test.tsx docs/change-release-ledger.md` — passed。
- `python3 scripts/audit_change_release_ledger.py` — passed after final ledger update。
- EAS/native build — not run; independent mobile repository has no build script in scope。

### Risks / Release Notes

- Risk: 本地照片在点击“上传并保存”前仍未上传，这是既有弱网设计；新增文案只提升可见性，不改变上传时机。
- Rollback: 移除本地照片计数、状态提示和按钮文案分支即可，原上传队列链路不受影响。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted; no staging, commit, push, or deployment performed。

## CRL-20260724-014 — 修复厨房照片连续拍摄卡住

- **Status:** ready
- **Updated:** 2026-07-24 Australia/Melbourne
- **Request:** 补品记录页面拍摄厨房照片时，第一张完成后仍持续显示“拍照中…”，无法稳定拍摄剩余项目。
- **Outcome:** 厨房照片按钮一次点击只处理一个待拍项目；拍完、取消或本地保存失败后立即解除加载状态，下一次点击继续处理下一个待拍项目。

### Implementation

- **Previous behavior:** 一次点击会串行打开厨房全部待拍项目的相机，并在整个批处理完成前锁定按钮；相机或本地图片压缩/保存 Promise 卡住时，页面会永久停在“拍照中…”。
- **New behavior:** 一次点击只选择第一个待拍项目，单张完成后更新本地照片状态并通过 `finally` 解除按钮锁定；取消不会触发后续拍摄。
- **Key decisions:** 只修移动端补品页面的厨房拍照状态机和回归测试；不改后端接口、数据库、上传提交链路或其他场景拍照流程。

### Files / Areas

- `src/screens/tasks/SuppliesFormScreen.tsx` — modified: 厨房拍照从批量循环改为单张处理，并增加稳定的按钮测试标识。
- `src/screens/tasks/SuppliesFormScreen.test.tsx` — modified: 覆盖单次拍摄、取消后继续和本地保存失败解锁。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** none；拍照与压缩保存仍走既有移动端链路。
- **Database / migration:** none；不新增或修改数据库读写。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260724-013`；本单元与补品页面既有照片读取/本地草稿逻辑相邻，但不改变其数据来源。

### Validation

- `npm test -- --runInBand src/screens/tasks/SuppliesFormScreen.test.tsx` — passed: 1 suite, 3 tests。
- `npm run check:ci` — passed: typecheck passed; lint 0 errors with 111 existing warnings; 41 suites and 159 tests passed。
- `git diff --check -- src/screens/tasks/SuppliesFormScreen.tsx src/screens/tasks/SuppliesFormScreen.test.tsx` — passed。
- `python3 scripts/audit_change_release_ledger.py` — passed after final ledger update。
- EAS/native build — not run; independent mobile repository has no build script in scope。

### Risks / Release Notes

- Risk: 厨房总按钮不再一次性连续打开多个相机，需要用户逐次点击；这是为避免相机/本地保存链路互相阻塞而明确采用的交互。
- Rollback: 恢复 `onTakeRequiredScenePhotoSequence` 的原批量循环并移除本单元回归测试即可。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted; no staging, commit, push, or deployment performed。

## CRL-20260724-013 — 移除任务详情页补品照片读取

- **Status:** ready
- **Updated:** 2026-07-24 Australia/Melbourne
- **Request:** 用户确认任务详情页不需要显示补品/房间照片，只在进入补品消耗页面时加载照片，以减少重复访问后端和数据库。
- **Outcome:** 任务详情页不再显示“补品填报 / 房间照片”，也不再调用表单照片接口；补品消耗页面继续保留补品照片、场景照片、本地草稿和提交链路。

### Implementation

- **Previous behavior:** `TaskDetailScreen` 在挂载和重新获得焦点时读取本地表单照片并请求 `/mzapp/work-tasks/:id/form-photos`，随后在详情页显示照片、加载状态、错误和重试入口。
- **New behavior:** 任务详情移除表单照片状态、读取 effect、照片展示区和相关样式；照片读取只由 `SuppliesFormScreen` 的既有补品数据链路负责。
- **Key decisions:** 只调整移动端展示边界；不改后端聚合接口、数据库结构、补品上传/提交、钥匙照片或权限逻辑。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 移除任务详情页表单照片读取与展示。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 增加任务详情不调用表单照片接口的回归测试。
- `src/screens/tasks/SuppliesFormScreen.test.tsx` — modified: 确认补品页面仍调用既有补品记录/照片读取接口。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** 任务详情不再调用 `/mzapp/work-tasks/:id/form-photos`；`SuppliesFormScreen` 继续调用既有补品消耗读取接口。
- **Database / migration:** none；进入任务详情会少一条照片读取链路，补品消耗页仍按用户要求读取补品数据。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260724-010` 的任务详情照片展示部分由本单元按用户最终确认调整；`TaskDetailScreen.tsx` 与 `CRL-20260724-011`、`CRL-20260724-012` 共享，选择性发布时需按 hunk 审核。

### Validation

- `npm test -- --runInBand src/screens/tasks/TaskDetailScreen.test.tsx src/screens/tasks/SuppliesFormScreen.test.tsx` — passed: 2 suites, 22 tests。
- `npm run check:ci` — passed: typecheck passed; lint 0 errors with 111 existing warnings; 41 suites and 157 tests passed。
- `git diff --check` — passed for current mobile implementation and root ledger changes。
- `python3 scripts/audit_change_release_ledger.py` — passed: 23 changed files, 23 recorded, Coverage PASS。
- EAS/native build — not run; independent mobile repository has no build script in scope。

### Risks / Release Notes

- Risk: 用户不会在任务详情页直接预览补品照片，需要进入补品消耗页面查看；这是本次明确的产品范围。
- Rollback: 恢复 `TaskDetailScreen` 的表单照片读取和展示即可，补品页不需要回滚。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted; no staging, commit, push, or deployment performed。

## CRL-20260724-012 — 维修/深清/补日用品任务显示具体内容

- **Status:** ready
- **Updated:** 2026-07-24 Australia/Melbourne
- **Request:** 移动端维修、深度清洁和补日用品任务不能明确看到任务内容，补日用品任务只显示数量。
- **Outcome:** 任务卡片和任务详情显示补日用品具体物品名、数量和备注，同时保留维修/深清原有内容。
- **Scope:** `TasksScreen`、`TaskDetailScreen` 及共享展示辅助函数；不改 API、数据库结构或生产数据。
- **Files:** `src/lib/propertyFollowupTaskDisplay.ts`; `src/lib/propertyFollowupTaskDisplay.test.ts`; `src/screens/tabs/TasksScreen.tsx`; `src/screens/tasks/TaskDetailScreen.tsx`。
- **Validation:** `npm run check:ci` passed: typecheck, lint 0 errors (111 warnings), 41 suites and 156 tests; targeted 3 suites and 46 tests passed; scoped `git diff --check` passed。
- **Git state:** independent mobile `Dev` remains uncommitted; no staging, commit, push, or deployment performed。

### Implementation

- Previous behavior: 任务标题显示房源号，详情只显示数量/备注，补日用品物品名被隐藏。
- New behavior: 补日用品显示“补日用品：物品名”，并显示数量/备注；维修和深度清洁保留原有标题与任务内容。
- Key decisions: 复用现有 `title/summary`，不新增接口和依赖。

### Files / Areas

- `src/lib/propertyFollowupTaskDisplay.ts` — added: 维修/深清/补日用品任务展示规则。
- `src/lib/propertyFollowupTaskDisplay.test.ts` — added: 任务名称和数量展示回归测试。
- `src/screens/tabs/TasksScreen.tsx` — modified: 任务卡片展示具体任务内容。
- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 任务详情展示具体任务内容。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

## CRL-20260724-011 — 移动端任务操作按钮布局优化

- **Status:** ready
- **Updated:** 2026-07-24 Australia/Melbourne
- **Request:** 移动端上传钥匙照片后，任务详情页的“钥匙已记录”和“补品填报”按钮不应占据过宽的半行，需要优化按钮 UI。
- **Outcome:** “钥匙已记录/钥匙待同步”和“补品填报/补品记录”按钮在同一行均匀分配宽度并保持较低高度；“房源问题反馈”保持下一行整宽入口。

### Implementation

- **Previous behavior:** 任务操作按钮统一使用 `flex: 1`，钥匙记录和补品填报按钮在同一行时各自撑满半行，视觉占比过大。
- **New behavior:** `upload_key_photo` 和 `fill_supplies` 使用等分宽度（`flex: 1`）并采用 `minHeight: 36` / `paddingVertical: 6`；钥匙照片已存在时不再渲染重复的“已记录”小字；`report_issue` 明确保持下一行整宽，操作顺序和交互不变。
- **Key decisions:** 只改任务详情展示层；不改钥匙照片上传、补品填报、反馈 API、任务状态或权限判断。

### Update 2026-07-24

- 用户澄清目标按钮后，撤回了本单元早先针对“删除钥匙照片”按钮的错误样式和测试；该错误实验不属于最终行为。

### Update 2026-07-24 23:06

- 钥匙照片已存在时，主按钮文案已经表达“钥匙已记录/钥匙待同步”，不再重复渲染服务端的“已记录”小字。
- 任务操作按钮高度由 `minHeight: 40` / `paddingVertical: 8` 调整为 `minHeight: 36` / `paddingVertical: 6`。

### Update 2026-07-24 23:20

- 根据用户反馈撤回“内容宽度左对齐”方向；钥匙记录与补品填报恢复为同一行等分宽度，保留低高度和去重文案。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 钥匙记录/补品填报 action 使用低高度等分宽度，反馈 action 保持整行。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 覆盖两个 action 的等分宽度、低高度、重复文案隐藏和反馈整行布局。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** none。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260724-004`、`CRL-20260724-008`、`CRL-20260724-010`；共享 `TaskDetailScreen.tsx`，选择性发布时需按 hunk 审核。

### Validation

- `npm test -- --runInBand src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite, 20 tests，包含等分宽度、低高度和重复文案隐藏断言。
- `npm run check:ci` — passed: typecheck passed; lint 0 errors with 111 existing warnings; 41 suites and 156 tests passed。
- Previous full Jest attempt before the user clarification — failed in `TasksScreen.test.tsx`; after reverting the incorrect delete-button test and applying the correct action-layout test, the full suite passed。
- EAS/native build — not run; this repository has no build script in scope。
- Root `python3 scripts/audit_change_release_ledger.py` — passed: 23 changed files, 23 recorded, Coverage PASS。

### Risks / Release Notes

- Risk: 两个并排按钮会按容器剩余宽度等分，极长文案仍需关注小屏换行；无业务逻辑风险。
- Rollback: 恢复任务 action 的原始宽度/高度样式并移除本单元测试即可。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted; unrelated changes are preserved。

## CRL-20260724-010 — 任务详情展示补品填报照片与弱网状态

- **Status:** ready
- **Updated:** 2026-07-24 Australia/Melbourne
- **Request:** 移动端各角色重新打开清洁/检查任务时，能够在任务详情中直接查看补品填报、房间检查和问题照片；本地草稿、上传队列和远端记录需稳定关联并去重。
- **Scope:** 任务详情照片展示、服务端聚合读取、本地草稿/队列合并、远端优先去重、同步状态和分层重试；不改上传队列协议或生产数据。
- **Files:** `src/lib/api.ts`; `src/lib/taskFormPhotos.ts`; `src/lib/taskFormPhotos.test.ts`; `src/screens/tasks/TaskDetailScreen.tsx`; targeted tests.
- **Validation:** `npm run check:ci` — passed: typecheck, lint 0 errors (111 existing warnings), 40 suites and 152 tests; targeted `src/lib/taskFormPhotos.test.ts` — passed: 5 tests; targeted `TaskDetailScreen.test.tsx` — passed: 19 tests with async `act` console warnings; scoped `git diff --check` and new-file whitespace checks — passed; native/EAS build — not run, no build script in scope.
- **Git state:** independent mobile `Dev` remains uncommitted; unrelated existing changes and local configuration were preserved; no staging, commit, push, or deployment performed.

### Implementation

- Previous behavior: 任务详情没有统一展示补品填报、房间检查和问题照片。
- New behavior: 任务详情按稳定任务关系加载远端记录及本地草稿/提交队列，远端版本优先，显示待同步、同步中、同步失败、已同步无标签，并提供接口级和单图级重试。
- Key decisions: 按远端 key/标准化 URL、稳定本地媒体 ID/队列 ID/文件 URI 去重，不按文件名去重；补品照片直接在任务详情的表单照片区域展示。

### Files / Areas

- `src/lib/api.ts` — modified: 增加 work-task 表单照片读取 API 类型与客户端调用。
- `src/lib/taskFormPhotos.ts` — added: 稳定任务关系、本地草稿/队列读取、照片去重和状态合并。
- `src/lib/taskFormPhotos.test.ts` — added: 远端优先、稳定本地身份、文件名不去重和关系 ID 回归测试。
- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 任务详情展示表单照片、弱网状态和两级重试。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 为新网络状态读取增加测试 mock，保留现有任务详情回归覆盖。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。


独立移动端仓库的变更台账。不得记录密码、token、cookie、私钥、数据库 URL、`.env` 内容或敏感日志。

## CRL-20260724-009 — 修复移动端周末日期卡片裁切

- **Status:** ready
- **Updated:** 2026-07-24 Australia/Melbourne
- **Request:** 移动端如果今天是周五、周六或周日，日期栏要完整显示当天日期卡，不要只显示一半。
- **Outcome:** `TasksScreen` 在 `today` 模式下，周五、周六、周日都会自动把日期栏定位到本周末，当前日期卡完整可见；周一至周四仍保持左侧定位。

### Implementation

- **Previous behavior:** 日期栏只有周六、周日滚动到末端；周五仍从周一开始显示，在窄屏上第五张周五卡片会被右侧裁切。
- **New behavior:** 新增 `shouldScrollWeekRowToEnd()` 日期规则，将周五、周六、周日统一定位到横栏末端。
- **Key decisions:** 只调整移动端日期栏的本地布局/滚动定位，不改任务日期计算、任务 API、排序、后端或数据库。

### Files / Areas

- `src/screens/tabs/TasksScreen.tsx` — modified: 周五至周日触发日期栏末端定位。
- `src/screens/tabs/TasksScreen.test.tsx` — modified: 增加周四至周一日期定位规则回归测试。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** none。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** none; `TasksScreen.tsx` 仍有其他工作区改动，选择性发布时需按 hunk 审核。

### Validation

- `npm test -- --runInBand src/screens/tabs/TasksScreen.test.tsx` — passed: 1 suite, 23 tests；Jest 保留既有 open-handle 提示。
- `npm test -- --runInBand` — passed: 39 suites, 147 tests。
- `npm run typecheck` — passed: `tsc -p tsconfig.json`。
- `./node_modules/.bin/eslint src/screens/tabs/TasksScreen.tsx src/screens/tabs/TasksScreen.test.tsx` — passed: 0 errors。
- `npm run lint` — passed: 0 errors, 111 existing warnings。
- `git diff --check -- src/screens/tabs/TasksScreen.tsx src/screens/tabs/TasksScreen.test.tsx` — passed。
- EAS/native build — not run; this repository has no build script in scope for this fix。
- Root `python3 scripts/audit_change_release_ledger.py` — passed: `Changed files: 22; Recorded changed files: 22; Coverage: PASS`。

### Risks / Release Notes

- Risk: 周五开始默认显示周五、周六、周日，左侧会保留更多空白；这是为了保证当天和周末日期卡完整可见，横向滑动仍可查看整周。
- Rollback: 恢复周六/周日判断并移除 `shouldScrollWeekRowToEnd()` 回归测试即可。
- Sensitive-information review: 未添加或记录 secrets、`.env` 内容、token、密码、数据库 URL、credentials、cookie、私钥、敏感日志或生产数据。
- Git state: independent mobile `Dev` remains uncommitted; unrelated existing changes are preserved。

## CRL-20260724-008 — 修复移动端任务照片全屏预览黑屏

- **Status:** ready
- **Updated:** 2026-07-24 Australia/Melbourne
- **Request:** 移动端查看任务照片时，全屏预览显示黑屏，需要检查并修复。
- **Outcome:** `/mzapp/upload` 返回的 `mzapp/...` 照片继续使用其可访问的原始媒体地址；只有路径属于 `cleaning/` 的清洁媒体才进入 cleaning 专用图片代理。任务详情照片点击预览不再因代理返回 403 而只显示黑色遮罩。

### Implementation

- **Previous behavior:** `buildCleaningMediaImageSource()` 将所有 `.r2.dev` / R2 URL 都送到 `/cleaning-app/media/image`；该后端路由只允许 `cleaning/...`，所以任务详情中来自 `/mzapp/upload` 的 `mzapp/...` 照片缩略图可见，但全屏预览请求被拒绝。
- **New behavior:** R2 URL 只有在路径包含 `/cleaning/` 时才走 cleaning 图片代理；`mzapp/...` 和其他非-cleaning 媒体保持原始 URL。清洁对象 key 的鉴权代理行为保持不变。
- **Key decisions:** 仅修复媒体来源分流，不改后端路由、上传接口、任务状态、数据库或权限；不执行生产接口调用或媒体写入。

### Files / Areas

- `src/lib/cleaningMedia.ts` — modified: 限制 legacy R2 cleaning 代理的路径匹配范围。
- `src/lib/cleaningMedia.test.ts` — modified: 增加 `mzapp/...` R2 URL 不走 cleaning 代理的回归测试。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- **API:** none; `/mzapp/upload`、`/cleaning-app/media/image` 和任务详情接口不变。
- **Database / migration:** none。
- **Config / environment:** none。
- **Dependencies:** none。
- **Related units:** `CRL-20260724-004`（任务详情照片操作布局）；当前工作区其他 `TaskDetailScreen.tsx` 改动未被本单元修改。

### Validation

- `npm test -- --runInBand src/lib/cleaningMedia.test.ts` — passed: 1 suite, 5 tests。
- `npm test -- --runInBand` — passed: 39 suites, 146 tests。
- `npm run typecheck` — passed: `tsc -p tsconfig.json`。
- `./node_modules/.bin/eslint src/lib/cleaningMedia.ts src/lib/cleaningMedia.test.ts` — passed: 0 errors。
- `npm run lint` — passed: 0 errors, 111 existing warnings。
- `git diff --check` — failed on pre-existing `.env.local:2` blank line at EOF; no code diff whitespace error and the file was not read or modified。
- EAS/native build — not run; this repository has no build script in scope for this fix。
- Root `python3 scripts/audit_change_release_ledger.py` — passed: `Changed files: 22; Recorded changed files: 22; Coverage: PASS`。

### Risks / Release Notes

- Risk: non-cleaning R2 media now bypasses the cleaning proxy and depends on the URL returned by its own upload/API path being readable; this matches `/mzapp/upload` behavior evidenced by the visible thumbnail and avoids sending `mzapp/...` to a cleaning-only route。
- Rollback: restore the broad R2 detection in `isLegacyPrivateR2Url()` and remove the new regression test。
- Sensitive-information review: no secrets, `.env` values, tokens, database URLs, credentials, cookies, private keys, sensitive logs, or production data were added or recorded。
- Git state: independent mobile `Dev` remains uncommitted; unrelated existing changes are preserved。

## CRL-20260722-001 — 仅改密码任务禁止错误标记回退

- **Status:** ready
- **Updated:** 2026-07-23 15:10 AEST
- **Request:** 用户要求仅改密码任务只走 `upload_access_video`，清洁任务没有有效动作时禁止回退到通用“标记完成”界面。
- **Outcome:** 清洁任务动作数组为空时显示刷新提示，不再显示通用拍照上传和标记完成控件。

### Implementation

- Previous behavior: `cleaning_tasks` 的服务端动作数组为空时，任务详情页进入通用任务处理分支，并可能调用 `work_tasks` 标记接口。
- New behavior: 所有 `cleaning_tasks` 任务都先判断服务端动作；动作为空时只显示“当前任务暂无可用操作，请刷新任务后重试”。
- Key decisions: 不新增 API、缓存或本地兜底动作；保留非清洁通用任务原有标记流程。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx` — modified: 清洁任务空动作保护分支。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 覆盖空 `available_actions` 不显示通用标记流程。
- `docs/change-release-ledger.md` — modified: 记录本 release unit。

### Impact / Dependencies

- API: none；只阻止错误的通用 `/mzapp/work-tasks/:id/mark` 调用。
- Database / migration: none。
- Config / environment: none。
- Dependencies: 使用现有 `package-lock.json` 执行 `npm ci` 安装本地测试依赖；未修改 `package.json` 或锁文件。
- Related units: root repository `CRL-20260722-013`。

### Validation

- `npm ci` — passed: added 1365 packages from the existing lock file；仅创建被忽略的本地 `node_modules`，未修改 package manifest 或 lock file。
- `node_modules/.bin/jest --runInBand src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite, 17 tests。
- `npm run typecheck` — passed。
- `npm run lint` — passed: 0 errors, 112 warnings（既存 warning，未在本次安装任务中清理）。
- `npm test -- --runInBand` — passed: 38 suites, 129 tests。
- `git diff --check` — passed。

### Risks / Release Notes

- Risk: malformed or stale task payloads now require refresh rather than allowing a wrong completion API call。
- Rollback: remove the empty-action guard and restore the previous conditional branch。
- Sensitive-information review: no secrets, `.env` values, tokens, database URLs, credentials, or sensitive logs were added。
- Git state: uncommitted; existing mobile worktree changes remain preserved。

## CRL-20260720-006 — 移动端屏幕测试、安全区与独立质量门禁

- **Status:** in-progress
- **Updated:** 2026-07-23 15:10 AEST
- **Request:** 对最新 `Dev` 分支补齐主要页面屏幕级 Jest，替换两个页面的原生 `SafeAreaView`，并准备可复现依赖安装与 CI typecheck/lint 环境。
- **Outcome:** 已新增检查面板、清洁完成、补品填报、房源反馈四个屏幕级测试；任务中心和通知页改用 `react-native-safe-area-context`；独立 CI 固定 Node 20.19.4 并使用 `npm ci`。

### Implementation

- Previous behavior:
  - 四个核心任务页没有独立的屏幕级 smoke/interaction Jest。
  - `TasksScreen` 和 `NoticesScreen` 使用 React Native 原生 `SafeAreaView`。
  - 独立移动端没有自己的质量工作流，依赖未安装时无法复现 typecheck/lint。
- New behavior:
  - 新增四个页面测试，覆盖页面加载、关键状态、角色入口和维修类型选择。
  - 两个页面使用 `react-native-safe-area-context` 的 `SafeAreaView`。
  - 增加 `.nvmrc`、`check:ci` 和独立 GitHub Actions workflow；CI 先 `npm ci`，再运行 typecheck、lint 和 Jest。
- Key decisions:
  - 不新增依赖、不改业务 API、不写测试库数据。
  - 当前本地验证复用了旁边工作区的依赖树，仅用于 Jest；正式可复现环境由 CI 的锁文件安装保证。

### Files / Areas

- `src/screens/tasks/InspectionPanelScreen.test.tsx` — added: 检查人员检查与补充页屏幕测试。
- `src/screens/tasks/CleaningSelfCompleteScreen.test.tsx` — added: 任务执行人清洁完成页屏幕测试。
- `src/screens/tasks/SuppliesFormScreen.test.tsx` — added: 任务执行人补品检查页屏幕测试。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — added: 检查人员房源反馈页屏幕测试。
- `src/screens/tabs/TasksScreen.tsx` — modified: 使用安全区上下文组件。
- `src/screens/tabs/TasksScreen.test.tsx` — modified: mock 安全区上下文组件。
- `src/screens/tabs/NoticesScreen.tsx` — modified: 使用安全区上下文组件。
- `src/screens/tabs/NoticesScreen.test.tsx` — modified: mock 安全区上下文组件。
- `docs/change-release-ledger.md` — added: 记录本 release unit。

### Impact / Dependencies

- API: none。
- Database / migration: none。
- Config / environment: CI only；不包含测试账号、token 或环境变量。
- Dependencies: 不增加 package dependency；CI 使用现有 `package-lock.json` 的 `npm ci`。
- Related units: none in this independent repository。

### Validation

- `git merge --ff-only origin/Dev` — passed: `Dev` 与 `origin/Dev` 均为 `0e2d0b7`。
- targeted Jest for four new screens plus Tasks/Notices tests — passed: 6 suites, 15 tests。
- full mobile Jest after clean local install — passed: 38 suites, 129 tests。
- targeted `SuppliesFormScreen.test.tsx` after mock adjustment — passed: 1 suite, 1 test，未再出现该警告。
- backend build and targeted cleaning/notification/guest-luggage tests — passed in root repository；不改变本移动端仓库。
- mobile typecheck after clean local install — passed。
- mobile lint after clean local install — passed: 0 errors, 112 warnings。
- `npm ci` — passed: CI workflow and local checkout now use the existing lock file successfully。
- simulator dynamic flows — not run: Expo 仓库没有 Xcode project/workspace，且当前环境没有 Android `adb`；见测试缺口。
- `python3 scripts/audit_change_release_ledger.py` — not available in this independent repository；该脚本仅存在于根仓库。

### Risks / Release Notes

- Risk: npm audit reports 30 dependency vulnerabilities（2 low, 15 moderate, 11 high, 2 critical）；本次未执行自动升级或 `npm audit fix`。
- Risk: 四个新增测试是屏幕级 smoke/关键交互覆盖，不替代真实相机、视频、网络恢复和通知点击测试。
- Risk: `--detectOpenHandles` 诊断会使既有 `TasksScreen.test.tsx` 的一个 5 秒测试超时；需要后续单独清理测试句柄。
- Rollback: 删除本 release unit 列出的新增测试、CI/Node 配置和安全区改动，并恢复两个页面原有 import。
- Sensitive-information review: 未记录密码、token、cookie、私钥、数据库 URL、`.env` 内容或敏感日志。
- Git state: uncommitted；未执行 stage、commit、push 或发布。

### Governance extraction — 2026-07-29

- `package.json` 的质量 scripts hunk、`.nvmrc` 和 `.github/workflows/quality.yml` 从这个长期未完成的屏幕测试单元中拆出，由 `CRL-20260729-001` 单独治理、验证和选择性提交。
- 本单元保留屏幕测试和 SafeArea 业务/UI 范围；不得因为治理文件的提交而把这些未完成页面改动混入发布。
