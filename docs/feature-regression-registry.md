# Feature Regression Registry

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
- **Business outcome:** `issue_reported` 的列表、详情与大图均走认证媒体；任务关联问题保留合法 `task_id`，普通房源反馈无任务上下文时走既有反馈授权分支。
- **Related CRLs:** `mobile/CRL-20260816-003`; historical payload source `mobile/CRL-20260622-015`.

### Test-to-invariant mapping

- `src/screens/tabs/NoticesScreen.test.tsx` — property-feedback and task-bound issue thumbnails both use the authenticated renderer.
- `src/screens/notices/NoticeDetailScreen.test.tsx` — property-feedback and task-bound issue detail/viewer preserve their respective contexts.
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

### Shared validation and release boundary

- Local integration candidate passed 6 targeted Jest suites / 55 tests, TypeScript, lint (0 errors; 109 pre-existing warnings), ledger audit and diff check.
- Post-release validation: administrator, offline manager, customer service and eligible task roles verify list → detail → viewer. Wrong task, unrelated media and unauthorized user remain server-side `403`.
- Does not cover P1-NTF-01/02, Photo ID/Visa, object recovery, R2 ACL, recipient policy, Badge, Push, deployment, OTA or real-device proof.
