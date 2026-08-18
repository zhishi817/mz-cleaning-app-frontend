# Change Release Ledger

## CRL-20260817-004 — P1-FIN-01 报销凭证认证图片读取与草稿预览边界（mobile）

- **Repository:** mobile
- **Status:** ready; source fixed and combined local regression passed
- **Updated:** 2026-08-17 Australia/Melbourne
- **Request:** 修复已保存报销凭证直接读取私有 URL 的问题。
- **Outcome:** 已保存凭证使用 receiptId 和 imageId bearer 认证 source；仅未提交草稿使用当前设备 URI，绝不回退私有 URL。

### Implementation

- 已保存凭证使用 receiptId 和 imageId bearer 认证 source；仅未提交草稿使用当前设备 URI，绝不回退私有 URL。

### Files / Areas

- `src/lib/api.ts`
- `src/lib/expenseReceiptMedia.ts`
- `src/lib/expenseReceiptMedia.test.ts`
- `src/screens/me/ExpenseCenterScreen.tsx`
- `docs/feature-regression-registry.md`
- `docs/change-release-ledger.md`

### Impact / Dependencies

- 配对 root/CRL-20260817-004；不复用 cleaning proxy，不改 schema、R2 ACL 或原生配置。

### Validation

- Combined targeted media regression: 3 suites / 29 tests passed; shared-reader regression: 10 suites / 114 tests passed.
- npm run typecheck, npm run lint, git diff --check and the combined ledger gate are recorded separately.

### Staged Commit Scope

- **Repository:** mobile
- **Status:** prepared.
- **Untracked review:** none; the clean candidate has no untracked files after exact staging.
- `docs/feature-regression-registry.md` — SHA-256: `41d34bbe3132899ae8a80ab1ec5c992ebe2b6cfb6bdd98e0e8d8c13e895db5bf`
- `src/lib/api.ts` — SHA-256: `5768a9fefb51dfe5db3f9c913982a5c0857106a3c28546b6105732685016a0a4`
- `src/lib/expenseReceiptMedia.test.ts` — SHA-256: `4836a9131ce8188ad808c42f1ec705921a86af32104620230c237c2c69dde46e`
- `src/lib/expenseReceiptMedia.ts` — SHA-256: `3f4fbcfa94ba4b60e9f47b541e8875145e061f7f64905bfa1aa320c7542dfadf`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `bb219ecbde6faed94cf9cab219de36525576ac85c2fcbd578655015584fb9b61`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `4a850ec17e6a290192ba9353253ee7fe14adf383ee51b6ce2bd74a2a8d59c899`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `18e178d6f0acc56f07bc55e55d16f07ea51a865ccd229d25e1ed1225ba7837aa`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `a3714b54f365021bf06d01f055df256f5c85a84d4664ed768f4df16c5bd2b0ab`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `6148327974aa8281b63397f983b8c04364f13104e746c9479e86715627f72c21`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `22b61a62587e41b5842b9fa3ca755af032732a719fc31732005df67a81c609bc`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `45882e9882dce7183a59f7b1c201acbf6d17543c6ccac2c7d7c53cc572cf438c`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `49888785d348401acc7087cdb45431997801b6c247f75a1c75dbd8a9bb3bb349`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `e6d64ec4c72ffbbe1d947aa562176a5ca342c1176e97a340abed1669aa182805`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `a6da86726450a9127c9081dd73de026946033a477fd9b0aeb68a319958727506`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `f6f23c0abe751cbd773d62e1b3abf635452f39558011617a3a1a590e7e05bc6f`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `8d57c80924732274bba4532408a31117e18340fb13cb7c2620aa67b75d927f6f`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `87e53a118804777e3a7b487500518011e8df86fa984c80ff0813cba48282e7ca`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `f1e5309f57e6738ac051eece2dcb6d2bdc978aae0fcaec3247029962593ff215`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `ddd38a29d14194cd64a85534658d7df013fc72c0fdf863d0cfdf5252d9ed71bb`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `5f82161b65b867e82f02d3377ed9de1d77d1648e8b887fc625196b0beb9ebd17`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `ae72ad63bba111d6ec9008e8652bb9a3f369dd97c1c42a68e0a9d17d68663d65`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `b70f802019c2e83f82e0c27f1955b2fff00f8ba8f4e7df93f6e4a270436dc18d`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `565617dbde5e25b01ae97c853b63e0abba9ece5f28a78adfc72152f271f488e7`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `dfdde1e35ee44ea33f76f05622ca4b580bf2932997c95fbd252073e255958a31`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `ad66ed05283d24b7f6fd814717f5e32a6b955416eab2093f4a8083069b03ec4e`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `39b5ba3cae02b8d4f7e9faa419d4e39782d50c20b6966be5c26d60d9ebd3730c`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `8fbcecb36deda5f5e8d863badcb1dab359b3de5e664f8539151bbbf41e7f2c59`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `3ef154ae2b2de053c56146476df337b1af5da26df49f437134604bec5882046b`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `0b6b1a7fd21b72eadbed9e32b78b19da5749f4b0599fcf51d57bef41f25fcd2f`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `a4c2c4e4417d6448238d9328622a98606b5e5ccd63820d3399ee9b044d1519c7`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `5b1d28ce10de38a29622ae5755a0b521a02f930e53a2d1c58acebce9ae300ff9`
- `src/screens/me/ExpenseCenterScreen.tsx` — SHA-256: `5d77a1bcd33aadf33a2bc3adda4a3366be9ca8c93510120a5df7d6cccbf7aab7`

### Release Attempts

#### RA-20260817-002

- Repository: `mobile`.
- Selected CRLs: `CRL-20260817-002`, `CRL-20260817-003`, `CRL-20260817-004`.
- Selected CRL identities: `mobile/CRL-20260817-002, mobile/CRL-20260817-003, mobile/CRL-20260817-004`.
- Intended action: `commit`.
- Branch: `codex/p1-fdb-fin-20260817-recovery`; target: `Dev`.
- Base: `origin/Dev@e285ad7679c913a0ca8fbe3b41b410542f143bc4`; fetched at `2026-08-17T15:15:48+10:00`.
- Candidate patch SHA-256: `d8b1adb8762a0842587c2dd35e2677675a1ec21738c07fc82a4a861451749542`, excluding `docs/change-release-ledger.md`.
- Commit SHA: not committed; candidate content commit will be recorded only after the content commit exists.
- Dependencies: paired `root/CRL-20260817-002`, `root/CRL-20260817-003` and `root/CRL-20260817-004`; root and mobile candidates must travel together.
- Required validation: PASS — targeted mobile media suites (29 tests), typecheck, lint, raw-private-URL audit, feature-registry and combined pre-commit gate passed on the latest Dev candidate.
- Shared-hunk review: PASS — deep-cleaning/inventory reader normalization stays exact-source scoped; finance uses a dedicated receipt reader.
- Generated-file / secret review: PASS — temporary dependency link was removed; no generated files, credentials, private media bytes, production logs or production data are staged.
- Technical state: `verified`.
- User authorization: `selected-for-commit`; evidence: user authorized the latest-Dev recovery after the stale-base stop.
- Independent review: GO for `commit` — independent read-only review rechecked the latest-Dev base, candidate fingerprint, CRL identity recovery, scoped diff, validation evidence and secret/production-write boundary.
- Action conclusion: `GO` for local commit only; push, PR, merge, deployment, OTA and device verification require separate authorization and evidence.

### Risks / Release Notes

- Recovery evidence: former unpushed candidate used colliding local IDs; this new canonical unit was rebuilt from `origin/Dev@e285ad7679c913a0ca8fbe3b41b410542f143bc4`.

- Source and local regressions do not prove historical object availability or release/runtime behavior.
- Sensitive-information review: no credentials, private URLs, media bytes, production logs or production data are recorded.

## CRL-20260817-001 — 挂钥匙视频静默刷新与本地保留（mobile）

- **Repository:** `mobile`
- **Status:** ready (clean candidate validated and independently approved for local commit)
- **Updated:** 2026-08-17 Australia/Melbourne
- **Request:** 修复移动端挂钥匙/标记已完成页面在后台检查队列事件后反复显示“正在校验”，并防止重拍时新视频尚未成功保存到本机便删除旧的待上传视频。
- **Outcome:** 初次进入仍使用阻塞校验；全局检查队列与导航焦点事件只静默更新当前校验数据，不再触发可见加载态。重拍先成功创建新视频队列项，再尽力清理旧的未业务保存副本；新入队失败时旧本地视频不受影响。

### Implementation

- Previous behavior: 任意检查队列事件都调用会重置 `loading/validationReady` 的刷新函数，已打开页面反复切回“校验中”；重拍在调用本机入队前删除旧视频，入队失败会造成旧视频不可恢复。
- New behavior: 刷新以 generation 防止旧请求覆盖新数据，并且只有首屏刷新显示阻塞状态；替换顺序为“新队列项持久化 → 更新页面引用 → 清理旧队列项”。旧项清理异常不会把已成功入队的新视频误报为失败。
- Key decisions: 不更改 `inspectionMediaQueue` 的上传、保留期、私有副本、业务保存或清理策略；不加入新的队列、后台接口、存储格式或客户端权限规则。

### Files / Areas

- `src/screens/tasks/InspectionCompleteScreen.tsx` — 队列/焦点静默刷新与重拍视频安全替换顺序。
- `src/screens/tasks/InspectionCompleteScreen.test.tsx` — 队列刷新不闪屏、新旧视频入队/清理顺序及失败保留回归。
- `docs/change-release-ledger.md` — 本 mobile 变更单元与提交尝试记录。
- Paired root `root/CRL-20260817-001` records the FR-004 regression mapping only.

### Impact / Dependencies

- API / database / migration / configuration / storage policy / production data: none.
- Reuses the existing inspection media queue, its local private-copy persistence and delayed housekeeping; no raw URL or media authorization path changes.
- Related units: `root/CRL-20260817-001`.
- Excluded: 检查照片/补品业务门槛、后台 worker、保留期、删除接口、EAS build/OTA、部署及生产数据操作。

### Validation

- `NODE_PATH=<shared installed dependencies> .../.bin/jest --runInBand --no-cache src/screens/tasks/InspectionCompleteScreen.test.tsx` — passed in this clean candidate: 1 suite / 11 tests, including the new silent-refresh and failed-replacement retention cases.
- `npm run typecheck` and `npm run lint` — passed in the original workspace on the same modified refresh/replacement hunks before extraction; lint completed with 0 errors and 109 existing warnings. The clean candidate has no `node_modules`; no dependency install was performed without separate authorization.
- Candidate `git diff --check` and initial staged `git diff --cached --check` — passed.
- Root paired `npm run check:feature-registry` — passed in its clean candidate: 11 FRs / 128 mappings; 70 mobile mappings intentionally deferred by the root-only audit.

### Staged Commit Scope

- **Repository:** `mobile`
- **Status:** prepared
- **Untracked review:** none; clean candidate branch `codex/hang-key-video-20260817` starts from `origin/Dev@0b7249e8e9c25054fa711d79caeacec21dd6ecbe`.
- `src/screens/tasks/InspectionCompleteScreen.test.tsx` — SHA-256: `5f4d22f88f069c788c806d9752107ff2a60c68f0768de0709b510ba48efd45c9`
- `src/screens/tasks/InspectionCompleteScreen.test.tsx` — SHA-256: `a6c6f6a5a13d2d7e037acd8f8b78ee2712c372e3516eabfcea9be64d6e03ba2c`
- `src/screens/tasks/InspectionCompleteScreen.test.tsx` — SHA-256: `bc776a98f0b83c5345fea50d3d06f37f06dd47edc44c924f55eb87cd7533884a`
- `src/screens/tasks/InspectionCompleteScreen.test.tsx` — SHA-256: `c7306d8782604f25c73ab11d2f68ada67e1d2ed888d7cf94254b292c093b4df3`
- `src/screens/tasks/InspectionCompleteScreen.test.tsx` — SHA-256: `e148691d6066f0bad31b4d652f9e310928d1cc474da54fde9dbc692a8e74c65a`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `00ad151fa62f62a521e78a2d19863555f2b09ca9e0bc019f07a2e628d1a30033`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `05ef59577ebdf9333613ba36ac368d772bf702e92f4d46d095ae2e0310865605`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `127b0c581919741ed7f9aacfb6ddf47092610aad50077b56660f0804d8d57a16`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `1eef3c96ddb260039566d5c87f856848269fa70f2fa45d789e6a0bfe4b4e44f4`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `31a221c243b36827d86482658d6bc0528b10b5803d05ce55b81617b81c78c241`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `3f4e32a46a56c87a5d13f01b3a1564b30a978a4168ba393c1352ea06a9361bd5`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `7029005def0ba4d67c0a4641f4d4776ebd591fae5419a5121d5d39ca82fb5d62`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `82ab3e06e0ffaf5dcee5279c88c06007a98ab77c5f012adc7286ce4bbef29641`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `ace5a8366adf92ccaa0efc698d1864a5aa1c517d1bd5a11fbd298a4dff7d6400`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `bdf382c2a61c7e42398125ca0dd56372345da5b54deb1ba5b6708374094b575e`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `c6fc1ca8b2da62cae2fe6e06c70183777911a1ddfbfa8eb9b55a68addd578945`
- `src/screens/tasks/InspectionCompleteScreen.tsx` — SHA-256: `f81980c4c2d4e3e9f689b867f6a4b7c65db701b417a0cc93459249d525fb0e55`

### Release Attempts

#### RA-20260817-001

- Repository: `mobile`
- Selected CRLs: `CRL-20260817-001`
- Selected CRL identities: `mobile/CRL-20260817-001`
- Intended action: `commit`
- Branch: `codex/hang-key-video-20260817`
- Base: `origin/Dev@0b7249e8e9c25054fa711d79caeacec21dd6ecbe`; fetched at `2026-08-17 16:55:27 AEST`.
- Candidate patch SHA-256: `d40cd071ce8de23966afeb030a165f263b084408767f5b1e2665e8dbe974d3e6` excluding `docs/change-release-ledger.md`.
- Commit SHA: `269a485c5d91c1edf6bdc84d751a3095218bc1fe`.
- Dependencies: paired `root/CRL-20260817-001` provides FR-004 registration only; no backend deployment dependency.
- Required validation: PASS; evidence: clean-candidate 11-test screen regression and diff check; the same source hunks previously passed mobile typecheck/lint without an error.
- Shared-hunk review: PASS; evidence: only the 17 declared screen/test textual hunks are staged in a clean mobile candidate; no unselected content hunk is staged.
- Generated-file review: not applicable; no generated path is staged.
- Technical state: `committed`
- User authorization: `selected-for-commit`; evidence: user selected `mobile/CRL-20260817-001` and instructed “先提交这个” on 2026-08-17.
- Independent review: GO; evidence: independent read-only review of the exact base, candidate fingerprint, staged scope, full diff and validation found no P0/P1; it accepted one P2 about a retained old queue item after cleanup failure and approved the commit action only.
- Action conclusion: GO; blockers: none for the authorized local commit action.

#### RA-20260817-002

- Repository: `mobile`
- Selected CRLs: `CRL-20260817-001`
- Selected CRL identities: `mobile/CRL-20260817-001`
- Intended action: `push`
- Branch: `codex/hang-key-video-20260817`
- Base: `origin/Dev@0b7249e8e9c25054fa711d79caeacec21dd6ecbe`; refetched at `2026-08-17 17:13:15 AEST`.
- Candidate patch SHA-256: `d40cd071ce8de23966afeb030a165f263b084408767f5b1e2665e8dbe974d3e6` excluding `docs/change-release-ledger.md`.
- Commit SHA: `269a485c5d91c1edf6bdc84d751a3095218bc1fe`; audit head will be emitted by the final exact range report.
- Dependencies: paired `root/CRL-20260817-001` provides FR-004 registration only; no backend deployment dependency.
- Required validation: PASS; evidence: prior exact range report, clean-candidate 11-test screen regression and diff check; the same source hunks previously passed mobile typecheck/lint without an error.
- Shared-hunk review: PASS; evidence: the exact range contains only declared screen/test hunks and ledger receipts; no unselected content hunk is present.
- Generated-file review: not applicable; no generated path is in the exact range.
- Technical state: `pushed`
- Remote push evidence: `origin/codex/hang-key-video-20260817` accepted the exact audited head `e939986018bff4d5a73d5c79b5ba4c71fd25af82` at `2026-08-17 17:15:25 AEST`.
- User authorization: `approved-for-push`; evidence: after the exact root/mobile branch and commit SHAs were reported, the user instructed “推送” on 2026-08-17.
- Independent review: GO; evidence: independent read-only final push review rechecked the refetched base, exact range, candidate content commit, fingerprint, scope, validation and sensitive/generated-file evidence; it approved only this branch push.
- Action conclusion: GO; blockers: none for the authorized branch push after the final exact range report passes.

### Risks / Release Notes

- Risk: local tests prove the ordering and render contract, but do not prove real-device camera/library behavior or an OTA on the installed runtime.
- Rollback: revert only the two refresh/replacement hunks and their screen tests; do not restore pre-enqueue deletion.
- Accepted P2: if old-item cleanup fails after the new video is safely queued, the old item can remain retryable and may produce a duplicate business-save attempt. It cannot delete the new video or violate this unit's old-video-retention invariant.
- Sensitive-information review: no credentials, tokens, private URLs, media bytes, logs or production records are added.
- Git state: candidate branch only; not committed, pushed, published or device-verified.

## CRL-20260817-003 — P1-FDB-03 日用品更换前后私有照片认证读取（mobile）

- **Repository:** mobile
- **Status:** ready; source fixed and combined local regression passed
- **Updated:** 2026-08-17 Australia/Melbourne
- **Request:** 修复日用品更换前后照片在历史反馈中的认证读取和展示。
- **Outcome:** inventory 私有引用通过认证媒体代理；完成的日用品记录保留前后照片，缺少上下文时失败关闭。

### Implementation

- inventory 私有引用通过认证媒体代理；完成的日用品记录保留前后照片，缺少上下文时失败关闭。

### Files / Areas

- `src/lib/cleaningMedia.ts`
- `src/screens/tasks/FeedbackFormScreen.tsx`
- `src/screens/tasks/FeedbackFormScreen.test.tsx`
- `docs/feature-regression-registry.md`
- `docs/change-release-ledger.md`

### Impact / Dependencies

- 配对 root/CRL-20260817-003；不改角色、R2 ACL、通知或原生配置。

### Validation

- Combined targeted media regression: 3 suites / 29 tests passed; shared-reader regression: 10 suites / 114 tests passed.
- npm run typecheck, npm run lint, git diff --check and the combined ledger gate are recorded separately.

### Staged Commit Scope

- **Repository:** mobile
- **Status:** prepared.
- **Untracked review:** none; the clean candidate has no untracked files after exact staging.
- `docs/feature-regression-registry.md` — SHA-256: `8cca22975fab8886f5bc929af2026b2b724feca471a100c2ece6535f8111594a`
- `src/lib/cleaningMedia.ts` — SHA-256: `75fb22d22858b6bae8d6c2fc8fd3a9cc2510cb2aa82f81a511fe61ccf5664aa5`
- `src/lib/cleaningMedia.ts` — SHA-256: `25f6d8df2ec0b703c965c893fde7c6b6170cdf86c8737a0b5ce5206414b3229f`
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — SHA-256: `5c37c5cc64581fdb3793d0b5859053bb9d56e6c324d903cf44419fecbb14a656`
- `src/screens/tasks/FeedbackFormScreen.tsx` — SHA-256: `480d9ee317027e7775f7103947acd44a92f33362e72c96fd51efdc17b130085c`
- `src/screens/tasks/FeedbackFormScreen.tsx` — SHA-256: `37a989f12e31ccbda07f20aa7b46d161fed7228c02f5cdfd947796e7a2203c8c`
- `src/screens/tasks/FeedbackFormScreen.tsx` — SHA-256: `b474bb1d42ddd8f12c2b22749dc53356fd2291610c0b50239726603317842343`

### Release Attempts

#### RA-20260817-002

- Repository: `mobile`.
- Selected CRLs: `CRL-20260817-002`, `CRL-20260817-003`, `CRL-20260817-004`.
- Selected CRL identities: `mobile/CRL-20260817-002, mobile/CRL-20260817-003, mobile/CRL-20260817-004`.
- Intended action: `commit`.
- Branch: `codex/p1-fdb-fin-20260817-recovery`; target: `Dev`.
- Base: `origin/Dev@e285ad7679c913a0ca8fbe3b41b410542f143bc4`; fetched at `2026-08-17T15:15:48+10:00`.
- Candidate patch SHA-256: `d8b1adb8762a0842587c2dd35e2677675a1ec21738c07fc82a4a861451749542`, excluding `docs/change-release-ledger.md`.
- Commit SHA: not committed; candidate content commit will be recorded only after the content commit exists.
- Dependencies: paired `root/CRL-20260817-002`, `root/CRL-20260817-003` and `root/CRL-20260817-004`; root and mobile candidates must travel together.
- Required validation: PASS — targeted mobile media suites (29 tests), typecheck, lint, raw-private-URL audit, feature-registry and combined pre-commit gate passed on the latest Dev candidate.
- Shared-hunk review: PASS — deep-cleaning/inventory reader normalization stays exact-source scoped; finance uses a dedicated receipt reader.
- Generated-file / secret review: PASS — temporary dependency link was removed; no generated files, credentials, private media bytes, production logs or production data are staged.
- Technical state: `verified`.
- User authorization: `selected-for-commit`; evidence: user authorized the latest-Dev recovery after the stale-base stop.
- Independent review: GO for `commit` — independent read-only review rechecked the latest-Dev base, candidate fingerprint, CRL identity recovery, scoped diff, validation evidence and secret/production-write boundary.
- Action conclusion: `GO` for local commit only; push, PR, merge, deployment, OTA and device verification require separate authorization and evidence.

### Risks / Release Notes

- Recovery evidence: former unpushed candidate used colliding local IDs; this new canonical unit was rebuilt from `origin/Dev@e285ad7679c913a0ca8fbe3b41b410542f143bc4`.

- Source and local regressions do not prove historical object availability or release/runtime behavior.
- Sensitive-information review: no credentials, private URLs, media bytes, production logs or production data are recorded.

## CRL-20260816-006 — P1-NTF-02 钥匙照片通知真实事件认证读取（mobile）

- **Repository:** `mobile`
- **Status:** committed (local source and validation evidence)
- **Updated:** 2026-08-17 Australia/Melbourne
- **Request:** 修复仍显示灰图的“钥匙照片已上传”通知。生产事件实际使用 `key_photo_uploaded`，不得只修复不同语义的 `keys_hung`。
- **Outcome:** `key_photo_uploaded` 和保留兼容的 `keys_hung` 均从同一 Inbox `task_id` 进入既有认证媒体组件；列表、详情与大图使用同一任务上下文。缺失、空白或非字符串任务 ID 时不渲染、不请求私有媒体，也不退回裸 URL。

### Implementation

- Previous behavior: `mobile/CRL-20260815-001` 仅将 `keys_hung` 分类为任务私有媒体；生产后端“钥匙照片已上传”事件的真实 `kind` 为 `key_photo_uploaded`，因此仍落入原生 `Image` 直接加载私有引用而显示灰图。
- New behavior: 页面级 key 媒体分类同时覆盖 `key_photo_uploaded` 与 `keys_hung`，复用 `CleaningMediaImage` / `CleaningMediaPreview` 并传入经过严格规范化的 Inbox `task_id`。
- Key decisions: 不改 Root、通知生成、收件人、Inbox、Badge、Push、R2、对象关联、权限、共享媒体组件或私有媒体代理；保留 `keys_hung` 回归，防止“房间已挂钥匙”路径倒退。

### Files / Areas

- `src/screens/tabs/NoticesScreen.tsx`, `src/screens/notices/NoticeDetailScreen.tsx` — 真实钥匙照片事件在列表、详情和大图走认证读取。
- `src/screens/tabs/NoticesScreen.test.tsx`, `src/screens/notices/NoticeDetailScreen.test.tsx` — `key_photo_uploaded` 正向任务上下文与无效 ID 失败关闭回归，并保留 `keys_hung` 回归。
- `docs/feature-regression-registry.md` — P1-NTF-02 的真实事件类型与三入口不变量。
- `docs/change-release-ledger.md` — 本独立跟进修复单元。

### Impact / Dependencies

- API / database / config / R2 / production data: none; 复用 Root 已部署的 `KEY_PHOTO_UPLOADED` 载荷、`/cleaning-app/media/image`、`cleaning_task_media` 精确关联及 `canViewMzappRecordedCleaningMedia`。
- Shared dependencies: none modified. `CleaningMediaImage`、`CleaningMediaPreview` 与认证代理为共享依赖但仅复用；本修复停在通知页面分类边界。
- Related units: supersedes the incorrect mapping in `mobile/CRL-20260815-001`; historical source record `mobile/CRL-20260813-001`; Root is reuse-only.

### Validation

- `npm ci` — passed in the isolated candidate worktree using the locked dependency graph. The install reported 40 existing dependency audit advisories (2 low, 13 moderate, 23 high, 2 critical); no audit fix or tracked dependency change was made.
- `npm test -- --runInBand --no-cache src/lib/noticePresentation.test.ts src/lib/cleaningMedia.test.ts src/screens/tabs/NoticesScreen.test.tsx src/screens/notices/NoticeDetailScreen.test.tsx` — passed: 4 suites / 48 tests, including authenticated list/detail/viewer reads for both `key_photo_uploaded` and `keys_hung`, plus invalid task-ID fail-closed cases.
- `npm run typecheck` — passed.
- Targeted ESLint on the four changed screen/test files — passed with 0 errors. It reports 3 pre-existing React hook dependency warnings in `NoticesScreen.tsx`; no changed-line error was introduced.
- `npm run check:fast` — passed: ledger-range audit (25 tests), current ledger coverage, typecheck, full lint (0 errors / 109 warnings), strict button contract, and 3 fast suites / 18 tests.
- Feature-regression registry audit — NOT AVAILABLE: current Mobile Dev has no registry-audit script. The new registry entry was manually reviewed for CRL scope, exact event kinds, and test mapping.
- `python3 scripts/audit_change_release_ledger.py` and `git diff --check` — passed before commit preparation; rerun after staging this release-attempt evidence.
- Commit, push, PR, merge, deployment, OTA and device verification: not run.

### Staged Commit Scope

- **Repository:** `mobile`
- **Status:** prepared for selected `mobile/CRL-20260816-006` only.
- **Untracked review:** none; candidate branch `codex/p1-ntf02-key-photo-event-20260817` starts from clean `origin/Dev@8c24fe612c8d74b42c1c015b1437bd035818651f`.
- `docs/feature-regression-registry.md` — SHA-256: `24224c54ef9a4cdccc549a27b2ae4b71ed1aebe96c56576fe665e65db7104714`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `0f17a1aa9ac55a437040967f0a620e7632ddb28ce7b65e27a9d7790877d0d847`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `8c3a525a4032da187ce4e7f849ae2917d6d37c340c670ba1ab038e535f116528`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `d8624de73eff4d839b4f563fc78baf4a234d7cb437c4c3192431e4d52a651bbb`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `070e5af5ed58f5d0587104f92cd549d56aaa60cd81227593ed9b979bee21cbd1`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `4b7f6e6621842dc19d6135b4edfa08ac3aefb5138116302cebe87c42e8299b5a`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `4f25205c00c5d485db4fad4556239cff9e59fdafabf8eb5046d11693eb8f7f54`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `69fde8570752cb8dfc0dd3c6c90fd555cf660310946a2da861666e4cefb63366`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `754310d462b804e37f1eb2cd405e2ce0b98266521a858665522617eafcd80424`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `7ea7863724a3d3b8b1976cb72405a687716004955d131296c3f8857c754f49bd`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `9614215b5b39648b9146a9b197700c4bea1809d687eeb326cd0f5704521b9814`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `b58e9e12ace2e4c018adcf1907dea4842fdfe84b158e6672a251331cf17d5edd`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `bdae177cf9e565cdc8f4f934028cfd67ea2bee78b3354edfe08f6f6f54360950`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `063445c2e77d5ff635c654ddf25f1efeaa05d33f992f0e9e309b4c35e0e06d97`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `34b97fca8cf3517f7398611b246bd42633060df639349a82a424a6388ecd77fe`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `9ae60fa220f3d29943dcd5006ed54fa0825c0ec546a8b91a2558bbfff21ff314`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `cb60907246046fa59675da7e469caa0c4a579b803d011c6c979779c4b30bc38f`

### Release Attempts

#### RA-20260817-001

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-006`
- Selected CRL identities: `mobile/CRL-20260816-006`
- Intended action: `commit`
- Branch: `codex/p1-ntf02-key-photo-event-20260817`
- Base: `origin/Dev@8c24fe612c8d74b42c1c015b1437bd035818651f`; fetched at `2026-08-17 01:07:40 AEST`.
- Candidate patch SHA-256: `380fc997f53e17c3795338cdc32eceb10f71037a00e54b312c49dfb862dea3a8` excluding `docs/change-release-ledger.md`.
- Commit SHA: `39e7a196c0e9be13229dc8606bc4daceb2be3054`.
- Dependencies: Root authenticated media route and exact association are already deployed reuse-only; no Root candidate travels with this attempt.
- Required validation: PASS; evidence: targeted 48-test media/notice regression, typecheck and `check:fast` passed.
- Shared-hunk review: PASS; evidence: all staged non-ledger hunks are owned by this CRL and no shared media dependency is modified.
- Generated-file review: not applicable; no generated paths are staged.
- Technical state: `committed`
- User authorization: `selected-for-commit`; evidence: user instructed “提交” on 2026-08-17.
- Independent review: GO; evidence: independent read-only review of this exact base, candidate fingerprint, staged scope, complete diff and validation found no P0/P1 and approved the commit action only.
- Action conclusion: GO; blockers: none for the authorized local commit action.

#### RA-20260817-002

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-006`
- Selected CRL identities: `mobile/CRL-20260816-006`
- Intended action: `push`
- Branch: `codex/p1-ntf02-key-photo-event-20260817`
- Base: `origin/Dev@8c24fe612c8d74b42c1c015b1437bd035818651f`; fetched at `2026-08-17 01:19:52 AEST`.
- Candidate patch SHA-256: `380fc997f53e17c3795338cdc32eceb10f71037a00e54b312c49dfb862dea3a8` excluding `docs/change-release-ledger.md`.
- Commit SHA: `39e7a196c0e9be13229dc8606bc4daceb2be3054`; final ledger receipt head will be range-audited before push.
- Dependencies: Root authenticated media route and exact association are already deployed reuse-only; no Root candidate travels with this attempt.
- Required validation: PASS; evidence: targeted 48-test media/notice regression, typecheck and `check:fast` passed.
- Shared-hunk review: PASS; evidence: all non-ledger hunks are owned by this CRL and no shared media dependency is modified.
- Generated-file review: not applicable; no generated paths are in the candidate.
- Technical state: `committed`
- User authorization: `approved-for-push`; evidence: user explicitly confirmed on 2026-08-17 the `mobile` business candidate `39e7a196c0e9be13229dc8606bc4daceb2be3054` on branch `codex/p1-ntf02-key-photo-event-20260817` to `origin` only.
- Independent review: GO; evidence: independent read-only final push review rechecked this RA, the fetched base, candidate content commit, non-ledger fingerprint, exact scope, tests and sensitive/generated-file risk; it approved only the final branch push after this ledger receipt is committed and range-audited.
- Action conclusion: GO; blockers: none for the authorized branch push after the final exact range report passes.

### Risks / Release Notes

- This source repair cannot prove a historical object exists or that an authorized role can read it on a device; those remain post-release verification gates.
- Rollback: revert only the two `key_photo_uploaded` page-classification branches and their tests; do not restore raw private URL rendering.
- Sensitive-information review: no credentials, tokens, private URLs, media bytes, production logs or production data are added.
- Git state: content commit `39e7a196c0e9be13229dc8606bc4daceb2be3054` is local on `codex/p1-ntf02-key-photo-event-20260817`; this ledger receipt is pending commit. Not pushed, no PR, not merged, not deployed, no OTA published and no device verification.

## CRL-20260817-002 — P1-FDB-02 历史深清反馈私有照片认证读取（mobile）

- **Repository:** mobile
- **Status:** ready; source fixed and combined local regression passed
- **Updated:** 2026-08-17 Australia/Melbourne
- **Request:** 修复历史深清反馈照片未进入认证读取的移动端路径。
- **Outcome:** deep-cleaning 及 deep-cleaning-upload 只经现有认证媒体代理读取，并保留当前任务上下文；不回退私有 URL。

### Implementation

- deep-cleaning 及 deep-cleaning-upload 只经现有认证媒体代理读取，并保留当前任务上下文；不回退私有 URL。

### Files / Areas

- `src/lib/cleaningMedia.ts`
- `src/lib/cleaningMedia.test.ts`
- `src/screens/tasks/FeedbackFormScreen.test.tsx`
- `docs/change-release-ledger.md`

### Impact / Dependencies

- 配对 root/CRL-20260817-002；不改角色、R2 ACL、通知或原生配置。

### Validation

- Combined targeted media regression: 3 suites / 29 tests passed; shared-reader regression: 10 suites / 114 tests passed.
- npm run typecheck, npm run lint, git diff --check and the combined ledger gate are recorded separately.

### Staged Commit Scope

- **Repository:** mobile
- **Status:** prepared.
- **Untracked review:** none; the clean candidate has no untracked files after exact staging.
- `src/lib/cleaningMedia.test.ts` — SHA-256: `a687c020edc03b838b12117e14259d38b453942ce5eb87be5af5d1239204fb68`
- `src/lib/cleaningMedia.ts` — SHA-256: `75fb22d22858b6bae8d6c2fc8fd3a9cc2510cb2aa82f81a511fe61ccf5664aa5`
- `src/lib/cleaningMedia.ts` — SHA-256: `25f6d8df2ec0b703c965c893fde7c6b6170cdf86c8737a0b5ce5206414b3229f`
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — SHA-256: `b6dff5d78f81c57c6c401909bbec72ad582968aa10b7db8501e9b1b255ef177b`

### Release Attempts

#### RA-20260817-002

- Repository: `mobile`.
- Selected CRLs: `CRL-20260817-002`, `CRL-20260817-003`, `CRL-20260817-004`.
- Selected CRL identities: `mobile/CRL-20260817-002, mobile/CRL-20260817-003, mobile/CRL-20260817-004`.
- Intended action: `commit`.
- Branch: `codex/p1-fdb-fin-20260817-recovery`; target: `Dev`.
- Base: `origin/Dev@e285ad7679c913a0ca8fbe3b41b410542f143bc4`; fetched at `2026-08-17T15:15:48+10:00`.
- Candidate patch SHA-256: `d8b1adb8762a0842587c2dd35e2677675a1ec21738c07fc82a4a861451749542`, excluding `docs/change-release-ledger.md`.
- Commit SHA: not committed; candidate content commit will be recorded only after the content commit exists.
- Dependencies: paired `root/CRL-20260817-002`, `root/CRL-20260817-003` and `root/CRL-20260817-004`; root and mobile candidates must travel together.
- Required validation: PASS — targeted mobile media suites (29 tests), typecheck, lint, raw-private-URL audit, feature-registry and combined pre-commit gate passed on the latest Dev candidate.
- Shared-hunk review: PASS — deep-cleaning/inventory reader normalization stays exact-source scoped; finance uses a dedicated receipt reader.
- Generated-file / secret review: PASS — temporary dependency link was removed; no generated files, credentials, private media bytes, production logs or production data are staged.
- Technical state: `verified`.
- User authorization: `selected-for-commit`; evidence: user authorized the latest-Dev recovery after the stale-base stop.
- Independent review: GO for `commit` — independent read-only review rechecked the latest-Dev base, candidate fingerprint, CRL identity recovery, scoped diff, validation evidence and secret/production-write boundary.
- Action conclusion: `GO` for local commit only; push, PR, merge, deployment, OTA and device verification require separate authorization and evidence.

### Risks / Release Notes

- Recovery evidence: former unpushed candidate used colliding local IDs; this new canonical unit was rebuilt from `origin/Dev@e285ad7679c913a0ca8fbe3b41b410542f143bc4`.

- Source and local regressions do not prove historical object availability or release/runtime behavior.
- Sensitive-information review: no credentials, private URLs, media bytes, production logs or production data are recorded.

## CRL-20260816-005 — Build 26 TestFlight OTA 运行时合同门禁（mobile）

- **Repository:** `mobile`
- **Status:** ready
- **Updated:** 2026-08-16 Australia/Melbourne
- **Request:** 消除 Build 26 TestFlight OTA 因 `runtimeVersion.policy=fingerprint` 与历史安装 runtime 不同而反复误判为必须新建 Build 的人工发布问题。
- **Outcome:** 使用一个受控脚本在隔离最新 Dev 工作树中验证 Build 26 兼容范围、仅在 EAS 发布子进程期间临时绑定历史 runtime，并在正常或失败退出后恢复 `app.json`；原生/依赖配置变化一律失败关闭。

### Implementation

- Previous behavior: 发布人或自动化需要手动修改 `app.json` runtime，且普通发布手册把当前 fingerprint 与已安装 Build 26 runtime 混为同一个兼容性结论。
- New behavior: `scripts/testflight_build26_ota.mjs --check` 验证 `origin/Dev`、干净工作树、兼容基线与允许文件范围；`--publish --message` 才会临时绑定 Build 26 runtime、明确 iOS/TestFlight/production 发布，并校验 EAS 回执。默认不会发布。
- Key decisions: 常驻 `app.json` 仍保持 `runtimeVersion.policy=fingerprint`；不把历史 runtime 覆盖提交；任何 `app.json`、`eas.json`、依赖/lockfile、原生目录、插件或原生资源变化都需要新 Build 或单独兼容性评审。

### Files / Areas

- `scripts/testflight_build26_ota.mjs` — Build 26 OTA 合同、失败关闭预检、可逆 runtime 绑定与 EAS 回执核验。
- `scripts/tests/test_testflight_build26_ota.mjs` — 允许/阻断范围、临时绑定恢复、显式发布授权和回执边界回归。
- `docs/eas-update-release-runbook.md` — 将 Build 26 的受控命令列为唯一 TestFlight OTA 路径。
- `docs/change-release-ledger.md` — 本发布工具单元记录。

### Impact / Dependencies

- App/API/database/production data: none.
- Runtime: Build 26 的 `e5f4cc520509f2b64df725bf8eef5a9a42dc0e8a` 仅在隔离发布子进程内使用；常驻 fingerprint 策略不变。
- Dependencies: existing `npx eas-cli@latest`; no new package dependency.
- Related units: `mobile/CRL-20260814-004`, `mobile/CRL-20260815-001`, `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003`, `mobile/CRL-20260816-004`.

### Validation

- `node --test scripts/tests/test_testflight_build26_ota.mjs && node --check scripts/testflight_build26_ota.mjs` — passed: 5 tests; covers allowed/blocked path classification, required resting fingerprint policy, exact `app.json` restoration after a simulated publish failure, opt-in publish arguments and EAS receipt boundary.
- `npx eslint scripts/testflight_build26_ota.mjs scripts/tests/test_testflight_build26_ota.mjs` — passed: 0 errors.
- `node scripts/testflight_build26_ota.mjs --check` in this uncommitted candidate — failed closed as expected: refuses a dirty worktree before any remote fetch or EAS action.
- `npm run check:ci` — passed: 25 ledger-audit tests, TypeScript, lint (0 errors; 109 pre-existing warnings), button audit, and 56 Jest suites / 314 tests.
- `git diff --check` and `python3 scripts/audit_change_release_ledger.py` — passed: 4 changed files, all recorded.
- EAS OTA publication / server receipt / Build 26 download and real-device verification: not run.

### Staged Commit Scope

- **Repository:** `mobile`
- **Status:** prepared — this is the user-selected commit for `mobile/CRL-20260816-005` only.
- **Untracked review:** none; the three new script/test paths are deliberately staged, and no untracked path remains.
- `docs/eas-update-release-runbook.md` — SHA-256: `072e9a6913ccaab6bddebabacf000799ef6413b857d081781bade48f4714712d`
- `docs/eas-update-release-runbook.md` — SHA-256: `09425887db8bb10468c1eaf6b8cb8d7ab42d5d2adace7e7fcec74242621431ff`
- `docs/eas-update-release-runbook.md` — SHA-256: `0ed1723b30645b40031d318aca2ad38a4cd73fc3fbf35e25979b06ee5c238b86`
- `docs/eas-update-release-runbook.md` — SHA-256: `3d8f4284715c1ddbf9cd71401d556e84a677b419979918ba70b72bca97b3d54a`
- `docs/eas-update-release-runbook.md` — SHA-256: `40bd930dd005e9654e2feccb78990b64674c99f486a0489294b46e1ee7b24831`
- `docs/eas-update-release-runbook.md` — SHA-256: `94ed706c211a25c5e2c541a2f6bd676f23c3cf94155fc524f30d146c434bf137`
- `docs/eas-update-release-runbook.md` — SHA-256: `9fa8f6dbbcedf958491791e840ff4a37f4656955babc13ba143ccbd64d5a52ab`
- `docs/eas-update-release-runbook.md` — SHA-256: `f2fec7dd29d393fa892efd10f015ec7a9b68a68c23f801048eda3666d269c376`
- `scripts/testflight_build26_ota.mjs` — SHA-256: `e65991428a084dbc373a4f5b56d24152669cc6d6b8425781bfb516fa7f8213b3`
- `scripts/tests/test_testflight_build26_ota.mjs` — SHA-256: `0d82a51fc0a677779fb4d09c4192edffaf2b7ddae402b525425b945f9d269136`

### Release Attempts

#### RA-20260816-004

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-005`
- Selected CRL identities: `mobile/CRL-20260816-005`
- Intended action: `commit`
- Branch: `codex/build26-ota-runtime-contract-20260816`
- Base: `origin/Dev@77dacca0c96e07162bdbc314766acdfc7ddeb5c0`; fetched at `2026-08-16 22:36:01 AEST`.
- Candidate patch SHA-256: `a768b3c2c0533da0e2794b995ba32095b07e962bf93b6ae5cacc1bcde334deb2` excluding `docs/change-release-ledger.md`.
- Commit SHA: `6483ec75996ee88a8fcad64fd8c2f0550a4b2f17`; candidate content commit.
- Dependencies: Build 26 OTA runtime contract only; no Root candidate and no native/production change are included.
- Required validation: PASS — 5 dedicated Node tests, TypeScript, lint (0 errors; 109 existing warnings), `npm run check:ci` (56 Jest suites / 314 tests), diff check and ledger coverage passed.
- Shared-hunk review: PASS — the ten non-ledger hunk fingerprints are unique to this selected CRL; the `docs/eas-update-release-runbook.md` change is limited to its Build 26 contract section, and the ledger hunk is limited to this CRL entry.
- Generated-file review: not applicable — Node scripts, tests and Markdown only.
- Technical state: committed.
- User authorization: selected-for-commit — user requested `提交mobile/CRL-20260816-005`.
- Independent review: GO — independent read-only review verified the exact base, staged four-file scope, candidate patch fingerprint, ten hunk fingerprints, test evidence, fail-closed release behavior, no secret/production-write risk and no unrelated file; verdict is limited to this local commit action.
- Action conclusion: GO — candidate content was committed locally; a separate push attempt follows.

#### RA-20260816-005

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-005`
- Selected CRL identities: `mobile/CRL-20260816-005`
- Intended action: `push`
- Branch: `codex/build26-ota-runtime-contract-20260816`
- Base: `origin/Dev@77dacca0c96e07162bdbc314766acdfc7ddeb5c0`; fetched at `2026-08-16 22:44:49 AEST`.
- Candidate patch SHA-256: `a768b3c2c0533da0e2794b995ba32095b07e962bf93b6ae5cacc1bcde334deb2` excluding `docs/change-release-ledger.md`.
- Commit SHA: `6483ec75996ee88a8fcad64fd8c2f0550a4b2f17`; candidate content commit.
- Dependencies: Build 26 OTA runtime contract only; no Root candidate and no native/production change are included.
- Required validation: PASS — 5 dedicated Node tests, TypeScript, lint (0 errors; 109 existing warnings), `npm run check:ci` (56 Jest suites / 314 tests), diff check and ledger coverage passed.
- Shared-hunk review: PASS — the ten non-ledger hunk fingerprints are unique to this selected CRL; the `docs/eas-update-release-runbook.md` change is limited to its Build 26 contract section, and the ledger hunk is limited to this CRL entry.
- Generated-file review: not applicable — Node scripts, tests and Markdown only.
- Technical state: committed.
- User authorization: approved-for-push — user said `推送` after the exact candidate commit and branch were reported.
- Independent review: GO — independent read-only push review verified the exact base, candidate content commit, staged receipt-only scope, patch fingerprint, ten hunk fingerprints, test evidence, no secret/generated-file issue and no production-write risk; verdict is limited to this branch push.
- Action conclusion: GO — receipt may be committed, then the exact clean range must pass `--release-report` before push.

### Risks / Release Notes

- The wrapper restores `app.json` after ordinary command failure; it must only run inside a disposable, clean release worktree so an interrupted local process cannot affect a developer workspace.
- A successful EAS publication remains separate from Build 26 download/restart and role/device verification.
- Sensitive-information review: no secrets, credentials, tokens, `.env` values, private URLs, caches, logs or production data are stored.
- Git state: local candidate only; not committed, not pushed, no PR, not merged, no EAS OTA published and no device verification.

## CRL-20260816-004 — P1-NTF-05 线下任务完成通知认证媒体渲染（mobile）

- **Repository:** `mobile`
- **Status:** ready
- **Updated:** 2026-08-16 Australia/Melbourne
- **Request:** 修复 `work_task_completed` 的离线任务完成通知私有照片读取失败。
- **Outcome:** 仅完整 `cleaning_offline_tasks:<id>` 上下文通过认证组件展示；无效上下文失败关闭。

### Implementation

- Previous behavior: 列表、详情和大图直接读取私有 URL，缺少认证和精确工作任务上下文。
- New behavior: 使用 `CleaningMediaImage` / `CleaningMediaPreview` 并传递相同的 `accessWorkTaskId` 与 offline 标记。
- Key decisions: 不改变后端代理、R2、收件人、Inbox、Badge 或 Push；非离线 `work_task_completed` 不属于本修复。

### Files / Areas

- `src/screens/tabs/NoticesScreen.tsx`, `src/screens/notices/NoticeDetailScreen.tsx` — 离线任务完成通知三入口认证读取。
- `src/screens/tabs/NoticesScreen.test.tsx`, `src/screens/notices/NoticeDetailScreen.test.tsx` — 正向和失败关闭回归。
- `docs/feature-regression-registry.md` — P1-NTF-05 不变量与发布验证边界。
- `docs/change-release-ledger.md` — P1-NTF-05 发布证据。

### Impact / Dependencies

- API / database / config / storage / production data: none; reuse current `/cleaning-app/media/image`, `work_tasks.photo_urls` / `completion_photo_urls` exact association and authorization.
- Dependencies: Root private-media contract on `origin/Dev` is reuse-only. This CRL is independently selectable with `mobile/CRL-20260816-002` and `mobile/CRL-20260816-003`.

### Validation

- Individual candidate: targeted presentation/list/detail 24 tests, media component 26 tests, typecheck, lint, ledger and diff checks passed.
- Integrated candidate: 6 targeted Jest suites / 55 tests, TypeScript and lint passed; lint has 0 errors and 109 pre-existing warnings. `git diff --check` passed; `python3 scripts/audit_change_release_ledger.py` passed with 6 changed files and 6 recorded files.

### Staged Commit Scope

- **Repository:** `mobile`
- **Status:** prepared — this is the user-selected combined commit for `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003` and `mobile/CRL-20260816-004`; the source hunk contexts are shared across the three units.
- **Untracked review:** none; the clean candidate contains no untracked paths after the selected registry file was staged.
- `docs/feature-regression-registry.md` — SHA-256: `c2e685ce8b28ea1e2734141aa5f88fd1fd3b9e9f2ae31e7c68d9133833bc4a73`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `1c3ac94fc2e32d407e55669e67dca1e379fb85319717eabc561641357212c248`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `2c3206e81384f1cbd7732186c2118803aa7d1edcb2c09bd69c9df772607f92c5`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `7694c38cdbd1b1d1fbbeb0fec71302ab6385acd291ab91cde28c6b22784af37d`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `818647c6f0bbb446fbc9477536f9c2b8b999a2374cb0ea9b8984a20271acc380`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `a09f84300ef59bc88befcc8d552ffb7307000887c41fbc764639ff9bfd092f8d`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `cf348d77f624d1f69c20d64650d180812e07ebafc11abf5b3a26c7342c7620d8`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `e51e862b25880cbdd2e0aeb9a214dc421809152a6475f57b8a2122fc16bb3cb5`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `f2a854ceb18971cb801088b45b00ac5522e0face8b07988e20e2268a837e3d7d`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `f49da7cb5f1f18e7401a7379c5f23f8965e914e21daf8f5096e7f15684e53fe9`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `2b5e54cbe287f5d4ea0b6c9e842fc414d56ca815bb69a01620bbb90501f90ecd`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `7c678c12db307cc6c1eaa70ceaaf287b362a5ea004f2bcc32531c63efb1d0962`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `7f48cc3995cb8044605dc9b5958b464c66005ac1bfdbacb0ffffcd8bfbdea768`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `8628bb7cd58d7573d1f8dc53b85ccd2e682cea3e4484aa9adf9ae92df21ec98b`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `99f3a1428dd0cd8c51a4067779836bda881e7cf7cbdbd5e1f16121edb341f70b`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `c264b2cfb93c801db5ebc6c1562a1f90172d96efc4cd7daa4884524c45e984a1`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `e0f7a82be031a23273b30b9064d8a4682cadd2501b8a1241e914305f81b5f032`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `e2827e5079db0b94fd1df81f24858c7b0a197b43f8946fb96ea463e2fd0aa38d`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `76c95b5a60f0b4d977f8dfdff52d1e5ec2c76ef2308615a620739be3a4ae71a9`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `d053d3e9802813019e53b90f8bbc20fd7286cde5abb227b9b962f51b4c21832e`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `f0ac8ab4a4a0fcff6a3feda036f24088009add935a16a4aa3650f2ba6af071f3`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `03fcfa1388b51387c6429aaacbe4e1e2040bc6ff861aea2e0915d710f8899e35`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `6dcacdff647859bb16ba997376ece9777e7bd1ce77b59f30f55c31920e39943a`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `ae10a84e1d38f5faa2c077b55de23ca9f4cabfbb7900c75339183c3b9f5fad77`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `c6cd6a3afec3acea4958e7bd1e0e398b9abbdea96a56f107db11c591a644c6f1`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `d95d5ea1e1a54b0782658a9bc149815faef3152f9e2caee4c79d8a5e45ffe488`

### Release Attempts

#### RA-20260816-002

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-002`, `CRL-20260816-003`, `CRL-20260816-004`
- Selected CRL identities: `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003`, `mobile/CRL-20260816-004`
- Intended action: `commit`
- Branch: `codex/p1-ntf-03-05-media-20260816`
- Base: `origin/Dev@aa50085f7dc5e6ceb2dfafd72b44f68a55e92ab3`; fetched at `2026-08-16 15:19:53 AEST`.
- Candidate patch SHA-256: `1817f9bd51ac773465cb0713b9ca98e187246bef50572378cef1167e2d306b35` excluding `docs/change-release-ledger.md`.
- Commit SHA: `7251ae2e7c05b199527bcf7a285518457ffbe178`; candidate content commit.
- Dependencies: current Root private-media proxy is reuse-only; no Root candidate is included.
- Required validation: PASS — 6 target Jest suites / 55 tests, TypeScript, lint (0 errors; 109 existing warnings), diff check and current ledger coverage passed.
- Shared-hunk review: PASS — all 26 non-ledger hunks are explicitly declared for this user-selected combined candidate; no unselected CRL files are staged.
- Generated-file review: not applicable — TypeScript source, tests and Markdown only.
- Technical state: committed.
- User authorization: selected-for-commit — user said “提交” after the three exact mobile CRLs were reported.
- Independent review: GO — independent read-only review re-ran the declared six Jest suites (55 passing tests), verified the exact staged scope and found no P0/P1/P2; verdict is limited to this commit action.
- Action conclusion: GO — candidate content commit was created locally; push remains unauthorized.

#### RA-20260816-003

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-002`, `CRL-20260816-003`, `CRL-20260816-004`
- Selected CRL identities: `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003`, `mobile/CRL-20260816-004`
- Intended action: `push`; target: `origin/codex/p1-ntf-03-05-media-20260816`.
- Branch: `codex/p1-ntf-03-05-media-20260816`
- Base: `origin/Dev@aa50085f7dc5e6ceb2dfafd72b44f68a55e92ab3`; fetched at `2026-08-16 21:21:58 AEST` and unchanged.
- Candidate patch SHA-256: `1817f9bd51ac773465cb0713b9ca98e187246bef50572378cef1167e2d306b35` excluding `docs/change-release-ledger.md`.
- Commit SHA: `7251ae2e7c05b199527bcf7a285518457ffbe178`; candidate content commit; current audit head is `8a347448859dc93b37597d2e9a7d47c520fb77f1`.
- Dependencies: current Root private-media proxy is reuse-only; no Root candidate is included.
- Required validation: PASS — exact committed-range report for the commit attempt passed; 6 target Jest suites / 55 tests, TypeScript, lint (0 errors; 109 existing warnings), diff check and hunk scope passed.
- Shared-hunk review: PASS — 26 selected non-ledger hunks only; no unselected CRL file is in the exact committed range.
- Generated-file review: not applicable — TypeScript source, tests and Markdown only.
- Technical state: committed.
- User authorization: not-selected — the prior push approval was bound to `8a347448859dc93b37597d2e9a7d47c520fb77f1`; this ledger receipt will create a new head that requires a new exact push authorization.
- Independent review: GO — independent read-only review approved pushing the exact pre-receipt head `8a347448859dc93b37597d2e9a7d47c520fb77f1`; no P0/P1/P2 was found.
- Action conclusion: NOT VERIFIED — record the push-review receipt, then request authorization for its new exact head.

### Risks / Release Notes

- Source validation cannot prove deployed API, historical object presence, OTA compatibility or real-device rendering.
- Git state: uncommitted integration candidate; not pushed, no PR, deployment/OTA or device verification.



## CRL-20260815-001 — P1-NTF-02 挂钥匙通知认证媒体渲染（mobile）

- **Repository:** `mobile`
- **Status:** verified; selected-for-commit
- **Updated:** 2026-08-15 Australia/Melbourne
- **Request:** 修复 `keys_hung` 通知在信息中心列表、详情和大图直接读取私有 `cleaning/...` 引用导致照片无法显示的问题；本单元仅包含照片关联上下文和认证读取。
- **Outcome:** `keys_hung` 从同一 Inbox `data.task_id` 取得受控任务上下文，三处展示均使用既有认证媒体组件和 `/cleaning-app/media/image`。缺失、非字符串或空任务 ID 时不渲染、不请求私有照片；其他通知类型的当前展示不变。

### Implementation

- Previous behavior: `keys_hung` 与其他非临时通知共用 `<Image source={{ uri }}>`，私有 `cleaning/...` 引用没有携带 Bearer token 或 `source_task_id`，因此移动端不能经过后端媒体授权读取。
- New behavior: `normalizeCleaningTaskNoticeId` 仅接受受控字符串任务 ID。通知列表缩略图传入 `accessTaskId`；通知详情缩略图和 viewer 传入相同 ID。已有 `CleaningMediaImage` / `CleaningMediaPreview` 负责认证请求、缓存和失败显示。
- Key decisions: 不修改通知收件人、Inbox、Badge、Push、任务导航、R2 权限或后端 `cleaning_task_media` 授权；不为私有照片保留裸 URL 回退。

### Files / Areas

- `src/lib/cleaningMedia.ts`, `src/lib/cleaningMedia.test.ts` — Inbox 任务媒体上下文的严格字符串规范化与回归。
- `src/screens/tabs/NoticesScreen.tsx`, `src/screens/tabs/NoticesScreen.test.tsx` — `keys_hung` 列表缩略图认证读取和无效 ID 失败关闭。
- `src/screens/notices/NoticeDetailScreen.tsx`, `src/screens/notices/NoticeDetailScreen.test.tsx` — `keys_hung` 详情缩略图、大图认证读取和无效 ID 的零渲染边界。
- `docs/change-release-ledger.md` — 本独立恢复单元与 staged hunk 范围。

### Impact / Dependencies

- Backend contract: 复用已存在的 `cleaning_task_media` 精确关联及 `canViewMzappRecordedCleaningMedia` 授权；此单元不修改 Root。该路由在错误/无关联/越权时保持 `403 forbidden_media`，已授权但对象缺失时保持 `404 media_not_found`。
- Grouped release: 可与 `mobile/CRL-20260814-004` 和其配对的 `root/CRL-20260814-003` 同轮候选提交，但每个 CRL 保持独立测试和 review 证据。
- Database / migration / configuration / storage / production data: none.
- Excluded: 补货、发现问题、Photo ID/Visa、收件人 policy、Inbox/Badge/Push 治理、OTA 和真机验证。

### Validation

- `npm test -- --runInBand --no-cache src/lib/cleaningMedia.test.ts src/components/CleaningMediaPreview.test.tsx src/components/GuestLuggageCard.test.tsx src/screens/tabs/NoticesScreen.test.tsx src/screens/notices/NoticeDetailScreen.test.tsx` — passed: 5 suites / 39 tests; covers `keys_hung` list, detail and preview task-context propagation plus non-string ID zero-render.
- `npx tsc --noEmit` — passed.
- `git diff --check` — passed.
- `npm run lint` — passed: 0 errors, 109 pre-existing warnings.
- Independent review, staged audit, commit, push, PR, merge, backend deployment, OTA and real-role device verification: not run.

### Staged Commit Scope

- **Repository:** `mobile`
- **Status:** prepared for selected `mobile/CRL-20260815-001` only.
- **Allowed paths:** only the six non-ledger paths listed in **Files / Areas** plus this ledger section. Shared test files contain separate `mobile/CRL-20260814-004` hunks; they must be staged and audited by exact hunk ownership.
- **Untracked review:** no candidate source files expected.
- Shared zero-context hunks with `mobile/CRL-20260814-004` are intentionally selected only as the combined P1 commit; the same fingerprints are recorded in that paired scope for the exact union gate.
- `src/lib/cleaningMedia.test.ts` — SHA-256: `b1e5aa5060a1515df2157df64dd3c359bc3fbbb1b7f0263ccc061c560de80cb9`
- `src/lib/cleaningMedia.ts` — SHA-256: `a4c15db59f6150ac251cf7baf29e9c25689172ff0e66279595b2e204218ed9ec`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `b5fe994835167303fcd55f1d3388dd66ac5b7458d4cf10bfffadc61e38e98053`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `800bf8cb1e210b3f886122f274e363c5543139d2fe5daf4cfe6789fe2b1d7845`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `703ca8bc7149c2d0e99b3d07f0b781e0d4c01c52f9056a6e0d5d31b64c1d489f`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `9a875952f112d886fcc90135bf6073fe248d7c22e6529c6b661a212731651a34`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `17ad257384a1b824179f3863b3893b346526ede8295ebc8d353cd9f8e35ca173`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `5cf643e166c329926af8acec4f3763d3bb53932ffc959dd92ab29bed2b0498cc`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `a8aacc79d19113d262daf693c3cb57943296112e1399da51255e67288a619960`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `c3f45e29fe1e82bed32539d4ff77b59a6c6b5baafe37a7cf7d47a0c7e17e0244`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `301104578b63f6409294ac655c98bb71dda4122a30854b2e17bfa23048e2465b`

### Release Attempts

#### RA-20260815-p1-ntf01-ntf02-mobile-01

- Repository: `mobile`
- Selected CRLs: `CRL-20260814-004`, `CRL-20260815-001`
- Selected CRL identities: `mobile/CRL-20260814-004`, `mobile/CRL-20260815-001`
- Intended action: `commit`
- Branch: `codex/p1-ntf01-ntf02`
- Base: `origin/Dev@7ecdbf5114a61ecf951efde194d0a56eeccc2982`; fetched at 2026-08-15T01:16:00+10:00 Australia/Melbourne.
- Candidate patch SHA-256: `3f256dbe7be01a7b3a9839636f10fc0872cc208037ee9d071545dc603fd112b5`, excluding `docs/change-release-ledger.md`.
- Commit SHA: `d52658c020deb50c8602d9154058cfd932aac264` (candidate content commit; exact audit head follows in the range report).
- Dependencies: `root/CRL-20260814-003` provides the paired P1-NTF-01 exact-association authorization; P1-NTF-02 reuses the already-deployed task-media authorization contract without Root source changes.
- Required validation: `PASS` — focused Mobile Jest, typecheck, lint, ledger coverage audit, whitespace check and exact staged pre-commit audit passed.
- Shared-hunk review: `PASS` — selected P1-NTF-01/02 zero-context hunks are declared jointly and restricted to the 39 exact selected fingerprints; no unselected hunk is in the candidate.
- Independent review: `GO` for this commit action only.
- Technical state: `committed`.
- User authorization: `selected-for-commit`.
- Action conclusion: `GO` — selected content commit created locally; push remains unauthorized.

#### RA-20260815-p1-ntf01-ntf02-mobile-02

- Repository: `mobile`
- Selected CRLs: `CRL-20260814-004`, `CRL-20260815-001`
- Selected CRL identities: `mobile/CRL-20260814-004`, `mobile/CRL-20260815-001`
- Intended action: `push`; target: `Dev`.
- Branch: `codex/p1-ntf01-ntf02`
- Base: `origin/Dev@7ecdbf5114a61ecf951efde194d0a56eeccc2982`; fetched at `2026-08-15T01:30:38+1000 AEST` and unchanged.
- Candidate patch SHA-256: `3f256dbe7be01a7b3a9839636f10fc0872cc208037ee9d071545dc603fd112b5`, excluding `docs/change-release-ledger.md`.
- Commit SHA: `d52658c020deb50c8602d9154058cfd932aac264` (candidate content commit; exact audit head is emitted by the release report).
- Dependencies: paired `root/CRL-20260814-003` content commit `ac1f00723384583e323516a94b22ef49bb654a1f`; P1-NTF-02 adds no Root source change.
- Required validation: `PASS` — focused Mobile Jest, typecheck, lint, whitespace, current-ledger and exact committed-range audits passed.
- Shared-hunk review: `PASS` — 39 selected non-ledger fingerprints only; no unselected hunk is in the candidate.
- Generated-file review: `PASS` — no generated outputs, credentials, environment data, media payloads or production data are selected.
- Technical state: `pushed`.
- User authorization: `approved-for-push`; evidence: user instructed “两个一起推送吧” on 2026-08-15 after the exact Mobile branch, candidate content commit and audit head were presented; limited to this branch and paired Root branch, not to PR, merge, deployment or OTA.
- Independent review: `GO` for `push` — independent read-only review verified the exact committed source range, candidate fingerprint, selected CRL identity, generated/sensitive-file boundary and the receipt-only staged hunk; no P0/P1/P2 finding.
- Remote branch / SHA: `origin/codex/p1-ntf01-ntf02@56257b08c5219d1c9be8dbabee2a8a54ee05343b`, verified immediately after the fast-forward source-range push.
- Action conclusion: `GO` for push completed; PR, merge, deployment, OTA and device verification remain separate and unperformed.

### Risks / Release Notes

- Historical Inbox rows without a valid string `task_id` now suppress their private photo rather than attempting a raw URL. This is intentional fail-closed behavior; a server-backed refresh is required to obtain an eligible current record.
- This repair cannot grant access: the backend remains the authority for the exact recorded task medium and reader role. Runtime proof still requires an authorized account to test list → detail → viewer after a compatible OTA/build.
- Sensitive-information review: no credentials, tokens, private URLs, media bytes, logs, caches or production data are added.
- Git state: candidate worktree only; not committed, not pushed, no PR, not deployed, no OTA and no device verification.

## CRL-20260816-003 — P1-NTF-04 房源问题通知认证媒体渲染（mobile）

- **Repository:** `mobile`
- **Status:** ready
- **Updated:** 2026-08-16 Australia/Melbourne
- **Request:** 修复 `issue_reported` 通知私有问题照片读取失败。
- **Outcome:** 列表、详情和大图走认证媒体；任务关联问题传合法 `task_id`，普通房源反馈复用无任务上下文的既有反馈授权。

### Implementation

- Previous behavior: 通知入口直接渲染私有 URL。
- New behavior: `issue_reported` 通过 `CleaningMediaImage` / `CleaningMediaPreview` 读取，不新增权限。
- Key decisions: 不改后端代理、R2、收件人、Inbox、Badge 或 Push；保留精确关联、跨来源冲突拒绝和服务端角色授权。

### Files / Areas

- `src/screens/tabs/NoticesScreen.tsx`, `src/screens/notices/NoticeDetailScreen.tsx` — 问题反馈三入口认证读取。
- `src/screens/tabs/NoticesScreen.test.tsx`, `src/screens/notices/NoticeDetailScreen.test.tsx` — 房源反馈与任务关联问题回归。
- `docs/feature-regression-registry.md` — P1-NTF-04 不变量与发布验证边界。
- `docs/change-release-ledger.md` — P1-NTF-04 发布证据。

### Impact / Dependencies

- API / database / config / storage / production data: none; reuse current `/cleaning-app/media/image` property-feedback and `cleaning_task_media` authorization branches.
- Dependencies: `mobile/CRL-20260622-015` provided payload semantics; `mobile/CRL-20260815-001` established the renderer pattern. Both are reuse-only.

### Validation

- Individual candidate: targeted presentation/list/detail 23 tests, typecheck, lint, ledger and diff checks passed.
- Integrated candidate: shared 6 targeted Jest suites / 55 tests, TypeScript, lint and diff checks passed; `python3 scripts/audit_change_release_ledger.py` passed with 6 changed files and 6 recorded files.

### Staged Commit Scope

- **Repository:** `mobile`
- **Status:** prepared — this is the user-selected combined commit for `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003` and `mobile/CRL-20260816-004`; the source hunk contexts are shared across the three units.
- **Untracked review:** none; the clean candidate contains no untracked paths after the selected registry file was staged.
- `docs/feature-regression-registry.md` — SHA-256: `c2e685ce8b28ea1e2734141aa5f88fd1fd3b9e9f2ae31e7c68d9133833bc4a73`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `1c3ac94fc2e32d407e55669e67dca1e379fb85319717eabc561641357212c248`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `2c3206e81384f1cbd7732186c2118803aa7d1edcb2c09bd69c9df772607f92c5`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `7694c38cdbd1b1d1fbbeb0fec71302ab6385acd291ab91cde28c6b22784af37d`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `818647c6f0bbb446fbc9477536f9c2b8b999a2374cb0ea9b8984a20271acc380`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `a09f84300ef59bc88befcc8d552ffb7307000887c41fbc764639ff9bfd092f8d`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `cf348d77f624d1f69c20d64650d180812e07ebafc11abf5b3a26c7342c7620d8`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `e51e862b25880cbdd2e0aeb9a214dc421809152a6475f57b8a2122fc16bb3cb5`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `f2a854ceb18971cb801088b45b00ac5522e0face8b07988e20e2268a837e3d7d`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `f49da7cb5f1f18e7401a7379c5f23f8965e914e21daf8f5096e7f15684e53fe9`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `2b5e54cbe287f5d4ea0b6c9e842fc414d56ca815bb69a01620bbb90501f90ecd`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `7c678c12db307cc6c1eaa70ceaaf287b362a5ea004f2bcc32531c63efb1d0962`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `7f48cc3995cb8044605dc9b5958b464c66005ac1bfdbacb0ffffcd8bfbdea768`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `8628bb7cd58d7573d1f8dc53b85ccd2e682cea3e4484aa9adf9ae92df21ec98b`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `99f3a1428dd0cd8c51a4067779836bda881e7cf7cbdbd5e1f16121edb341f70b`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `c264b2cfb93c801db5ebc6c1562a1f90172d96efc4cd7daa4884524c45e984a1`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `e0f7a82be031a23273b30b9064d8a4682cadd2501b8a1241e914305f81b5f032`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `e2827e5079db0b94fd1df81f24858c7b0a197b43f8946fb96ea463e2fd0aa38d`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `76c95b5a60f0b4d977f8dfdff52d1e5ec2c76ef2308615a620739be3a4ae71a9`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `d053d3e9802813019e53b90f8bbc20fd7286cde5abb227b9b962f51b4c21832e`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `f0ac8ab4a4a0fcff6a3feda036f24088009add935a16a4aa3650f2ba6af071f3`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `03fcfa1388b51387c6429aaacbe4e1e2040bc6ff861aea2e0915d710f8899e35`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `6dcacdff647859bb16ba997376ece9777e7bd1ce77b59f30f55c31920e39943a`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `ae10a84e1d38f5faa2c077b55de23ca9f4cabfbb7900c75339183c3b9f5fad77`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `c6cd6a3afec3acea4958e7bd1e0e398b9abbdea96a56f107db11c591a644c6f1`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `d95d5ea1e1a54b0782658a9bc149815faef3152f9e2caee4c79d8a5e45ffe488`

### Release Attempts

#### RA-20260816-002

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-002`, `CRL-20260816-003`, `CRL-20260816-004`
- Selected CRL identities: `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003`, `mobile/CRL-20260816-004`
- Intended action: `commit`
- Branch: `codex/p1-ntf-03-05-media-20260816`
- Base: `origin/Dev@aa50085f7dc5e6ceb2dfafd72b44f68a55e92ab3`; fetched at `2026-08-16 15:19:53 AEST`.
- Candidate patch SHA-256: `1817f9bd51ac773465cb0713b9ca98e187246bef50572378cef1167e2d306b35` excluding `docs/change-release-ledger.md`.
- Commit SHA: `7251ae2e7c05b199527bcf7a285518457ffbe178`; candidate content commit.
- Dependencies: current Root private-media proxy is reuse-only; no Root candidate is included.
- Required validation: PASS — 6 target Jest suites / 55 tests, TypeScript, lint (0 errors; 109 existing warnings), diff check and current ledger coverage passed.
- Shared-hunk review: PASS — all 26 non-ledger hunks are explicitly declared for this user-selected combined candidate; no unselected CRL files are staged.
- Generated-file review: not applicable — TypeScript source, tests and Markdown only.
- Technical state: committed.
- User authorization: selected-for-commit — user said “提交” after the three exact mobile CRLs were reported.
- Independent review: GO — independent read-only review re-ran the declared six Jest suites (55 passing tests), verified the exact staged scope and found no P0/P1/P2; verdict is limited to this commit action.
- Action conclusion: GO — candidate content commit was created locally; push remains unauthorized.

#### RA-20260816-003

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-002`, `CRL-20260816-003`, `CRL-20260816-004`
- Selected CRL identities: `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003`, `mobile/CRL-20260816-004`
- Intended action: `push`; target: `origin/codex/p1-ntf-03-05-media-20260816`.
- Branch: `codex/p1-ntf-03-05-media-20260816`
- Base: `origin/Dev@aa50085f7dc5e6ceb2dfafd72b44f68a55e92ab3`; fetched at `2026-08-16 21:21:58 AEST` and unchanged.
- Candidate patch SHA-256: `1817f9bd51ac773465cb0713b9ca98e187246bef50572378cef1167e2d306b35` excluding `docs/change-release-ledger.md`.
- Commit SHA: `7251ae2e7c05b199527bcf7a285518457ffbe178`; candidate content commit; current audit head is `8a347448859dc93b37597d2e9a7d47c520fb77f1`.
- Dependencies: current Root private-media proxy is reuse-only; no Root candidate is included.
- Required validation: PASS — exact committed-range report for the commit attempt passed; 6 target Jest suites / 55 tests, TypeScript, lint (0 errors; 109 existing warnings), diff check and hunk scope passed.
- Shared-hunk review: PASS — 26 selected non-ledger hunks only; no unselected CRL file is in the exact committed range.
- Generated-file review: not applicable — TypeScript source, tests and Markdown only.
- Technical state: committed.
- User authorization: not-selected — the prior push approval was bound to `8a347448859dc93b37597d2e9a7d47c520fb77f1`; this ledger receipt will create a new head that requires a new exact push authorization.
- Independent review: GO — independent read-only review approved pushing the exact pre-receipt head `8a347448859dc93b37597d2e9a7d47c520fb77f1`; no P0/P1/P2 was found.
- Action conclusion: NOT VERIFIED — record the push-review receipt, then request authorization for its new exact head.

### Risks / Release Notes

- Historical rows without a photo reference cannot be repaired by rendering; deployed API and real-device proof remain outstanding.
- Git state: uncommitted integration candidate; not pushed, no PR, deployment/OTA or device verification.

## CRL-20260814-001 — 维修完工照片本地草稿与安全关联补充（mobile）

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Request:** 在不改变远端 CRL-20260808-001 不可变业务身份的前提下，为 R0 已证实仍留在原 mobile 工作树的独有维修完工照片草稿增量建立独立、可审计的本地 continuation。
- **Outcome:** 远端 CRL-20260808-001 保持原样；本记录只承接该 source-only delta 的归属，不迁移、覆盖或执行任何业务代码。
- **Source evidence:** R0 在原 mobile 工作树中确认 maintenance completion photo draft 模块及其针对性测试均有与 origin/Dev 不同且唯一的未提交增量。
- **Historical identity boundary:** local historical CRL-20260808-001 与远端 canonical ID 发生不可变身份冲突；本 CRL 是新编号 continuation，不重写远端身份。
- **Files / Areas:** `docs/change-release-ledger.md` — 仅记录归属和恢复前置条件；本 clean worktree 未包含业务代码。
- **Validation:** R0 content comparison and unique-path attribution completed. No business test was run because no business code was migrated.
- **Release state:** not selected; not committed; not pushed; no PR; not deployed; no OTA; device verification not run.
- **Risk / dependency:** 原 mobile 工作树仍是唯一源证据。任何恢复必须在单独 R1 授权中冻结 CRL、基线、语义、路径和 hunk allowlist。

## CRL-20260816-002 — P1-NTF-03 补货通知认证媒体渲染（mobile）

- **Repository:** `mobile`
- **Status:** ready
- **Updated:** 2026-08-16 Australia/Melbourne
- **Request:** 修复 `consumables_submitted` 与 `consumables_updated` 私有补货照片读取失败。
- **Outcome:** 同一 Inbox `task_id` 传给列表、详情与大图；缺失、空值或非字符串 ID 不渲染且不请求私有原始 URL。

### Implementation

- Previous behavior: 补货通知直接渲染 `cleaning/...` 私有引用。
- New behavior: 补货三入口使用 `CleaningMediaImage` / `CleaningMediaPreview` 的 `accessTaskId`。
- Key decisions: 不改后端、R2、数据表、收件人、Inbox、Badge、Push 或共享 viewer；保留服务端精确关联、歧义拒绝与角色授权。

### Files / Areas

- `src/screens/tabs/NoticesScreen.tsx`, `src/screens/notices/NoticeDetailScreen.tsx` — 补货三入口认证读取。
- `src/screens/tabs/NoticesScreen.test.tsx`, `src/screens/notices/NoticeDetailScreen.test.tsx` — 正向与失败关闭回归。
- `docs/feature-regression-registry.md` — P1-NTF-03 不变量与发布验证边界。
- `docs/change-release-ledger.md` — P1-NTF-03 发布证据。

### Impact / Dependencies

- API / database / config / storage / production data: none; reuse current `/cleaning-app/media/image`, consumables and task-media exact association / authorization.
- Dependencies: `mobile/CRL-20260815-001` renderer pattern and current Root proxy are reuse-only.

### Validation

- Individual candidate: targeted presentation/list/detail 24 tests, typecheck, lint, ledger and diff checks passed.
- Integrated candidate: shared 6 targeted Jest suites / 55 tests, TypeScript, lint and diff checks passed; `python3 scripts/audit_change_release_ledger.py` passed with 6 changed files and 6 recorded files.

### Staged Commit Scope

- **Repository:** `mobile`
- **Status:** prepared — this is the user-selected combined commit for `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003` and `mobile/CRL-20260816-004`; the source hunk contexts are shared across the three units.
- **Untracked review:** none; the clean candidate contains no untracked paths after the selected registry file was staged.
- `docs/feature-regression-registry.md` — SHA-256: `c2e685ce8b28ea1e2734141aa5f88fd1fd3b9e9f2ae31e7c68d9133833bc4a73`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `1c3ac94fc2e32d407e55669e67dca1e379fb85319717eabc561641357212c248`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `2c3206e81384f1cbd7732186c2118803aa7d1edcb2c09bd69c9df772607f92c5`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `7694c38cdbd1b1d1fbbeb0fec71302ab6385acd291ab91cde28c6b22784af37d`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `818647c6f0bbb446fbc9477536f9c2b8b999a2374cb0ea9b8984a20271acc380`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `a09f84300ef59bc88befcc8d552ffb7307000887c41fbc764639ff9bfd092f8d`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `cf348d77f624d1f69c20d64650d180812e07ebafc11abf5b3a26c7342c7620d8`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `e51e862b25880cbdd2e0aeb9a214dc421809152a6475f57b8a2122fc16bb3cb5`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `f2a854ceb18971cb801088b45b00ac5522e0face8b07988e20e2268a837e3d7d`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `f49da7cb5f1f18e7401a7379c5f23f8965e914e21daf8f5096e7f15684e53fe9`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `2b5e54cbe287f5d4ea0b6c9e842fc414d56ca815bb69a01620bbb90501f90ecd`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `7c678c12db307cc6c1eaa70ceaaf287b362a5ea004f2bcc32531c63efb1d0962`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `7f48cc3995cb8044605dc9b5958b464c66005ac1bfdbacb0ffffcd8bfbdea768`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `8628bb7cd58d7573d1f8dc53b85ccd2e682cea3e4484aa9adf9ae92df21ec98b`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `99f3a1428dd0cd8c51a4067779836bda881e7cf7cbdbd5e1f16121edb341f70b`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `c264b2cfb93c801db5ebc6c1562a1f90172d96efc4cd7daa4884524c45e984a1`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `e0f7a82be031a23273b30b9064d8a4682cadd2501b8a1241e914305f81b5f032`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `e2827e5079db0b94fd1df81f24858c7b0a197b43f8946fb96ea463e2fd0aa38d`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `76c95b5a60f0b4d977f8dfdff52d1e5ec2c76ef2308615a620739be3a4ae71a9`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `d053d3e9802813019e53b90f8bbc20fd7286cde5abb227b9b962f51b4c21832e`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `f0ac8ab4a4a0fcff6a3feda036f24088009add935a16a4aa3650f2ba6af071f3`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `03fcfa1388b51387c6429aaacbe4e1e2040bc6ff861aea2e0915d710f8899e35`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `6dcacdff647859bb16ba997376ece9777e7bd1ce77b59f30f55c31920e39943a`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `ae10a84e1d38f5faa2c077b55de23ca9f4cabfbb7900c75339183c3b9f5fad77`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `c6cd6a3afec3acea4958e7bd1e0e398b9abbdea96a56f107db11c591a644c6f1`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `d95d5ea1e1a54b0782658a9bc149815faef3152f9e2caee4c79d8a5e45ffe488`

### Release Attempts

#### RA-20260816-002

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-002`, `CRL-20260816-003`, `CRL-20260816-004`
- Selected CRL identities: `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003`, `mobile/CRL-20260816-004`
- Intended action: `commit`
- Branch: `codex/p1-ntf-03-05-media-20260816`
- Base: `origin/Dev@aa50085f7dc5e6ceb2dfafd72b44f68a55e92ab3`; fetched at `2026-08-16 15:19:53 AEST`.
- Candidate patch SHA-256: `1817f9bd51ac773465cb0713b9ca98e187246bef50572378cef1167e2d306b35` excluding `docs/change-release-ledger.md`.
- Commit SHA: `7251ae2e7c05b199527bcf7a285518457ffbe178`; candidate content commit.
- Dependencies: current Root private-media proxy is reuse-only; no Root candidate is included.
- Required validation: PASS — 6 target Jest suites / 55 tests, TypeScript, lint (0 errors; 109 existing warnings), diff check and current ledger coverage passed.
- Shared-hunk review: PASS — all 26 non-ledger hunks are explicitly declared for this user-selected combined candidate; no unselected CRL files are staged.
- Generated-file review: not applicable — TypeScript source, tests and Markdown only.
- Technical state: committed.
- User authorization: selected-for-commit — user said “提交” after the three exact mobile CRLs were reported.
- Independent review: GO — independent read-only review re-ran the declared six Jest suites (55 passing tests), verified the exact staged scope and found no P0/P1/P2; verdict is limited to this commit action.
- Action conclusion: GO — candidate content commit was created locally; push remains unauthorized.

#### RA-20260816-003

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-002`, `CRL-20260816-003`, `CRL-20260816-004`
- Selected CRL identities: `mobile/CRL-20260816-002`, `mobile/CRL-20260816-003`, `mobile/CRL-20260816-004`
- Intended action: `push`; target: `origin/codex/p1-ntf-03-05-media-20260816`.
- Branch: `codex/p1-ntf-03-05-media-20260816`
- Base: `origin/Dev@aa50085f7dc5e6ceb2dfafd72b44f68a55e92ab3`; fetched at `2026-08-16 21:21:58 AEST` and unchanged.
- Candidate patch SHA-256: `1817f9bd51ac773465cb0713b9ca98e187246bef50572378cef1167e2d306b35` excluding `docs/change-release-ledger.md`.
- Commit SHA: `7251ae2e7c05b199527bcf7a285518457ffbe178`; candidate content commit; current audit head is `8a347448859dc93b37597d2e9a7d47c520fb77f1`.
- Dependencies: current Root private-media proxy is reuse-only; no Root candidate is included.
- Required validation: PASS — exact committed-range report for the commit attempt passed; 6 target Jest suites / 55 tests, TypeScript, lint (0 errors; 109 existing warnings), diff check and hunk scope passed.
- Shared-hunk review: PASS — 26 selected non-ledger hunks only; no unselected CRL file is in the exact committed range.
- Generated-file review: not applicable — TypeScript source, tests and Markdown only.
- Technical state: committed.
- User authorization: not-selected — the prior push approval was bound to `8a347448859dc93b37597d2e9a7d47c520fb77f1`; this ledger receipt will create a new head that requires a new exact push authorization.
- Independent review: GO — independent read-only review approved pushing the exact pre-receipt head `8a347448859dc93b37597d2e9a7d47c520fb77f1`; no P0/P1/P2 was found.
- Action conclusion: NOT VERIFIED — record the push-review receipt, then request authorization for its new exact head.

### Risks / Release Notes

- Historical Inbox rows without valid task IDs deliberately suppress private media; source tests cannot prove historical object availability or device rendering.
- Sensitive-information review: no credentials, tokens, `.env` values, media bytes, production data or logs are added.
- Git state: uncommitted integration candidate; not pushed, no PR, deployment/OTA or device verification.

## CRL-20260814-002 — 当天任务临时通知照片本地草稿与认证读取补充（mobile）

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Request:** 在不改变远端 CRL-20260812-006 不可变业务身份的前提下，为 R0 已证实仍留在原 mobile 工作树的独有当天任务临时通知照片草稿增量建立独立、可审计的本地 continuation。
- **Outcome:** 远端 CRL-20260812-006 保持原样；本记录只承接该 source-only delta 的归属，不迁移、覆盖或执行任何业务代码。
- **Source evidence:** R0 在原 mobile 工作树中确认 guest luggage photo draft 模块及其针对性测试均有与 origin/Dev 不同且唯一的未提交增量。
- **Historical identity boundary:** local historical CRL-20260812-006 与远端 canonical ID 发生不可变身份冲突；本 CRL 是新编号 continuation，不重写远端身份。
- **Files / Areas:** `docs/change-release-ledger.md` — 仅记录归属和恢复前置条件；本 clean worktree 未包含业务代码。
- **Validation:** R0 content comparison and unique-path attribution completed. No business test was run because no business code was migrated.
- **Release state:** not selected; not committed; not pushed; no PR; not deployed; no OTA; device verification not run.
- **Risk / dependency:** 原 mobile 工作树仍是唯一源证据。任何恢复必须在单独 R1 授权中冻结 CRL、基线、语义、路径和 hunk allowlist。

## CRL-20260813-002 — 临时通知照片认证上下文闭环（mobile）

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-13 Australia/Melbourne
- **Request:** 配对修复当天任务临时通知照片：任务卡片、信息中心列表、详情和大图必须把相同 `guest_luggage_id` 交给认证图片读取；不得退回原始私有 URL，并与 root 的精确关联/授权修复一起交付。
- **Outcome:** `cleaningMedia`、`CleaningMediaImage` 和 `CleaningMediaPreview` 接收该受控上下文并生成认证代理参数。`GuestLuggageCard`、通知列表、详情和 viewer 全链路传递同一个通知 ID；钥匙照片通知继续使用 CRL-20260813-001 的认证组件，不传临时通知 ID。

### Implementation

- Previous behavior: 临时通知卡片缩略图和大图遗漏来源 ID，且预览会把 `mzapp/...` 引用转换为原始 URL；通知列表/详情虽改为认证组件，但未向共享读取器传递精确行上下文。
- New behavior: 仅 `guest_luggage_updated` 从服务端 Inbox `data.guest_luggage_id` 取值；其缩略图和 preview 使用同一值。任务卡片使用已保存通知 `id`。没有 ID 的读取不会创建 URL 级别的兼容回退，后端将安全拒绝。
- Key decisions: 复用现有认证媒体组件、缓存和终态错误显示；不增加客户端角色判断、公开链接、替代 viewer 或通知数据重写。

### Files / Areas

- `src/lib/cleaningMedia.ts` — 可选的 source-specific `guest_luggage_id` 认证参数。
- `src/components/CleaningMediaImage.tsx` — 缩略图透传该参数。
- `src/components/CleaningMediaPreview.tsx` — 预览透传该参数。
- `src/components/GuestLuggageCard.tsx` — 卡片缩略图/大图保留通知 ID，不转换私有引用为原始 URL。
- `src/components/GuestLuggageCard.test.tsx` — 卡片缩略图/大图的 ID 链路回归。
- `src/screens/tabs/NoticesScreen.tsx` — 临时通知列表读取上下文。
- `src/screens/tabs/NoticesScreen.test.tsx` — 临时通知列表 ID 链路回归。
- `src/screens/notices/NoticeDetailScreen.tsx` — 临时通知详情/preview 读取上下文。
- `src/screens/notices/NoticeDetailScreen.test.tsx` — 临时通知详情/preview ID 链路回归。
- `src/lib/cleaningMedia.test.ts` — 认证 URL 构造回归；钥匙照片认证读继续覆盖。
- `docs/change-release-ledger.md` — 本移动端配对单元记录。

### Impact / Dependencies

- API / database / configuration / storage: no new endpoint, schema, R2 setting or data mutation. Requires root CRL-20260813-002 backend to require and authorize the same ID.
- Notification governance: no change to NTF-006/NTF-017 generator, recipients, Inbox, Push, Badge or navigation.
- Shared dependency: all changed renderer calls retain their existing task/work-task/day-end contexts; the targeted renderer and proxy-construction regressions were rerun.
- Excluded: Photo ID/visa, financial receipts, other media sources, EAS build/OTA and production/device operations.

### Validation

- `npm test -- --runInBand --no-cache src/lib/cleaningMedia.test.ts src/components/GuestLuggageCard.test.tsx src/screens/tabs/NoticesScreen.test.tsx src/screens/notices/NoticeDetailScreen.test.tsx src/components/CleaningMediaPreview.test.tsx` — passed: 5 suites / 31 tests.
- `npm test -- --runInBand --no-cache` — passed: 57 suites / 342 tests. Existing `CleaningMediaPreview` feedback tests emit four `act(...)` warnings; no test fails.
- `npm run typecheck` — passed. `npm run lint` — passed with 0 errors and 109 existing warnings. `npm run check:buttons` — passed.
- Scoped `git diff --check` — passed.
- `npm run check:ci` — blocked at its first `check:ledger` step by pre-existing shared-ledger lineage drift: 18 remote CRLs absent locally and 19 historical immutable identities differ from fetched `origin/Dev`. Typecheck/lint/button/Jest were run independently above; no mobile release gate is green.

### Release Attempts

- None. No staging, commit, push, PR, OTA/build, backend deployment, production write or real-account device validation is authorized or performed.

### Risks / Release Notes

- Risk: old cached Inbox data without `guest_luggage_id` fails closed on refresh instead of exposing a private photo through a raw URL. The notification writer already includes this field; production refresh and all three roles must be verified after a coordinated deployment/OTA.
- Release block: this shared worktree currently reports `src/components/CleaningMediaPreview.tsx` as a staged deletion with an untracked working-copy replacement. The tested source is present, but it must be reconstructed in a clean release worktree; do not commit from this mixed index.
- Rollback: revert the paired mobile/root context contract together; do not retain raw URL fallback.
- Sensitive-information review: no token, credential, private URL, image bytes or production data is recorded.
- Git state: shared mobile worktree was already dirty; this unit is unstaged, uncommitted, unpushed, unpublished and not device-verified.

## CRL-20260812-013 — checkout 移动端服务端 Inbox 收件人收口（mobile）

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 执行通知治理阶段 5.2：移动端不能使用本地任务缓存二次判断收件人；服务端已授权的 Inbox 通知必须展示，Push 点击只消费同 event ID 的服务端 Inbox 记录。
- **Outcome:** `RootNavigator` 不再根据 `cleaner_id` / `inspector_id` / `assignee_id` 和本地任务缓存拒绝 Push 或过滤 Inbox 同步。前台 Push 只触发 Inbox 同步；点击回执只从同步返回的 server-owned notice 找同 event ID，并仅以该记录的数据决定通知详情或任务跳转。

### Implementation

- Previous behavior: `shouldShowTaskNoticeForCurrentUser()` 会按本地 task cache 和角色关系过滤五类任务通知；缓存无任务、改派后的旧关系或投影延迟时，客户端可把已授权 Inbox 记录排除。Push 点击还会直接信任原始 payload 继续任务导航。
- New behavior: 删除该 local recipient filter 和 `syncInboxNotifications(include)` 入口。`notificationInbox` 将每个服务端 Inbox row 原样映射/写入 notice store；RootNavigator 在响应场景只使用同步到的同 event ID notice 的 data，未找到时进入通知列表而不按原始 Push payload 跳任务。
- Protected behavior: 服务端的 Inbox read state、现有 notice-only/action 跳转、任务刷新和用户主动通知列表刷新继续保留；客户端不新建收件人规则或角色判断。

### Files / Areas

- `src/navigation/RootNavigator.tsx` — 去除 local task-cache recipient authorization；Push response 从同步的 Inbox notice 读取导航数据。
- `src/lib/notificationInbox.ts`、`src/lib/notificationInbox.test.ts` — 移除 include/filter API，测试 server-authorized checkout 即使无本地任务也会同步，并按 event ID 解析已授权 notice。
- `docs/change-release-ledger.md` — 本移动端配对单元记录。

### Impact / Dependencies

- API / database / migration / config: none. Continues to call existing authenticated Inbox API and Push registration APIs; no production reads/writes performed in this task.
- Paired root units: root `CRL-20260812-012` supplies the confirmed checkout server recipient contract; root `CRL-20260812-013` records the matching Registry/FR contract. Both must be deployed/released with this mobile unit before user-facing completion can be claimed.
- Excluded: server policy resolver, task cache behavior outside notification entry, Badge implementation, push registration, EAS/native build and real devices.

### Validation

- `npm run test -- --runInBand --no-cache src/lib/notificationInbox.test.ts` — passed (1 suite, 4 tests), including a server-authorized checkout row that has no matching local task cache and event-ID lookup of the synchronized authoritative notice.
- `npm run typecheck`, `npm run lint`, and `npm run check:buttons` — passed. Lint completed with 0 errors and 109 pre-existing repository warnings.
- `npm test -- --runInBand` — passed (56 suites, 338 tests). Four existing React `act(...)` console warnings in the `CleaningMediaPreview` feedback test remain unrelated to this notification unit.
- `npm run check:ci` — blocked before TypeScript/lint/Jest by its first `check:ledger` step: 16 remote CRLs are absent locally and 14 historical CRL identities differ. The remaining checks above were therefore run separately. Scoped `git diff --check` — passed; the direct mobile ledger audit has the same pre-existing block, so release coverage cannot be claimed.
- No API/network/Push/device flow is exercised locally.
- 阶段 7 真机前置（2026-08-12）— iPhone 13 已连接且 Developer Mode 可用；设备仅安装 MZStay 1.0.26 (Build 26)，不能加载这份未发布源码。EAS `development` profile 构建清单为空，且项目没有 `ios/` 原生目录或 `expo-dev-client` 依赖；未启动 App、登录、注册 token、触发 checkout 或发送 Push。创建仅供 dev 验收的 development build 需要用户单独授权，不能用 TestFlight 版本替代本单元证据。

### Release Attempts

- None. The user authorized local implementation only; no staging, commit, push, PR, EAS update/build, deployment or production operation is authorized.

### Risks / Release Notes

- Risk: a Push whose event ID is not returned by the latest Inbox sync now opens the notices list rather than trusting unverified raw payload for task navigation. This is intentional authorization fail-safe; real device Push timing remains unverified.
- CRL ID reconciliation: this uncommitted mobile unit was previously numbered `CRL-20260812-011`. It is paired with the root governance unit, so both are renumbered to `CRL-20260812-013` after fetched root `origin/Dev` showed that `008` and `009` are already reserved by unrelated units.
- Rollback: restore the removed client filter and include callback together; no server or stored notification data requires rollback.
- Sensitive-information review: no tokens, credentials, `.env` values, database URLs, device logs, private media or production records added.
- Git state: shared mobile worktree already contains extensive unrelated changes. This unit is unstaged, uncommitted, unpushed and undeployed.

## CRL-20260811-002 — 入住检查承接状态与延期展示修正（mobile）

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-11 11:02 Australia/Melbourne
- **Request:** 已承接的延期检查在移动端被错误显示为“已检查”；退房日须保留延期检查，承接日仅显示真实入住检查。
- **Outcome:** 移动端与服务端归一化投影一致：旧承接记录仍显示延期计划和原日期，实际 `checkin_clean` 显示“入住检查”，承接日不再出现重复延期卡。

### Files / Areas

- `src/lib/cleaningInspection.ts` — 归一化旧承接记录。
- `src/lib/cleaningInspection.test.ts` — 覆盖延期/真实完成显示边界。
- `src/screens/tabs/TasksScreen.tsx`, `src/screens/tasks/ManagerDailyTaskScreen.tsx` — 复用归一化结果，保留延期日期并明确入住检查。
- `docs/change-release-ledger.md` — 记录本独立 mobile 单元。

### Impact / Dependencies

- API: depends on root `CRL-20260811-002` 返回规范化承接字段；不改变请求、权限、离线队列或本地媒体。
- Database / migration / configuration: none.

### Validation

- `npm test -- --runInBand src/lib/cleaningInspection.test.ts` — passed: 1 suite / 4 tests.
- `npm run typecheck` — passed.
- `npx eslint src/lib/cleaningInspection.ts src/lib/cleaningInspection.test.ts src/screens/tabs/TasksScreen.tsx src/screens/tasks/ManagerDailyTaskScreen.tsx` — passed with 0 errors; existing warnings remain.
- Device, deployed backend, OTA/build and production verification — not run.

### Release Attempts

- None. This runtime correction is uncommitted and not selected for commit or push.

### Risks / Release Notes

- The client cannot correct a deployed backend that still sends the old `checked_done` projection; root and mobile must be released in the documented order.
- Sensitive-information review: no credentials, tokens, database URLs, guest data, media bytes, or production records are added.

## CRL-20260807-003 — 检查面板媒体稳定上传与终态重试隔离（mobile）

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-07 Australia/Melbourne
- **Request:** 执行照片规范阶段 5，修复检查面板上传未传稳定任务/媒体 ID，且 401/403/本地文件丢失会在联网、回前台或登录恢复时反复重试的问题。
- **Outcome:** 检查批次、检查后追加问题和检查批次中的反馈照片都使用稳定媒体身份上传；自动队列不会重传 401、403、缺本地文件、无稳定 ID 或幂等冲突的失败。仅用户主动重试可再次尝试 401。

### Implementation

- Previous behavior: 检查批次上传仅传 `purpose` 等显示元数据，R2 key 会由后端回退随机值；自动队列对失败步骤不分类，网络恢复/回前台可再次请求 401、403 或本地文件已丢失的上传，并可能继续执行依赖上传结果的业务保存。
- New behavior: 既有检查批次队列上传统一传 `cleaning_task_id + media_id`，检查后追加问题同样传入；检查批次反馈照片将新建的 `media_id` 持久化到既有 photo metadata，历史草稿使用不暴露路径的确定性兼容 ID。上传未成功时不再继续写补品、检查或反馈业务记录。401 可由用户明确重试一次，403/缺文件等终态失败只能保留原因并等待权限刷新或重建草稿。
- Key decisions: 不新增队列、缓存键、上传接口、数据库、依赖或 R2 直传；继续复用已有检查队列、Auth 恢复维护入口与本地文件保留/延迟清理机制。

### Files / Areas

- `src/lib/inspectionPanelSubmitQueue.ts` — 稳定上传元数据、历史反馈媒体兼容 ID、不可自动恢复错误的队列阻断、上传失败后的业务步骤依赖保护。
- `src/lib/inspectionPanelSubmitQueue.test.ts` — 覆盖稳定 ID、401/403/本地文件终态阻断及明确 401 重试。
- `src/lib/inspectionPanelFeedbackDraft.ts` — 检查批次反馈照片元数据持久化稳定 `media_id`。
- `src/screens/tasks/FeedbackFormScreen.tsx` — 检查批次模式新照片生成并保存稳定反馈媒体 ID。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — 覆盖检查批次反馈照片稳定媒体 ID 的本地持久化。
- `src/screens/tasks/InspectionPanelScreen.tsx` — 检查后问题照片上传传入稳定 ID；用户点击“重试同步”时才允许再次尝试 401。
- `src/screens/tasks/InspectionPanelScreen.test.tsx` — 覆盖检查后问题照片上传元数据。
- `docs/change-release-ledger.md` — 记录本 mobile 单元。

### Impact / Dependencies

- API: consumes paired root `CRL-20260807-005` 对检查领域上传的 `task_id` / `media_id` 强制契约；不新增客户端 API。
- Database / migration / config / dependencies: none.
- Protected behavior: 网络、超时和 5xx 保留现有可恢复重试；本地媒体不因失败删除。403/缺文件仍在现有失败详情中可见，用户可“放弃并重建草稿”。
- Related units: must release together with root `CRL-20260807-005`; server-first release would block old mobile inspection uploads.
- Production data / external sync: none read or written.

### Validation

- `npm run test -- --runInBand --no-cache src/lib/inspectionPanelSubmitQueue.test.ts src/screens/tasks/InspectionPanelScreen.test.tsx src/screens/tasks/FeedbackFormScreen.test.tsx` — passed: 3 suites / 41 tests. Jest emitted two existing `CleaningMediaPreview` asynchronous `act(...)` warnings; no test failed.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 112 existing warnings.
- `npm run check:buttons` — passed: no suspicious hard-coded button dimensions.
- Root upload diagnostics and backend no-emit typecheck — passed; see paired root `CRL-20260807-005`.
- `python3 scripts/audit_change_release_ledger.py` — passed: 104 changed files / 104 recorded.
- `git diff --check -- <current-task root/mobile paths>` — passed.

### Release Attempts

- None. User authorized implementation only; no staging, commit, push, PR, EAS build/OTA, deployment or production action is authorized.

### Risks / Release Notes

- Real iOS/Android login refresh, actual camera file loss, background/foreground recovery, deployed API compatibility and non-production R2 overwrite have not been run.
- Rollback: revert together with root `CRL-20260807-005`; no local migration or remote object deletion occurs.
- Sensitive-information review: no credentials, tokens, media bytes, raw private URLs, `.env` values, database URLs, logs or production data were added.
- Git state: shared mobile worktree was already extensively dirty; this unit is uncommitted and unrelated changes remain untouched.

## CRL-20260806-005 — Android 自适应启动图标安全区修复（mobile）

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-06 21:12 Australia/Melbourne
- **Request:** 安卓版本 App Logo 显示不全。
- **Outcome:** Android 启动器改用保留安全留白的自适应前景图，M/Z 标识不再贴近系统掩膜裁切边界；iOS 图标与 App 内业务界面不变。

### Implementation

- Previous behavior: `android.adaptiveIcon.foregroundImage` 直接使用铺满 1024px 画布的 `icon.png`，Android launcher 掩膜会裁掉贴近边缘的 M/Z 笔画；背景颜色也与黑色品牌底图不一致。
- New behavior: `adaptive-icon.png` 使用原有标识的确定性缩放透明前景版本，标识完整置于中央 620px 安全区；Android 配置引用该前景图并使用黑色背景。
- Key decisions: 只调整 Android launcher 资源与 Expo 配置；不修改 `icon.png`、iOS、版本号、EAS profile、应用逻辑、API、权限、任务状态或生产数据。

### Files / Areas

- `assets/adaptive-icon.png` — replaced Expo template grid with the existing MZ mark centered inside Android adaptive-icon safe padding as a transparent RGBA foreground.
- `app.json` — Android adaptive foreground path and matching black background.
- `docs/change-release-ledger.md` — records this mobile unit.

### Impact / Dependencies

- API / database / migration / dependencies / external sync: none.
- Config: Android native launcher resource only; it requires a new Android binary build to reach installed devices and cannot be delivered by a JavaScript-only OTA update.
- Protected behavior: authentication, task flow, weak-network queues, permissions, media, iOS icon, and App UI are unchanged.
- Production data: none read or written.

### Validation

- Expo resolved-config check — passed: foreground resolves to `./assets/adaptive-icon.png`, background to `#000000`, while the general/iOS icon remains `./assets/icon.png`.
- Deterministic asset inspection — passed: 1024 × 1024 RGBA PNG; non-transparent M/Z bounds are `x=213..807`, `y=258..737`, fully inside the `202..821` safe region.
- `npm run check:ci` — passed: mobile ledger coverage, TypeScript, ESLint (0 errors / 112 existing warnings), strict button audit, and 54 Jest suites / 299 tests.
- Launcher/emulator and physical Android verification — not run.

### Release Attempts

- None. The user requested a source repair only; no staging, commit, push, EAS build, OTA, deployment or production write is authorized.

### Risks / Release Notes

- Risk: actual launcher masks and OEM icon scaling still require installation on an Android device or emulator to prove the visual result.
- Rollback: restore the previous adaptive resource/configuration; no app data, server data or media is affected.
- Sensitive-information review: no credentials, tokens, `.env` contents, private-media data, device logs or production data were added.
- Git state: shared dirty mobile worktree; this unit's files are unstaged, uncommitted, unpushed and undeployed.

## CRL-20260806-003 — 补品照片本地可解码防线（mobile）

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-06 Australia/Melbourne
- **Request:** WSP3709B 的补品现场照片会被标记“已拍”但缩略图空白；在本地媒体保存后补上可解码验证。
- **Outcome:** 补品照片复制到 App 私有目录后，必须由原生图片解码器成功读取，才会返回给页面写入草稿；不支持或损坏的本地副本立即删除并提示重新拍摄，不能再显示为“已拍”。

### Implementation

- Previous behavior: 格式转换已返回新 URI 时，只确认目标文件存在；不能读取的 HEIC/JPEG 副本仍会写入草稿并在页面显示“已拍”。
- New behavior: `persistCompressedCleaningConsumablesPhoto` 在私有副本创建后调用 `Image.getSize` 验证正尺寸解码；失败使用稳定 `LOCAL_IMAGE_UNREADABLE` 错误，删除仅本次刚创建、尚未入草稿的副本并阻止页面状态更新。
- Key decisions: 保持相机、压缩、弱网队列、上传、任务状态和后端鉴权不变；不尝试自动修复已损坏的历史本地照片。

### Files / Areas

- `src/lib/imageCompression.ts` — 新增本地图片可解码断言和稳定错误码。
- `src/lib/cleaningConsumablesDraft.ts` — 补品私有副本保存后验证，失败时仅清理该未引用副本。
- `src/lib/imageCompression.test.ts` — 覆盖原生解码失败。
- `src/lib/cleaningConsumablesDraft.test.ts` — 覆盖副本验证成功、失败清理与拒绝返回。
- `src/screens/tasks/SuppliesFormScreen.test.tsx` — 覆盖不可解码照片不显示“已拍”。
- `docs/change-release-ledger.md` — 本独立移动仓库变更记录。

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Protected behavior: 捕获失败发生在页面草稿与队列之前；不会上传媒体、提交补品、改变任务状态或重试已有请求。
- Related units: FR-004；mobile `CRL-20260806-002` 仅处理上传失败诊断；root `CRL-20260806-005` 记录本次 FR 更新。
- Production data / external sync: none during implementation or validation.

### Validation

- `npm run test -- --runInBand --no-cache src/lib/imageCompression.test.ts src/lib/cleaningConsumablesDraft.test.ts src/screens/tasks/SuppliesFormScreen.test.tsx` — passed: 3 suites / 19 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 112 existing warnings.
- `python3 scripts/audit_change_release_ledger.py` — passed: 101 changed files / 101 recorded.
- `npm run check:feature-registry` (root) — passed: 13 FRs / 135 test mappings.
- `git diff --check -- <current-task paths>` — passed.
- EAS/native build, iOS/Android physical-device capture, weak-network, deployed API and production verification — not run.

### Release Attempts

- None. User authorized this implementation only; no staging, commit, push, PR, EAS update/build, deployment or production data write is authorized.

### Risks / Release Notes

- `Image.getSize` is a native-decoder gate; physical iPhone verification is still required before claiming the installed App is fixed.
- Existing blank local photos are not auto-deleted or repaired by this change; users should re-capture after receiving a compatible App build.
- Rollback: remove the post-copy assertion and its focused tests; no server, R2, task or submitted draft rollback is required.
- Sensitive-information review: no credentials, tokens, private-media bytes, user data, database URL or production logs were added.
- Git state: shared mobile worktree has extensive unrelated staged and unstaged changes; this unit is uncommitted, unpushed and undeployed.

## CRL-20260802-005 — 账户与联系人按钮契约收口

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-02 Australia/Melbourne
- **Request:** 为移动端台账审计归属已有账户、支出和联系人按钮契约改动，继续验证但不纳入延期检查通知发布范围。
- **Outcome:** 忘记密码、修改密码、支出操作与联系人拨号复用现有按钮/尺寸 token；提交、密码显示切换、支出选择和拨号行为保持原有调用路径。

### Files / Areas

- `src/screens/ForgotPasswordScreen.tsx` — shared submit button.
- `src/screens/me/ChangePasswordScreen.tsx` — shared submit/icon buttons.
- `src/screens/me/ExpenseCenterScreen.tsx` — existing action controls use shared button dimensions.
- `src/screens/tabs/ContactsScreen.tsx` — call action uses the shared icon-button touch frame.
- `docs/change-release-ledger.md` — this release unit.

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Related units: existing shared `AppButton` / `AppIconButton` contract; separate from CRL-20260801-011 and its notification dependencies.
- Production data: none read, written, synchronized or changed.

### Validation

- `npm run test -- --runInBand --no-cache src/components/ui/AppButton.test.tsx src/components/ui/AppIconButton.test.tsx` — passed: 2 suites, 4 tests.
- `npm run check:buttons` — passed; the four reviewed controls in this unit remain clear.
- `npm run check:ci` — passed: ledger 98/98, typecheck, lint 0 errors / 113 existing warnings, strict button audit, Jest 53 suites / 280 tests.

### Risks / Release Notes

- This is UI contract work only; no backend requests, permissions or payloads were changed.
- Selective release must keep these four screen hunks separate from concurrent screen edits.
- Sensitive-information review: no credentials, tokens, database URLs, contact data, logs or production data were added.
- Git state: uncommitted and unstaged in a concurrent mobile worktree.

## CRL-20260802-004 — 补品本地媒体清理引用保护

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-02 Australia/Melbourne
- **Request:** 为移动端台账审计归属补品媒体清理触发与 v2 引用键改动，并补充本地文件保护回归。
- **Outcome:** 登录、网络恢复和回到前台时，既有维护流程会处理已排队的补品媒体清理；本地清理在判断孤儿文件前识别补品 v2 队列、草稿和待清理记录中的 `file://` 引用，避免把仍被本机状态引用的媒体误判为孤儿。

### Files / Areas

- `src/lib/auth.tsx` — existing maintenance sequence includes pending consumables-media cleanup.
- `src/lib/localMediaHousekeeping.ts` — v2 queue, draft and cleanup storage keys are protected-reference sources.
- `src/lib/localMediaHousekeeping.test.ts` — v2 key recognition regression.
- `docs/change-release-ledger.md` — this release unit.

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Local state: may process already queued local cleanup tasks; it does not upload, synchronize or alter production data.
- Related units: FR-004 and existing `cleaningConsumablesDraft` cleanup queue behavior; separate from CRL-20260801-011.

### Validation

- `npm run test -- --runInBand --no-cache src/lib/localMediaHousekeeping.test.ts` — passed: 1 suite, 3 tests, including v2 queue/draft/cleanup keys.
- `npm run check:ci` — passed: ledger 98/98, typecheck, lint 0 errors / 113 existing warnings, strict button audit, Jest 53 suites / 280 tests.
- File deletion behavior on a device and authenticated app lifecycle — not run; must be validated before release because this unit participates in local file cleanup.

### Risks / Release Notes

- Local media removal is safety-sensitive: rollback only the listed maintenance/key-recognition hunks; do not delete local photos or drafts manually.
- Sensitive-information review: no media, credentials, tokens, database URLs, logs or production data were added.
- Git state: uncommitted and unstaged in a concurrent mobile worktree.

## CRL-20260802-003 — 媒体读取与上传诊断回归

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-02 Australia/Melbourne
- **Request:** 为移动端台账审计归属现有媒体读取/上传错误及管理详情照片诊断测试。
- **Outcome:** API 层继续把读取权限/网络错误交给调用方区分“读取失败”和“没有照片”；管理详情照片读取把权限与网络异常保留为可展示诊断，不伪装为空照片状态。

### Files / Areas

- `src/lib/api.test.ts` — media-read, upload diagnostic, retry and idempotency-error regressions.
- `src/lib/managerDailyTaskPhotos.test.ts` — permission/network photo-read diagnostics.
- `docs/change-release-ledger.md` — this release unit.

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Related units: FR-004 and the pre-existing media recovery implementation; separate from CRL-20260801-011.
- Production data: none read, written, synchronized or changed.

### Validation

- `npm run test -- --runInBand --no-cache src/lib/api.test.ts src/lib/managerDailyTaskPhotos.test.ts` — passed: 2 suites, 8 tests.
- `npm run check:ci` — passed: ledger 98/98, typecheck, lint 0 errors / 113 existing warnings, strict button audit, Jest 53 suites / 280 tests.
- Device media reads — not run.

### Risks / Release Notes

- Tests do not authorize remote-media or production reads; use the existing authorized media path for any device acceptance.
- Sensitive-information review: no tokens, credentials, database URLs, media content, local paths, sensitive logs or production data were added.
- Git state: uncommitted and unstaged in a concurrent mobile worktree.

## CRL-20260802-002 — 通知缓存冷启动恢复

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-02 Australia/Melbourne
- **Request:** 修复通知详情在本地缓存冷启动读取期间可能持续显示加载状态，确保延期检查冲突通知可稳定打开。
- **Outcome:** 通知存储把并发初始化合并为同一 Promise，读取失败不会把存储永久标记为已初始化；详情页在读取失败后结束加载并显示既有错误态，而不是无限 loading。缓存可读时仍正常展示详情。

### Implementation

- **Previous behavior:** `initNoticesStore` 在异步读取完成前就设置已初始化标记；并发入口可能获得未完成状态，读取失败后也无法重试。详情页没有初始化失败兜底，可能持续显示加载指示器。
- **New behavior:** 初始化完成后才设置已初始化状态；并发调用等待同一进行中的读取，失败后清理进行中 Promise 以允许下次重试。详情页捕获缓存初始化失败、刷新当前快照并结束加载。
- **Key decisions:** 复用现有 AsyncStorage、通知快照和错误页；不新增 API、推送通道、存储键、重试队列或依赖。

### Files / Areas

- `src/lib/noticesStore.ts` — modified: 并发初始化合并与失败后重试。
- `src/lib/noticesStore.test.ts` — modified: 并发读取仅一次、失败后可恢复的回归。
- `src/screens/notices/NoticeDetailScreen.tsx` — modified: 缓存初始化失败不再永久 loading。
- `src/screens/notices/NoticeDetailScreen.test.tsx` — modified: 显式等待已发起缓存读取后断言冷启动详情，避免异步 effect 的错误超时。
- `docs/change-release-ledger.md` — modified: 记录此独立移动端单元。

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Related units: root `CRL-20260801-011`、root `CRL-20260802-002`、mobile `CRL-20260802-001`；通知详情文件有并发 hunk，选择性发布必须逐 hunk 审核。
- Production data: none read, written, synchronized or changed.

### Validation

- `npm run test -- --runInBand --no-cache src/lib/noticesStore.test.ts src/screens/notices/NoticeDetailScreen.test.tsx src/lib/noticeNavigation.test.ts` — passed: 3 suites, 19 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors, 113 existing warnings.
- `git diff --check` for the scoped source/tests — passed.
- `npm run check:ci` and independent mobile ledger audit — passed: ledger 98/98, typecheck, lint 0 errors / 113 existing warnings, strict button audit, Jest 53 suites / 280 tests.
- Device / push service / EAS build / production validation — not run.

### Risks / Release Notes

- The cold-start cached detail contract is covered locally, but it is not proof of an authenticated device push → inbox sync → detail navigation flow.
- Rollback only this unit's store/detail/test hunks; do not delete notices, tasks, local photos or drafts.
- Sensitive-information review: no tokens, credentials, database URLs, notification content from production, cookies, private keys, sensitive logs or production data were added.
- Git state: independent mobile worktree has concurrent staged/unstaged changes; this unit is unstaged, uncommitted, unpushed and undeployed.

## CRL-20260802-001 — 延期检查冲突通知仅查看详情

- **Status:** pending-local
- **Reconciliation state:** LOCAL_UNCOMMITTED_VERIFIED
- **Reconciliation evidence:** R0 proves a distinct current source-worktree delta, but no business hunk is present in this clean ledger-only worktree.
- **Updated:** 2026-08-02 Australia/Melbourne
- **Request:** 延期检查冲突通知使用 `open_notice` 时，移动端必须只打开通知详情，不能从两个关联任务中任意路由第一条。
- **Outcome:** `open_notice`、`open_property_day_notice` 和 `property_day` 统一为 notice-only。推送点击保留在通知收件箱/详情，详情页不显示“查看任务”；普通任务通知保留原有任务路由。

### Implementation

- **Previous behavior:** `RootNavigator` 与 `NoticeDetailScreen` 分别只处理房源当日通知；`open_notice` 仍会从 `task_ids` 选择第一个任务并路由。
- **New behavior:** 两个入口复用无副作用的 `isNoticeOnlyAction`。延期检查冲突数据即使含两个任务 ID，也不会创建任务路由或显示任务按钮。
- **Key decisions:** 不修改后端通知 payload、任务/权限逻辑、推送注册、存储结构或 API；仅统一已有 action 的客户端语义。

### Files / Areas

- `src/lib/noticeNavigation.ts` — added: notice-only action 判定。
- `src/lib/noticeNavigation.test.ts` — added: conflict/property-day/普通任务 action 回归。
- `src/navigation/RootNavigator.tsx` — modified: 推送响应不为 notice-only action 构建任务路由。
- `src/screens/notices/NoticeDetailScreen.tsx` — modified: notice-only action 不显示“查看任务”。
- `src/screens/notices/NoticeDetailScreen.test.tsx` — modified: 延期检查冲突的多个任务 ID 停留通知详情。
- `docs/change-release-ledger.md` — modified: 记录此独立移动端单元。

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Related units: root `CRL-20260802-002`、root FR-010、existing mobile `CRL-20260801-001`；与详情和导航文件的其他并发 hunk 必须分开暂存。

### Validation

- `npm run test -- --runInBand --no-cache src/lib/noticeNavigation.test.ts` — passed: 3 tests.
- `npm run test -- --runInBand --no-cache src/screens/notices/NoticeDetailScreen.test.tsx` — partial: 新增延期冲突用例通过；既有持久化通知加载用例仍在 `ActivityIndicator` 失败。
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors, 113 existing warnings.
- `npm run check:ci` and `python3 scripts/audit_change_release_ledger.py` — passed: ledger 98/98, typecheck, lint 0 errors / 113 existing warnings, strict button audit, Jest 53 suites / 280 tests.
- Device / push service / EAS build / production validation — not run.

### Risks / Release Notes

- The persisted-notice loader failure was resolved by CRL-20260802-002; the combined local notification test set and the full independent-mobile `check:ci` now pass.
- No production notification, task, local photo, queue, token, credential, database URL or other sensitive data was read or changed.
- Rollback only this unit's helper/navigation/detail/test hunks; do not delete notices, tasks, media or local drafts.
- Git state: nested mobile worktree has concurrent staged/unstaged changes; this unit is unstaged, uncommitted, unpushed and undeployed.

## CRL-20260811-003 — 台账编号唯一性与已发布单元变更隔离（mobile governance）

- **Status:** reconciled-ledger-only
- **Reconciliation state:** LOCAL_LEDGER_ONLY
- **Reconciliation evidence:** The prior local ledger names this unit, but R0 found no separately provable current source-worktree content delta.
- **Updated:** 2026-08-11 Australia/Melbourne
- **Request:** 与 root 配对更新台账规则，阻止重复 CRL 编号，以及在已发布单元下追加新的移动端行为。
- **Outcome:** mobile 普通覆盖审计和精确发布报告均会拒绝重复编号，以及在 `pushed`、`merged` 或 `deployed` 证据后追加 `### Update` 行为变更；新的移动端修正必须单独建 CRL。

### Files / Areas

- `scripts/audit_change_release_ledger.py` — 普通审计增加台账结构门禁，发布报告复用相同规则。
- `scripts/tests/test_audit_change_release_ledger.py` — 覆盖重复编号和发布后行为更新的拒绝。
- `docs/change-release-ledger.md` — 记录本独立 mobile 治理单元。

### Impact / Dependencies

- Runtime / API / database / migration / configuration: none.
- Related root governance unit: root `CRL-20260811-003`; 两个仓库分别验证、提交和发布。

### Validation

- `python3 scripts/tests/test_audit_change_release_ledger.py` — passed: 11 tests, including duplicate-ID and published-CRL behavior-update rejection.
- `python3 scripts/audit_change_release_ledger.py` — passed: 108 changed files / 108 recorded files / Coverage PASS.
- paired root auditor regression/audit — passed: 11 tests; 148 changed files / 148 recorded files / Coverage PASS.
- scoped `git diff --check` — passed.

### Release Attempts

- None. This governance unit is uncommitted and not selected for commit or push.

### Risks / Release Notes

- The rule blocks ambiguous release evidence but does not alter existing business data, media, OTA, or deployed application behavior.
- Sensitive-information review: no credentials, tokens, database URLs, private media, logs, or production data are added.

## CRL-20260808-003 — 真机开发登录本地 API 连通修复（mobile）

- **Status:** reconciled-ledger-only
- **Reconciliation state:** LOCAL_LEDGER_ONLY
- **Reconciliation evidence:** The prior local ledger names this unit, but R0 found no separately provable current source-worktree content delta.
- **Updated:** 2026-08-08 Australia/Melbourne
- **Request:** 开发环境移动端登录显示“网络超时，请检查网络”，要求改到可用。
- **Outcome:** 真机开发会请求 Mac 的局域网 API 地址，不再把 `localhost` 解析为手机自身；本机后端继续使用现有 4002 端口。

### Implementation

- Previous behavior: 本地 Expo 环境覆盖 API 为回环地址；真机请求落到设备自身，登录在客户端 15 秒超时后失败。
- New behavior: 本地覆盖改为当前开发主机的局域网 IPv4 地址；不修改移动端登录请求、认证、角色、缓存、后端业务或 EAS profile。
- Key decisions: 仅修改被 Git 忽略的本机开发配置；不把局域网地址写入源码、EAS、Git 或本台账。

### Files / Areas

- `.env.local` — 本机开发 API 覆盖由回环地址调整为开发主机局域网地址（忽略文件，不纳入版本控制）。
- `docs/change-release-ledger.md` — 记录本机开发连通性修复，不记录环境值。

### Impact / Dependencies

- API / database / migration / dependencies: none.
- Config / environment: 仅当前开发机的 Expo 本地环境；重新加载 Metro 后生效。生产、TestFlight、preview 和 EAS profile 不受影响。
- Protected behavior: 既有 `/auth/login`、token、`/auth/me`、权限和离线队列不变。
- Related units: none.

### Validation

- Static configuration check — passed: local override is a private-LAN host, not a loopback host, and uses port 4002.
- `GET /health` through the development host LAN address — passed: HTTP 200; no credentials or business writes.
- `npm run start -- --clear --lan` — passed: Metro rebuilt its cache, loaded `.env.local`, and is serving the current project on the LAN Expo endpoint.
- Real device login — pending: requires Expo reload and an actual physical-device attempt; not inferred from local checks.
- Typecheck / lint / Jest — not run: no tracked mobile source or behavior changed.

### Release Attempts

- None. This is an ignored local development-environment repair; no staging, commit, push, PR, EAS build/OTA, deployment or production action is authorized.

### Risks / Release Notes

- The LAN address may change when the Mac changes networks; update only this ignored local file if it does.
- The phone and Mac must be on the same LAN, and firewall policy must permit inbound TCP 4002.
- Expo reported pre-existing package-version compatibility warnings during Metro startup; no dependency was changed for this narrow environment repair.
- Rollback: restore the previous local override; no server, user, database, cache or media data is changed.
- Sensitive-information review: no credentials, tokens, passwords, private keys, database URLs, device logs or environment values are stored in this ledger. The ignored `.env.local` file is not staged or committed.
- Git state: mobile worktree was already extensively dirty; this unit adds no tracked application source change.

## CRL-20260803-002 — 发布决策审计报告第二阶段

- **Status:** reconciled-ledger-only
- **Reconciliation state:** LOCAL_LEDGER_ONLY
- **Reconciliation evidence:** The prior local ledger names this unit, but R0 found no separately provable current source-worktree content delta.
- **Updated:** 2026-08-03 Australia/Melbourne
- **Request:** 执行发布候选治理改造第二阶段：为独立 mobile 仓库增加只读精确 Release Attempt 报告、Markdown/JSON 输出和隔离 Git fixture 回归。
- **Outcome:** mobile audit 现在支持 `--release-report --repo mobile --base --head --crl --format`。它只以 mobile 自己的 ledger 和 Git range 判断推送准入，不能把 root CRL、root 测试或 root report 误作 mobile 证据。

### Implementation

- **Previous behavior:** mobile audit 仅做当前工作区 path coverage，且 mobile AGENT 没有可执行的 exact range report 命令。
- **New behavior:** 无参数 coverage audit 保持兼容；`--release-report` 读取指定 mobile CRL 的 Release Attempt，检查 `origin/Dev` base、range、文件范围、共享 hunk、生成物、candidate content commit、hash、验证、审查、授权与敏感类别，并输出 Markdown/JSON。candidate hash 排除 ledger bookkeeping，完整 range 仍覆盖 ledger。
- **Key decisions:** 命令从不 fetch、改 ledger、stage、commit、push、PR、EAS、API 或生产数据。`GO` 仅表示指定 exact local range 的 push action 证据齐全；`BLOCKED` 与 `NOT VERIFIED` 均为非零退出。

### Files / Areas

- `scripts/audit_change_release_ledger.py` — added: mobile exact attempt report、structured output、gate evaluation and legacy coverage compatibility.
- `scripts/tests/test_audit_change_release_ledger.py` — added: mobile-local temporary Git fixture regression suite.
- `AGENTS.md`、`docs/codex-release-review.md` — 补充 candidate content commit/audit head 自引用边界和 mobile report 命令。
- `docs/change-release-ledger.md` — 记录本 mobile 第二阶段治理单元。

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Related units: depends on mobile `CRL-20260803-001`; paired with root `CRL-20260803-002`. Root evidence 必须明确记录为依赖 SHA，不能替代本仓库 report。
- Production data: none read, written, synchronized or changed.

### Validation

- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/tests/test_audit_change_release_ledger.py` — passed: 9 isolated Git fixture tests; legacy coverage sub-check passed with 0/0 in each fixture.
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/audit_change_release_ledger.py` — passed: Changed files 100; Recorded changed files 100; Coverage PASS.
- Scoped working-tree/index `git diff --check` for tracked Phase 1/2 mobile policy files — passed. Scoped trailing-whitespace scan, including new review/audit/test files, — passed: no findings.
- Real candidate report against the mixed mobile worktree, fetch/worktree creation, independent release review, commit, push, PR, EAS, device and production validation — not run; no mobile business CRL was selected.

### Release Attempts

- None. This CRL implements report/tooling only; it has no selected mobile business attempt, base, candidate content commit, push authorization or remote evidence.

### Risks / Release Notes

- **Evidence boundary:** the report consumes local Git and ledger evidence only. It cannot fetch a remote, prove an unrecorded user decision, run EAS or verify real mobile/device behavior.
- **Detection boundary:** configured generated/sensitive categories are a conservative gate, not a substitute for an independent review or secret-management control.
- **Rollback:** revert only this CRL's mobile audit/test/policy hunks; do not alter existing business code, EAS state, remote branches or production data.
- **Sensitive-information review:** no credentials, tokens, database URLs, cookies, private keys, sensitive logs, local caches or production data were added. Fixture tests use only a temporary `.env` path marker and do not print content.
- **Git state:** uncommitted and unstaged. The independent mobile worktree contains pre-existing staged/unstaged/untracked concurrent changes; no broad staging is permitted.

## CRL-20260803-001 — 发布决策契约第一阶段

- **Status:** reconciled-ledger-only
- **Reconciliation state:** LOCAL_LEDGER_ONLY
- **Reconciliation evidence:** The prior local ledger names this unit, but R0 found no separately provable current source-worktree content delta.
- **Updated:** 2026-08-03 Australia/Melbourne
- **Request:** 执行发布候选治理改造第一阶段：为独立 mobile 仓库固化技术状态、用户授权、动作准入和独立审查契约，不实施审计报告脚本或业务发布。
- **Outcome:** mobile 的 CRL 与 Release Attempt 现在明确分层；root 的状态、测试或审查不能替代 mobile 证据。只有指定 mobile commit 通过精确 range 审计且用户单独批准 push 后，attempt 才可称为 `push-ready`。

### Implementation

- **Previous behavior:** mobile 要求显式 push 授权，但没有完整定义 candidate、verified、committed 与授权/准入的独立状态，也没有独立的审查模板。
- **New behavior:** mobile `AGENTS.md` 定义 Release Attempt、技术状态、授权和 `GO` / `BLOCKED` / `NOT VERIFIED`；新增独立审查模板，固定候选清单输出和 clean release worktree 规则。
- **Key decisions:** mobile 是独立仓库；相关 root CRL/SHA 只能作为显式依赖记录。本阶段不改移动端业务、EAS、依赖、配置、API 或生产数据。

### Files / Areas

- `AGENTS.md` — 新增独立 mobile Release Decision Contract，更新现有 ledger 审计的边界说明。
- `docs/codex-release-review.md` — added: mobile 独立 Release Attempt 审查模板。
- `docs/change-release-ledger.md` — 记录本 mobile 治理单元。

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Related units: paired with root `CRL-20260803-001`; root `CRL-20260801-014` 仅为相关分支规则，不构成 mobile 发布证据。
- Production data: none read, written, synchronized or changed.

### Validation

- Scoped working-tree and index `git diff --check` for the tracked Phase 1 mobile policy files — passed.
- Scoped trailing-whitespace scan including the new untracked `docs/codex-release-review.md` — passed: no findings; `git diff --no-index --check /dev/null docs/codex-release-review.md` produced no whitespace diagnostic (its exit 1 only denotes a new file).
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/audit_change_release_ledger.py` — passed: Changed files 99; Recorded changed files 99; Coverage PASS. This existing audit checks worktree path coverage only, not the Phase 2 release report.
- Independent review / commit / push / PR / EAS / device / production validation — not run; no Release Attempt has been created.

### Release Attempts

- None. This CRL creates policy and review-template prerequisites only; it has no fetched base, candidate patch, commit, selection, push approval, or remote evidence.

### Risks / Release Notes

- **Adoption risk:** the new contract is documentary until Phase 2 adds a read-only release report and fixture tests; it must not be described as automated enforcement yet.
- **Compatibility:** existing CRL text is not backfilled. Historical `ready` or `pushed` text without an exact new Release Attempt remains `NOT VERIFIED` for a future release query.
- **Rollback:** revert only this CRL's mobile AGENT/review/ledger hunks; do not alter existing mobile business code, EAS state, remote branches or production data.
- **Sensitive-information review:** no credentials, tokens, database URLs, cookies, private keys, sensitive logs, local caches or production data were added.
- **Git state:** uncommitted and unstaged. The independent mobile worktree contains pre-existing staged/unstaged/untracked concurrent changes; no broad staging is permitted.

## CRL-20260811-001 — 移动端远端历史分支与重复 PR 清理

- **Status:** reconciled-ledger-only
- **Reconciliation state:** LOCAL_LEDGER_ONLY
- **Reconciliation evidence:** The prior local ledger names this unit, but R0 found no separately provable current source-worktree content delta.
- **Updated:** 2026-08-11 Australia/Melbourne
- **Request:** 整理 `mz-cleaning-app-frontend` 的远端分支，仅保留正式分支与尚有未决代码的候选分支。
- **Outcome:** 关闭重复的 PR #9，并删除 8 个已被 `Dev` 包含或无共同开发历史的远端分支；保留 `Dev`、`main` 和仍含未入库检查提交修复的 PR #11 分支。

### Implementation

- Previous behavior: 远端保留多个已合入 `Dev` 的历史 `codex/*` 分支、一个仅含旧 README 的 `Dev-app` 分支，以及一个重复的开放 PR。
- New behavior: PR #9 已关闭；`Dev-app`、`codex/cleaning-media-integrity-20260731`、`codex/governance-ledger-mobile-20260729`、`codex/offline-assignment-consistency-20260731`、`codex/phase3-mobile-ci-merge-gates`、`codex/release-mzstay-1-0-25-20260730`、`codex/release-selected-20260801-mobile` 和 `codex/release-selected-mobile-20260805` 已从远端删除。
- Key decisions: 不删除 `codex/checkin-inspection-stability-20260731`，因为其修复尚未进入 `Dev`；不执行合并、同步、本地分支删除、业务代码改动、部署或生产操作。

### Files / Areas

- GitHub PR #9 — closed without merge because its head commit was already contained in `Dev`.
- Remote refs — deleted only after containment/orphan verification.
- `docs/change-release-ledger.md` — records this repository-administration unit.

### Impact / Dependencies

- API / database / migration / config / dependencies / production data: none.
- Related candidate: PR #11 (`codex/checkin-inspection-stability-20260731`) requires a separate decision, clean `Dev`-based integration branch, ledger-conflict resolution and validation before any merge.

### Validation

- GitHub PR query — passed: PR #9 state changed from `open` to `closed` at 2026-08-11 12:19 AEST; it was not merged.
- `git push origin --delete <eight exact branch names>` — passed.
- `git ls-remote --heads origin` — passed: only `Dev@6539fb5`, `main@59e8059`, and `codex/checkin-inspection-stability-20260731@b67cd6e` remain.
- Application tests/typecheck/lint/build — not run: no application code, dependency, configuration, or build output changed.

### Release Attempts

- None. This is remote repository administration, not a content release; no commit, push of content, PR merge, EAS update/build, deployment, or production write was performed.

### Risks / Release Notes

- Rollback: each deleted branch can be recreated from its previously verified tip SHA if later needed; no source history or merged `Dev` content was removed.
- Sensitive-information review: no credentials, tokens, environment values, private media, logs or production records were added.
- Git state: the shared mobile worktree was already extensively dirty and 53 commits behind `origin/Dev`; its existing changes were neither synchronized nor staged.

## CRL-20260813-003 — 房源问题通知私有照片认证读取（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-13 Australia/Melbourne
- **Request:** 修复移动端信息中心“发现房源问题 / 维修”通知中的私有照片空白；`issue_reported` 的列表、详情和大图均走认证读取，不改变其他照片域或通知业务规则。
- **Outcome:** `issue_reported` 现在和既有钥匙/临时通知一样，缩略图使用 `CleaningMediaImage`、大图使用 `CleaningMediaPreview`。私有 `maintenance/`、`mzapp/` 和 `cleaning/` 引用经认证代理读取，公开历史地址继续由现有媒体构造器兼容处理。

### Implementation

- Previous behavior: `noticePresentation` 已将 `issue_reported` 的照片投影到 `notice.images`，但通知列表、详情和预览只识别钥匙与临时通知为认证媒体，导致反馈私有键被原生 `Image` 直连并显示空白。
- New behavior: 三个通知展示入口都将 `issue_reported` 纳入已有认证媒体分支；使用相同的缩略图和预览组件，保留组件的认证头、代理、缓存和 403/404 终态。
- Key decisions: 不创建新的 viewer、URL 规则、客户端权限判断或反馈媒体 API；不改 `noticePresentation`、收件人、任务导航、上传/草稿、后端授权和 R2 策略。

### Files / Areas

- `src/screens/tabs/NoticesScreen.tsx` — `issue_reported` Inbox 缩略图走认证媒体组件。
- `src/screens/tabs/NoticesScreen.test.tsx` — 私有 `maintenance/...` 问题通知缩略图回归。
- `src/screens/notices/NoticeDetailScreen.tsx` — `issue_reported` 详情缩略图和大图走认证组件。
- `src/screens/notices/NoticeDetailScreen.test.tsx` — 私有问题通知的详情/预览回归，取代公共 URL 假阳性测试。
- `docs/change-release-ledger.md` — 本 mobile 配对单元记录。

### Impact / Dependencies

- API / database / migration / configuration / storage: none. Reuses the existing authenticated `/cleaning-app/media/image` property-feedback path.
- Notification governance: NTF-008 `issue_reported` event, policy, recipient set, Inbox, Badge, Push, navigation and read state are unchanged.
- Dependency: paired root CRL-20260813-003 records the regression/surface contract. A deployed backend with the feedback-media association/authorization branch must precede any compatible OTA/build.
- Excluded: Photo ID/visa, financial receipts, other notification kinds, shared media-helper changes, upload/queue changes, EAS build/OTA, deployment and production/device actions.

### Validation

- `npm test -- --runInBand --no-cache src/screens/tabs/NoticesScreen.test.tsx src/screens/notices/NoticeDetailScreen.test.tsx` — passed: 2 suites / 10 tests; `issue_reported` private reference uses authenticated list/detail/preview components.
- `npm run typecheck` — passed.
- `npm run lint` — passed with 0 errors and 109 existing warnings.
- `npm run test:mzapp-media-visibility --prefix backend` (paired root dependency) — passed.
- `npm run check:feature-registry` (root) — passed: 13 FRs / 176 test mappings.
- `python3 /Users/zhishi/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/mz-mobile-photo-feature-rules` (root) and scoped `git diff --check` — passed.
- `python3 scripts/audit_change_release_ledger.py` — blocked by pre-existing mobile ledger lineage drift: 18 remote CRLs are absent locally and 19 historical CRLs have immutable business-identity differences. No mobile release gate is green from this worktree.

### Release Attempts

- None. The user authorized implementation and local verification only; no staging, commit, push, PR, OTA/build, deployment, production write or real-account device verification is authorized or performed.

### Risks / Release Notes

- Risk: local proof cannot establish the current production backend version, historical object existence or real-role rendering. If the exact feedback record is deleted, ambiguous or unavailable, the authentication component must preserve the existing terminal state rather than reveal a private raw URL.
- Rollback: revert only the `issue_reported` branches in the two notification screens and the paired regressions; do not restore raw private URL rendering.
- Sensitive-information review: no credentials, tokens, private URLs, image bytes, production logs or production data are added.
- Git state: shared mobile worktree was already extensively dirty; this unit is unstaged, uncommitted, unpushed, unpublished and not device-verified.

## CRL-20260813-001 — 移动端钥匙照片通知认证读取

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-13 Australia/Melbourne
- **Request:** 移动端信息中心的“钥匙照片已上传”通知列表和详情再次显示空白照片；按 MZ Media Incident 流程实施最小修复。
- **Outcome:** 本地源码和定向回归已验证：仅将 `key_photo_uploaded` 的已关联 `cleaning/...` 媒体引用接入现有认证缩略图与预览组件；不改变通知生成、收件人、导航、媒体授权、R2 或数据。该单元仍受共享台账既有谱系冲突阻断，不能进入提交/发布门禁。

### Implementation

- Previous behavior: `noticePresentation` 已将钥匙照片引用投影到 `notice.images`，但通知列表、详情和预览对该 `kind` 仍使用原生 `Image` 直连私有引用，缺少 Bearer 与 `/cleaning-app/media/image` 认证代理上下文，结果为空白占位。
- New behavior: `key_photo_uploaded` 与既有 `guest_luggage_updated` 一样使用 `CleaningMediaImage` 的 `thumbnail` 变体和 `CleaningMediaPreview` 的 `preview` 变体；其他通知类型继续使用原有渲染。
- Key decisions: 复用既有通用清洁媒体组件与服务端精确关联/授权分支；不新增公开 URL、客户端权限判断、后端兼容分支或通知系统。

### Files / Areas

- `src/screens/tabs/NoticesScreen.tsx`, `src/screens/tabs/NoticesScreen.test.tsx` — 钥匙照片通知列表缩略图走认证组件并覆盖回归。
- `src/screens/notices/NoticeDetailScreen.tsx`, `src/screens/notices/NoticeDetailScreen.test.tsx` — 钥匙照片详情缩略图/预览走认证组件并覆盖回归。
- `docs/change-release-ledger.md` — 本移动端修复单元记录。

### Impact / Dependencies

- API / database / migration / configuration / R2 / production data: none. 继续使用已有认证 `/cleaning-app/media/image`、`cleaning_task_media` 精确关联和服务端授权。
- Notification governance: 保持 `NTF-006` 的 `KEY_PHOTO_UPLOADED` 业务事件、服务端 Inbox 收件人、Badge/Push 与 `open_task` 语义不变；本次只修复已授权 Inbox 内的私有媒体读取。
- Feature rule: 遵循 root `FR-004` 的清洁媒体私有代理缩略图/预览要求；本次不改变规则语义。
- Excluded: 后端、`noticePresentation` 数据投影、媒体上传/关联、鉴权、对象存储、其他通知类型、EAS/原生构建和生产数据。

### Validation

- `npm test -- --runInBand --no-cache src/screens/tabs/NoticesScreen.test.tsx src/screens/notices/NoticeDetailScreen.test.tsx src/lib/cleaningMedia.test.ts` — passed: 3 suites / 21 tests; 覆盖钥匙照片列表缩略图、详情缩略图/预览和认证媒体 URL 生成。
- `npm run typecheck` — passed.
- `npm run lint` — passed with 0 errors and 109 existing warnings; 本单元文件没有新增 lint error。
- `npm run check:buttons` — passed (`button-contract: no suspicious hard-coded button dimensions found`).
- `git diff --check -- src/screens/tabs/NoticesScreen.tsx src/screens/tabs/NoticesScreen.test.tsx src/screens/notices/NoticeDetailScreen.tsx src/screens/notices/NoticeDetailScreen.test.tsx docs/change-release-ledger.md` — passed.
- `npm run check:ci` — blocked at its first `check:ledger` step. 审计基于 fetched `origin/Dev@afb46f1dd4b87dc4ab575e50ec9eb3bb38b7fedb` 发现共享本地台账缺少 18 个远端 CRL，且 19 个既有 CRL 的不可变业务身份不一致；该历史台账漂移不由本单元引入。因 CI 未越过台账门禁，后续 typecheck/lint/button/Jest 已以上述命令独立通过。
- No API/network/Push/device flow is exercised locally; no native build script is defined.

### Release Attempts

- None. 用户授权限于实现和本地验证；未授权 staging、commit、push、PR、OTA/build、部署或生产操作。

### Risks / Release Notes

- Risk: 服务端若未完成 `cleaning_task_media` 关联或当前用户无权读取，认证组件仍会安全地显示加载失败状态，而不会回退为原始私有 URL；需要后续真实设备验证该已授权路径。当前 release gate 还被本单元之外的共享台账谱系冲突阻断。
- Rollback: 恢复两个界面对 `key_photo_uploaded` 的原生 `Image` 分支；无数据回滚。
- Sensitive-information review: 不新增 token、凭据、`.env`、媒体原始链接、图片字节、生产日志或生产数据。
- Git state: 共享 mobile 工作区在本单元开始前已有大量无关改动；本单元未暂存、未提交、未推送、未发布。

## CRL-20260806-006 — 阳台清洁拍摄与管理详情动态展示（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-06 Australia/Melbourne
- **Request:** 清洁人员拍阳台照片，检查人员不拍；管理人员和客服在任务详情动态看到新增区域照片。
- **Outcome:** 清洁自完成页新增“阳台（有阳台时拍摄，可选）”照片位；检查与补充页不再显示或提交阳台。管理/客服共用的任务详情根据完成照片接口实际返回的区域生成照片组，`completion_balcony` 会显示为“阳台”。

### Implementation

- Previous behavior: 检查页面、草稿和提交队列维护可选 `balcony`；清洁完成照片没有阳台位；管理详情只遍历写死的完成照片区域，所以新区域不会自动显示。
- New behavior: 清洁完成照片状态、请求类型和 UI 增加可选 `balcony`，不进入八个必拍区域或完成阻塞条件。检查页面、草稿、队列和测试 fixture 删除阳台字段；管理详情按 API 返回的完成照片区域分组，保留旧遥控器区域合并规则。
- Key decisions: 继续使用既有相机、离线草稿/上传队列、水印、大图预览、任务详情鉴权和 `ManagerDailyTask` 入口；不在客户端猜测房源是否有阳台。

### Files / Areas

- `src/lib/api.ts` — 清洁完成照片区域类型加入 `balcony`。
- `src/screens/tasks/CleaningSelfCompleteScreen.tsx` — 清洁员可选阳台拍照位、读取状态和待上传快照支持。
- `src/screens/tasks/InspectionPanelScreen.tsx`, `src/lib/inspectionPanelDraft.ts`, `src/lib/inspectionPanelSubmitQueue.ts` — 移除检查端阳台拍照、草稿和队列写入。
- `src/lib/managerDailyTaskPhotos.ts`, `src/screens/tasks/ManagerDailyTaskScreen.tsx` — 动态归并完成照片区域并显示阳台标签。
- `src/screens/tasks/CleaningSelfCompleteScreen.test.tsx`, `src/screens/tasks/InspectionPanelScreen.test.tsx`, `src/screens/tasks/InspectionCompleteScreen.test.tsx`, `src/lib/inspectionPanelSubmitQueue.test.ts`, `src/screens/tasks/ManagerDailyTaskScreen.test.ts` — 覆盖职责转移、可选语义和动态展示。
- `docs/change-release-ledger.md` — 记录本 mobile 单元。

### Impact / Dependencies

- API: 使用配套 root `CRL-20260806-007` 的清洁完成照片 `balcony` schema；不新增 route、权限、数据库、配置或依赖。
- Protected behavior: 原有五项检查照片、八个清洁完成必拍区域、任务状态、弱网队列、遥控器历史兼容和管理详情权限不变。
- Production data / external sync: none.

### Validation

- `npm test -- --runInBand --no-cache src/screens/tasks/CleaningSelfCompleteScreen.test.tsx src/screens/tasks/InspectionPanelScreen.test.tsx src/screens/tasks/InspectionCompleteScreen.test.tsx src/screens/tasks/ManagerDailyTaskScreen.test.ts` — passed: 4 suites / 44 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 112 pre-existing warnings.
- `npm run check:buttons` — passed.
- `python3 scripts/audit_change_release_ledger.py` — passed: 102 changed files / 102 recorded.
- `git diff --check -- <current-task mobile paths>` — passed.

### Release Attempts

- None. No staging, commit, push, PR, EAS update/build, deployment or production write is authorized.

### Risks / Release Notes

- A compatible root deployment must precede or accompany the mobile build. The uncommitted `CRL-20260805-001` inspection-only implementation is superseded by this unit. Automated validation does not prove real iOS/Android camera, weak-network retries, deployed API, OTA/native build or production behavior.
- Sensitive-information review: no credentials, tokens, database URLs, private-media bytes, production logs or production data were added.
- Git state: shared mobile worktree is extensively dirty with unrelated changes; this unit is uncommitted.

## CRL-20260806-004 — 维修执行人完成/未完成改走专用工作流（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-08 Australia/Melbourne
- **Request:** 维修任务上传照片后，执行人点击“标记完成 / 未完成”收到 `maintenance_workflow_action_required`；保留两个既有按钮文案并修复提交。维修“未完成”须填写原因，但照片可选。
- **Outcome:** 保留“标记完成 / 未完成”两个按钮与既有输入；维修任务使用根后端的专用工作流，不再调用会被保护性拒绝的通用 `markWorkTask`。完成仍要求照片；未完成仅要求原因、可附照片。

### Implementation

- Previous behavior: `TaskDetailScreen` 对内部/外部维修与普通线下任务一样调用通用 `markWorkTask`；后端正确拒绝该绕过工作流的请求，且旧成功分支会把维修任务本地写成 `done`。
- New behavior: 仅当根后端投影的 `maintenance_workflow.available_actions` 允许时，内部/外部维修分别调用 `executor_complete` 或 `executor_unfinished`。完成传递现有完工照片、备注和稳定操作 ID，成功后刷新任务并显示“等待审核”；未完成提交原因（照片可选）并刷新权威状态，任务不再被本地写成 `done`。
- Protected behavior: 仅读取根后端下发的 `maintenance_workflow.available_actions` 决定按钮可用性；不在客户端自行判断维修权限或关闭状态。完成沿用已上传照片并刷新权威任务状态；未完成以原因作为唯一必填项。

### Files / Areas

- `src/lib/api.ts` — 增加维修工作流投影类型、专用请求和对应错误提示。
- `src/screens/tasks/TaskDetailScreen.tsx` — 两个既有按钮保持文案和布局，仅替换维修请求路径、按钮可用性和提交后的刷新逻辑。
- `src/screens/tasks/TaskDetailScreen.test.tsx` — 覆盖内部完成和外部未完成均走专用接口、不会调用通用 mark，且未完成可无照片提交原因。
- `docs/change-release-ledger.md` — modified: records this unit.

### Impact / Dependencies

- API: 消费根后端新增的可选 `maintenance_workflow` 字段，并调用既有 `/maintenance/workflow/:domain/:id/:action` 路由；普通任务仍使用原有 `markWorkTask`。
- Database / migration / config / dependencies: none in the mobile repository.
- Related root unit: `CRL-20260806-006`; FR-009. This mobile unit is not releaseable until the exact root/mobile pair completes Phase 4 integration validation.
- Production data / external sync: none during implementation or validation.

### Validation

- `npm run test -- --runInBand --no-cache src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite / 33 tests, including unfinished maintenance submission with a reason and no completion photos.
- `npm run check:ci` — passed: 54 suites / 299 tests；typecheck passed；lint 0 errors / 112 existing warnings；严格按钮审计和移动台账审计通过（101/101）。
- Root `npm run check:feature-registry` — passed: 13 FRs / 137 test mappings。
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 112 existing warnings.
- `npm run check:ledger` — passed: 104 changed files / 104 recorded files.
- `git diff --check -- <current-task paths>` — passed.

### Release Attempts

- None. No staging, commit, push, PR, EAS update/build, deployment or production write is authorized.

### Risks / Release Notes

- 必须与 root `CRL-20260806-006` 匹配发布，且服务端先于或同时于 App 可用；该 mobile 单元在完成 Phase 4 根/移动集成验证前不可单独发布。
- 未运行 EAS/OTA/native build、真实 iOS/Android 操作、弱网、已部署 API 或生产验证；自动化通过不构成这些证据。
- 敏感信息审查：未新增凭据、令牌、私有媒体字节、用户数据、数据库 URL 或生产日志。共享 mobile 工作树含其他未提交改动；本单元未暂存、未提交、未推送、未发布。

## CRL-20260806-002 — 自完成补品上传失败弹窗诊断（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-06 Australia/Melbourne
- **Request:** Adawang 在 WSP3709B 补品拍照上传时只看到“权限不足”；继续定位可能原因，并让失败提示提供最小可用诊断。
- **Outcome:** 自完成补品提交或重试收到终态失败时，弹窗除安全错误文案外还显示已持久化的失败阶段、错误码和可用的上传请求编号；本地照片、草稿、重试语义和服务器权限边界不变。

### Implementation

- Previous behavior: 页面内可保留同步诊断，但“重试提交消耗品”弹窗只显示例如“权限不足”，现场无法分辨是照片上传还是补品记录保存失败。
- New behavior: 弹窗复用既有 `syncFailureDetail`，显示如“阶段：照片上传，代码：FORBIDDEN，编号：…”；若服务端在上传处理器之前拒绝请求而未生成上传编号，则只显示实际可得的阶段和错误码，不伪造编号。

### Files / Areas

- `src/screens/tasks/CleaningSelfCompleteScreen.tsx` — 终态补品同步失败弹窗带上持久化诊断。
- `src/screens/tasks/CleaningSelfCompleteScreen.test.tsx` — 覆盖 403 重试弹窗显示阶段、错误码和请求编号。
- `docs/change-release-ledger.md` — 本独立移动仓库变更记录。

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Protected behavior: 继续使用既有队列、`last_error_*` 草稿字段和安全错误文案；不发起额外重试、不上传媒体、不改变任务状态或权限。
- Related units: FR-004；root `CRL-20260806-004` 仅更新对应的回归登记。
- Production data / external sync: none during implementation or validation.

### Validation

- `npm run test -- --runInBand --no-cache src/screens/tasks/CleaningSelfCompleteScreen.test.tsx` — passed: 15 tests.
- `npm run test -- --runInBand --no-cache src/lib/api.test.ts src/lib/cleaningConsumablesSubmitQueue.test.ts src/screens/tasks/CleaningSelfCompleteScreen.test.tsx` — passed: 3 suites / 43 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 112 existing warnings.
- `./node_modules/.bin/ts-node --transpile-only scripts/tests/test_cleaning_app_role_permission_overlays.ts` (in `backend`) — passed; static `cleaner` overlay retains media-upload and task-finish capabilities.
- `python3 scripts/audit_change_release_ledger.py` — passed: 100 changed files / 100 recorded.
- EAS/native build, iOS/Android physical-device retry, weak-network, deployed API and production verification — not run.

### Release Attempts

- None. User authorized the implementation and production read-only diagnosis only; no staging, commit, push, PR, EAS update/build, deployment, production retry, permission change or task-data write is authorized.

### Risks / Release Notes

- The installed production app will keep its old generic alert until this JavaScript bundle is delivered through a verified compatible OTA or a new App build; that release action needs separate authorization.
- A 403 emitted by authentication middleware before the upload handler may have no upload request ID. The client now reports this absence truthfully rather than inventing a correlation value.
- Rollback: revert the alert diagnostic composition and its focused test; no local media, server data or R2 object is changed.
- Sensitive-information review: no token, credential, database URL, private-media URL/bytes, account identifier or production log contents were added.
- Git state: shared mobile worktree has extensive pre-existing staged and unstaged changes; this unit is uncommitted, unpushed and undeployed.

## CRL-20260806-001 — 问题反馈历史按服务端 capability 操作（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-06 Australia/Melbourne
- **Request:** 所有登录用户可查看同房源历史反馈；原提交人只能编辑/撤回自己的反馈内容；admin 与线下经理可管理全部历史；移动端不得自行信任角色或 capability。
- **Outcome:** 问题反馈历史列表不再把当前来源任务作为读取前提；每条记录的编辑、撤回、分类移动入口只由后端返回的 capability 决定。普通编辑请求不再携带状态、费用、完工照片或处理备注。

### Implementation

- Previous behavior: 客户端把本地 `admin` 角色作为删除/移动判断，所有可见记录都显示编辑入口，编辑表单可提交工作流字段，并把来源任务作为历史列表条件。
- New behavior: `PropertyFeedback` 声明服务器 capability；屏幕只显示被明确授权的操作，普通编辑只提交后端白名单反馈字段，日用品状态和维修/深清的处理后照片/备注不再出现在历史编辑表单或 payload。

### Files / Areas

- `src/lib/api.ts` — capability 类型、历史查询参数和普通编辑请求白名单。
- `src/screens/tasks/FeedbackFormScreen.tsx` — 依据 capability 显示操作，收窄编辑界面和请求。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — 覆盖不再传来源任务和 capability 操作可见性。
- `docs/change-release-ledger.md` — 本独立移动仓库变更记录。

### Impact / Dependencies

- API: 依赖配对 root `CRL-20260806-001` 的 `GET /mzapp/property-feedbacks` capability 与服务端强制鉴权；旧后端时操作入口会保持隐藏，不能以客户端回退绕过权限。
- Protected behavior: 保持反馈创建、弱网续传、原始照片本地预览、认证媒体代理和工作任务来源传递不变。
- Database / config / dependencies / production data: none.

### Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 112 pre-existing warnings.
- `npm run check:buttons` — passed.
- `npm run test -- --runInBand --no-cache src/screens/tasks/FeedbackFormScreen.test.tsx` — passed: 5 tests.
- `npm run check:ci` — passed: mobile ledger 100/100 coverage, TypeScript, 0 lint errors / 112 existing warnings, strict button audit, 53 Jest suites / 294 tests.
- EAS/native build, iOS simulator, Android emulator, physical device, weak-network, paired deployed API/R2 and production verification — not run.

### Release Attempts

- None. This mobile unit is uncommitted; no staging, commit, push, PR, EAS update/build, deployment or production authorization exists. It remains unreleaseable until paired root/mobile integration validation is completed.

### Risks / Release Notes

- Risk: source tests do not verify old installed clients against a newly deployed backend or actual capability refresh on a device.
- Rollback: revert the capability UI conditions and request narrowing together with the paired root API; no local media, R2 object or business data is deleted.
- Sensitive-information review: no credentials, tokens, `.env`, database URL, private-media bytes, caches or sensitive logs were added.
- Git state: extensive unrelated mobile worktree changes are preserved; this unit is unstaged, uncommitted, unpushed and undeployed.

## CRL-20260804-007 — 维修任务摘要与维修前照片展示（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-04 Australia/Melbourne
- **Request:** 移动端维修任务卡和详情出现 `[{"content":...}]` 原始字符，且维修前照片不显示。
- **Outcome:** 缓存、服务端刷新和局部 patch 都在渲染前规范内部维修 JSON 摘要；详情新增只读“维修前照片”区，缩略图/大图通过现有认证媒体代理携带当前 `work_task_id` 读取。

### Files / Areas

- `src/lib/workTasksStore.ts`, `src/lib/workTasksStore.test.ts` — modified: 统一规范历史缓存、远端任务和实时 patch 的维修摘要。
- `src/lib/cleaningMedia.ts`, `src/lib/cleaningMedia.test.ts` — modified: 受控传递 `work_task_id`，不改变其他媒体读取来源。
- `src/components/CleaningMediaImage.tsx`, `src/components/CleaningMediaPreview.tsx` — modified: 缩略图和全屏预览传递该授权上下文。
- `src/lib/api.ts` — modified: 声明服务端投影的 `maintenance_before_photo_urls`。
- `src/screens/tasks/TaskDetailScreen.tsx`, `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: 维修前照片只读区、预览授权上下文及展示回归测试。
- `docs/change-release-ledger.md` — modified: records this unit.

### Impact / Dependencies

- API: 依赖配对 root `CRL-20260804-014` 返回维修前照片并安全验证 `work_task_id`。
- Protected behavior: 保持 `available_actions`、任务状态、提交/重试、其他清洁媒体的 `source_task_id` 授权和本地缓存语义不变。
- Database / dependencies / production data: none; no production API, media or database call made.

### Validation

- `npx jest src/lib/workTasksStore.test.ts src/lib/cleaningMedia.test.ts --runInBand` — passed: 13 tests.
- `npm run check:ci` — passed: ledger coverage 100/100, typecheck, 0 lint errors / existing warnings, strict button audit and 53 suites / 289 tests.
- Real device, weak-network, paired deployed API/R2 and production verification — not run.

### Risks / Release State

- The root API and mobile bundle must both be released; an older installed bundle or older API continues to lack one side of the projection.
- Sensitive-information review: no credentials, tokens, `.env`, media bytes or sensitive logs added.
- Git state: shared dirty mobile worktree; no staging, commit, push, EAS, deployment or production write.

## CRL-20260804-006 — 问题反馈照片本地预览与完工续传（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-04 Australia/Melbourne
- **Request:** 问题反馈上传照片无法查看缩略图和放大图片；维修记录标记“已完成，一起提交完工信息”时报提交失败。
- **Outcome:** 新上传照片在反馈记录尚未保存前，缩略图和全屏预览直接使用受保护的本地草稿副本；提交成功后删除该副本。维修/深清完成提交统一使用来源 `cleaning_tasks` ID，并把反馈创建、项目创建、完工提交的已完成步骤保存在草稿中，失败重试从缺失步骤继续，不重复创建反馈或项目。

### Implementation

- Previous behavior: 新照片上传后仅保存私有 `cleaning/...` 远端引用。该对象尚未关联任何已保存反馈记录，媒体代理会安全拒绝，因此缩略图和原图都不可见；完成流程则误将 `work_tasks.id` 作为 `source_task_id` 发送给反馈 API，导致来源解析失败，而且最后一步失败后会重新创建前置记录。
- New behavior: 普通问题反馈上传先将压缩图片持久化到本地，再上传并保存远端引用与本地副本映射；缩略图和大图优先读取本地，已保存记录仍使用既有认证代理。完成流程使用任务 `source_id`，每次副作用后持久化反馈 ID 或项目 ID；服务端去重返回的 `existing_id` 也会继续进入缺失步骤，重试不会重复创建反馈或项目；用户仅看到安全、可操作的失败提示。
- Key decisions: 不放开后端未登记私有对象读取，不更改媒体权限或 R2；继续使用现有上传、草稿、图片组件和反馈 API，不新增依赖或平行队列。

### Files / Areas

- `src/screens/tasks/FeedbackFormScreen.tsx` — modified: 本地预览映射、草稿恢复/清理、来源任务 ID、阶段检查点和续传提示。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — modified: 覆盖本地缩略图、来源任务提交和末步失败重试不重复创建。
- `src/components/CleaningMediaPreview.tsx` — modified: 支持本地文件作为缩略图和大图来源。
- `src/components/CleaningMediaPreview.test.tsx` — modified: 覆盖本地缩略图/原图直接读取。
- `src/lib/localMediaHousekeeping.ts` — modified: 扫描并保护反馈草稿目录与缓存键。
- `src/lib/localMediaHousekeeping.test.ts` — modified: 覆盖反馈草稿缓存键受保护。
- `docs/change-release-ledger.md` — modified: records this unit.

### Impact / Dependencies

- API: 继续调用现有上传、反馈创建、项目创建和完工 API；`source_task_id` 从工作任务来源 `cleaning_tasks` ID 传递。
- Database / migration / config / dependencies: none.
- Related units: paired root registry `CRL-20260804-006`; root/mobile `CRL-20260804-001`、`CRL-20260804-003`、`CRL-20260804-004`; FR-009.
- Production data / external sync: no API, media or database call was made during local validation.

### Validation

- `npm test -- --runInBand src/screens/tasks/FeedbackFormScreen.test.tsx src/components/CleaningMediaPreview.test.tsx src/lib/localMediaHousekeeping.test.ts` — passed: 3 suites / 12 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors / 112 existing warnings.
- `npm run check:ci` — passed: ledger coverage 100/100, typecheck, lint 0 errors / 112 warnings, strict button audit and 53 Jest suites / 287 tests.
- `python3 scripts/audit_change_release_ledger.py` — passed: 100 changed files / 100 recorded / Coverage PASS.
- EAS/native build, device test, deployed backend/R2 and production verification — not run.

### Release Attempts

- None. This mobile unit is uncommitted; the user has not selected it for commit or authorized a push.

### Risks / Release Notes

- Risk: only photos uploaded after installing this mobile fix have a local preview fallback; old unfinished drafts without a saved local copy rely on the authenticated remote media path. If the last completion request reaches the server but the app process dies before receiving the response, re-entering still resumes the saved project rather than creating duplicates, but a real device/network interruption test remains required.
- Rollback: remove the local preview mapping/checkpoints and restore one-shot submit behavior; no backend, media object, task state or production data rollback is required.
- Sensitive-information review: no credentials, tokens, `.env` contents, database URLs, cookies, private keys, media files or sensitive logs were added.
- Git state: uncommitted in a shared dirty mobile worktree; no staging, commit, push, EAS, deployment or production write was performed.

## CRL-20260804-005 — 问题反馈照片上传按钮等宽布局（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-04 Australia/Melbourne
- **Request:** 房源维修问题反馈中“拍照上传 / 相册选择”按钮靠左显示并留下大块空白。
- **Outcome:** 现场照片的两个标准操作按钮使用现有 `AppButton` 等宽排列，各占可用行宽的一半并保持 12pt 间距、44pt 最小触控高度；按钮文字、拍照/相册处理器和上传行为不变。

### Implementation

- Previous behavior: 页面内 `Pressable` 按文字内容决定宽度，父容器允许换行，导致窄屏或放大字体时按钮靠左且布局不稳定。
- New behavior: `UploadButtons` 复用已有 `AppButton`，按钮行使用等宽 `flex: 1` 和 `minWidth: 0` 的受控契约；审计脚本为该确切等宽按钮样式登记最小例外，不放宽其他页面。
- Key decisions: 这是视觉/可用性修复，不改变照片权限、相机/相册请求、上传、草稿、API payload、任务状态或导航；不新增 FR。

### Files / Areas

- `src/screens/tasks/FeedbackFormScreen.tsx` — modified: 照片上传按钮改为现有 `AppButton` 等宽行。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — modified: 覆盖两个上传按钮的等宽/最小触控尺寸契约。
- `scripts/audit_button_contract.py` — modified: 为该精确 `AppButton` 等宽样式登记现有契约例外。
- `docs/change-release-ledger.md` — modified: records this unit.

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Business behavior: unchanged; camera and library handlers remain the existing callbacks.
- Related units: mobile `CRL-20260804-004` (historical feedback photo proxy); this layout unit can be reviewed separately but shares `FeedbackFormScreen.tsx` hunks with other uncommitted work.
- Production data / external sync: none read, written, synchronized or changed.

### Validation

- `npm test -- --runInBand --no-cache src/screens/tasks/FeedbackFormScreen.test.tsx` — passed: 1 suite / 3 tests, including equal-width 44pt upload buttons.
- `./node_modules/.bin/eslint src/screens/tasks/FeedbackFormScreen.tsx src/screens/tasks/FeedbackFormScreen.test.tsx` — passed: 0 errors; 7 existing warnings in the screen.
- `npm run check:buttons` — passed: no suspicious hard-coded button dimensions.
- `npm run check:ci` — passed: ledger coverage 100/100, typecheck, lint 0 errors / 113 existing warnings, strict button audit and 53 Jest suites / 285 tests.

### Release Attempts

- None. This unit is uncommitted; the user has not selected it for commit or authorized a push.

### Risks / Release Notes

- Device check: iOS/Android narrow-screen and enlarged-font visual verification remains not run.
- Rollback: restore the two local upload `Pressable` controls and remove this specific audit exception/test/ledger unit; no task, draft, media or backend data rollback is required.
- Sensitive-information review: no credentials, tokens, `.env` contents, database URLs, cookies, private keys, media files or sensitive logs were added.
- Git state: uncommitted in a shared dirty mobile worktree; no staging, commit, push, EAS, deployment or production write was performed.

## CRL-20260804-004 — 历史问题反馈私有照片代理（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-04 Australia/Melbourne
- **Request:** 移动端问题反馈全屏预览仍显示“原图加载失败，点击重试”。
- **Outcome:** 历史 `mzapp/` 反馈图片和现有 `cleaning/` 图片均通过带登录令牌、来源任务和图片规格的已有媒体代理读取；不再把私有 R2 URL 直接交给原生图片控件。

### Implementation

- Previous behavior: `cleaning/` 图片会带授权走代理，但旧 `mzapp/` 反馈图片作为直连 URL 交给全屏预览，私有对象无法取得原图。
- New behavior: 媒体来源构造器识别 `mzapp/` key 或 R2 URL 中的 `mzapp/` 路径，并复用同一代理、token 和 `source_task_id`；无效路径遍历仍不走代理。
- Key decisions: 没有新增上传、队列、按钮或本地媒体副本；服务端仍决定该对象是否属于反馈和当前人员是否可读取。

### Files / Areas

- `src/lib/cleaningMedia.ts` — modified: 私有反馈对象识别和认证代理 URL 构造。
- `src/lib/cleaningMedia.test.ts` — modified: 覆盖旧 `mzapp/` URL/key、来源任务和无效 key。
- `docs/change-release-ledger.md` — modified: records this unit.

### Impact / Dependencies

- API: 既有 `GET /cleaning-app/media/image` 读取历史 `mzapp/` 图片；必须配套 root `CRL-20260804-004` 的精确反馈记录和任务成员授权。
- Database / migration / config / dependencies: none.
- Related units: paired root `CRL-20260804-004`, root/mobile `CRL-20260804-001`, FR-009.
- Production data / external sync: none read, written, synchronized or changed by the mobile implementation.

### Validation

- `npm test -- --runInBand --no-cache src/lib/cleaningMedia.test.ts` — passed: 1 suite / 7 tests, including legacy `mzapp/` URL/key proxying with `source_task_id`.
- `npm run typecheck` — passed.
- `./node_modules/.bin/eslint src/lib/cleaningMedia.ts src/lib/cleaningMedia.test.ts` — passed: 0 errors or warnings in changed media files.
- `npm run check:buttons` — passed: no suspicious hard-coded button dimensions.
- `npm run check:ci` — passed: ledger coverage 100/100, typecheck, lint 0 errors / 113 existing warnings, strict button audit and 53 Jest suites / 285 tests.
- Real device and paired deployed API/R2 verification — not run.

### Release Attempts

- None. This unit is uncommitted; the user has not selected it for commit or authorized a push.

### Risks / Release Notes

- Deployment dependency: both the mobile bundle and root media route must be deployed before an already-installed device can render historical private images.
- Rollback: revert the listed media-source/test hunks together with paired root CRL-20260804-004; no local media, task state or remote object needs rollback.
- Sensitive-information review: no credentials, tokens, `.env` contents, database URLs, cookies, private keys, media files, media URLs or sensitive logs were added.
- Git state: uncommitted in a shared dirty mobile worktree; no staging, commit, push, EAS, deployment or production write was performed.

## CRL-20260804-003 — 问题反馈历史错误提示与安全重试（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-04 Australia/Melbourne
- **Request:** 执行问题反馈报错解决方案，不能把 `column m.feedback_source does not exist` 等后端诊断直接显示给现场人员。
- **Outcome:** 历史反馈加载失败时，页面显示统一的可操作提示与“重新加载”按钮；数据库、SQL 和服务端内部细节不再出现在移动端。重试继续使用当前任务来源、既有安全 API 和缓存策略。

### Implementation

- Previous behavior: 历史反馈请求失败后，页面直接渲染 `Error.message`，把 `property_feedbacks_failed` 和 PostgreSQL 列名暴露给用户，且没有就地重试入口。
- New behavior: 页面将失败映射为通用提示，并用已有 `AppButton` 渲染 44pt 最小触控目标的重试按钮；重试复用 `refreshLists({ force: true })`，不改变任务来源、权限、草稿或提交状态。
- Key decisions: 不在客户端解析数据库字段/权限原因，不吞掉缓存，且不新增离线队列或网络层。

### Files / Areas

- `src/screens/tasks/FeedbackFormScreen.tsx` — modified: 历史反馈友好错误提示和安全重试按钮。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — modified: 覆盖内部错误隐藏和重试请求。
- `docs/change-release-ledger.md` — modified: records this unit.

### Impact / Dependencies

- API: none; continues calling existing `GET /mzapp/property-feedbacks` with `source_task_id`.
- Database / migration: requires paired root `CRL-20260804-003` and the controlled maintenance workflow migration to restore the backend source fields; mobile code does not migrate data.
- Config / dependencies: none.
- Related units: paired root `CRL-20260804-003`, root/mobile `CRL-20260804-001`, FR-009.
- Production data / external sync: none read, written, synchronized or changed during implementation.

### Validation

- `npm test -- --runInBand --no-cache src/screens/tasks/FeedbackFormScreen.test.tsx` — passed: 1 suite / 3 tests, including raw-error suppression and retry.
- `npm run typecheck` — passed.
- `./node_modules/.bin/eslint src/screens/tasks/FeedbackFormScreen.tsx src/screens/tasks/FeedbackFormScreen.test.tsx` — passed: 0 errors; 7 existing warnings in `FeedbackFormScreen.tsx`.
- `npm run check:buttons` — passed: no suspicious hard-coded button dimensions.
- `npm run check:ci` — passed: ledger 100/100, typecheck, lint (0 errors / 113 existing warnings), strict button audit and 53 Jest suites / 285 tests.
- Real device and confirmed non-production API verification — pending target environment confirmation.

### Release Attempts

- None. This unit is uncommitted; the user has not selected it for commit or authorized a push.

### Risks / Release Notes

- User-visible state: a friendly retry message does not repair an unavailable backend or unapplied schema migration; cached historical entries remain subject to their existing cache policy.
- Rollback: revert this screen/test/ledger unit with paired root `CRL-20260804-003`; no mobile data, task status or media object needs rollback.
- Sensitive-information review: no credentials, tokens, `.env` contents, database URLs, cookies, private keys, media files, production data or sensitive logs were added.
- Git state: uncommitted in a shared dirty mobile worktree; no staging, commit, push, EAS, deployment or production write was performed.

## CRL-20260804-002 — 任务详情钥匙拍照真机异常如实诊断（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-04 Australia/Melbourne
- **Request:** 安卓真机在任务详情拍摄钥匙照片时显示“模拟器不支持相机拍照”；修复错误提示并保留安全诊断。
- **Outcome:** 任务详情的钥匙拍照现在分别处理权限检查异常、权限未允许和相机启动异常。相机启动失败会提示检查系统相机和权限、提供“去设置”，只显示格式受限的错误代码；不会再误称模拟器。

### Implementation

- Previous behavior: `requestCameraPermissionsAsync()` 抛错被吞掉；随后任意 `launchCameraAsync()` 异常都会显示“模拟器不支持相机拍照”，真机无法区分权限、系统相机或原生模块问题。
- New behavior: 权限 API 失败会停止流程并提示设置；未授权沿用设置入口；相机启动失败显示可操作的真机错误。仅允许字母、数字、点、下划线和连字符的短错误代码显示给用户；不显示原始原生错误文本。
- Key decisions: 保持现有现场拍照、钥匙本地队列、上传与刷新语义；不提供相册回退，不更改服务端 action、媒体接口、任务状态或权限模型。

### Files / Areas

- `src/screens/tasks/TaskDetailScreen.tsx` — modified: keys-camera permission/launch exception handling and safe error-code formatting.
- `src/screens/tasks/TaskDetailScreen.test.tsx` — modified: covers camera-launch and permission-API exceptions, settings action, no simulator text and no queue enqueue.
- `docs/change-release-ledger.md` — modified: records this unit.

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Related units: root FR-004 and root `CRL-20260804-002`; this cross-repository unit is not releaseable until the exact root/mobile pair completes its integration check.
- Production data / external sync: none read, written, synchronized or changed.

### Validation

- `npm test -- --runInBand src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 1 suite / 30 tests; new failure paths assert no queue enqueue.
- `npm run typecheck` — passed.
- `./node_modules/.bin/eslint src/screens/tasks/TaskDetailScreen.tsx src/screens/tasks/TaskDetailScreen.test.tsx` — passed: 0 errors; 3 existing Hook-dependency warnings in `TaskDetailScreen.tsx`.
- `npm run check:ci` — passed: mobile ledger, typecheck, lint (0 errors / 113 existing warnings), strict button audit and 53 Jest suites / 284 tests.
- `python3 scripts/audit_change_release_ledger.py` — passed: 100 changed files, all recorded.
- Root `python3 scripts/audit_feature_regression_registry.py` — passed: 12 FRs / 119 test mappings.

### Release Attempts

- None. This independent mobile unit is uncommitted; the user has not selected it for commit or authorized a push.

### Risks / Release Notes

- Native boundary: this JavaScript repair cannot add a permission to an already installed APK, repair a device camera app, or prove a device-specific native exception. No EAS/native build or Android device interaction ran.
- Rollback: restore the two task-detail error branches and remove the two new tests together with root/mobile `CRL-20260804-002`; no backend or data rollback is required.
- Sensitive-information review: no credentials, tokens, `.env` contents, database URLs, cookies, private keys, media files, production data or sensitive logs were added.
- Git state: uncommitted in a shared dirty mobile worktree; no staging, commit, push, EAS, deployment or production write was performed.

## CRL-20260804-001 — 问题反馈历史展示与照片任务授权（mobile）

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-04 Australia/Melbourne
- **Request:** 移动端问题反馈文字/照片显示异常；清洁与检查人员均需看到同房源已报问题，避免重复上报。
- **Outcome:** 问题反馈页（包括检查批次入口）会按当前任务来源加载并展示同房源历史反馈；历史卡片将问题文字与缩略图置于首行、操作按钮置于下一行，窄屏不再把中文标题挤成竖排。反馈照片和大图读取会携带当前任务来源，交由服务端验证任务成员关系。

### Implementation

- Previous behavior: 检查批次入口不加载或显示历史反馈；卡片在一行同时放标题、96px 缩略图和最多四个操作，窄屏会压缩标题；私有反馈照片没有把当前任务来源交给媒体代理。
- New behavior: 清洁和检查任务均请求现有历史反馈 API，并提示先核对已报问题；缓存按登录用户隔离。反馈缩略图与大图使用现有安全媒体组件，携带 `source_task_id`；草稿照片仍不伪装成已提交反馈媒体。
- Key decisions: 复用现有 `FeedbackFormScreen`、`CleaningMediaImage`/`Preview`、对象 key 和历史缓存，不新增本地队列、重复检测算法或客户端权限推导。服务端仍是唯一授权源。

### Files / Areas

- `src/screens/tasks/FeedbackFormScreen.tsx` — modified: 所有反馈入口可读历史、来源任务查询、窄屏卡片布局、可访问图标标签及历史照片预览。
- `src/screens/tasks/FeedbackFormScreen.test.tsx` — modified: 清洁/检查角色在检查批次入口看到同房源历史问题。
- `src/lib/api.ts` — modified: 历史反馈请求传递 `source_task_id`。
- `src/lib/cleaningMedia.ts` and `src/lib/cleaningMedia.test.ts` — modified: 安全图片源可绑定当前任务来源并覆盖 URL 契约。
- `src/components/CleaningMediaImage.tsx` and `src/components/CleaningMediaPreview.tsx` — modified: 将历史媒体来源传递给现有认证代理和缓存路径。
- `docs/change-release-ledger.md` — modified: this unit.

### Impact / Dependencies

- API: calls `GET /mzapp/property-feedbacks` with `source_task_id`; feedback image reads add the same optional query parameter. Requires root `CRL-20260804-001` backend authorization change.
- Database / migration / config / dependencies: none.
- Related units: FR-009; root `CRL-20260804-001` (uncommitted companion). This cross-repository unit is not releaseable until the exact root/mobile pair completes its integration check.
- Production data / external sync: none read, written, synchronized or changed during implementation.

### Validation

- `npm test -- --runInBand --no-cache src/lib/cleaningMedia.test.ts src/screens/tasks/FeedbackFormScreen.test.tsx` — passed: 2 suites / 9 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors; 113 existing warnings, including pre-existing warnings in `FeedbackFormScreen.tsx`.
- `npm run check:ci` — passed: ledger 100/100, typecheck, lint, strict button audit and 53 Jest suites / 282 tests.
- `python3 scripts/audit_change_release_ledger.py` — passed: 100 changed files, all recorded.
- `git diff --check` — passed.
- Real iOS/Android screen widths, authenticated non-production API, EAS/native build and device validation — not run.

### Release Attempts

- None. This independent mobile unit is uncommitted; the user has not selected it for commit or authorized a push.

### Risks / Release Notes

- Compatibility: the paired backend requires a current source task for non-manager historical reads. Deploy this mobile change only with the paired root CRL.
- Verification gap: no real device/remote request proves the rendered photo or task-authorized 403 boundary yet.
- Rollback: revert the listed mobile files and this ledger entry together with root `CRL-20260804-001`; no local media, backend data or schema rollback is required.
- Sensitive-information review: no credentials, tokens, `.env` contents, database URLs, cookies, private keys, media files, production data or sensitive logs were added.
- Git state: uncommitted in a shared dirty mobile worktree; no staging, commit, push, EAS, deployment or production write was performed.

## CRL-20260802-006 — 按钮合同审计已验证例外

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-02 Australia/Melbourne
- **Request:** 继续完成移动端 `check:ci` 验证，处理静态按钮审计中的四个剩余提示。
- **Outcome:** 经逐项检查，四项均已由现有共享组件满足触控合同：两个房号确认和任务动作的 `minWidth: 0` 是等宽 44pt 按钮行的布局约束；照片删除的 40pt 圆形仅为 `AppIconButton` 44x44 外层触控框内的视觉尺寸。审计器仅对这四个精确路径/样式/属性/数值组合登记合同例外，未改动任务、提交、导航、权限或媒体业务行为。

### Files / Areas

- `scripts/audit_button_contract.py` — 把四个已验证的共享按钮合同用法与遗留 UI 尺寸例外分开登记。
- `docs/change-release-ledger.md` — this release unit.

### Reviewed Sources (No Behavior Change)

- `src/screens/tasks/CleaningSelfCompleteScreen.tsx` — `AppButton` 房号确认行，外层最小高度由共享组件提供。
- `src/screens/tasks/InspectionPanelScreen.tsx` — `AppButton` 房号确认行，外层最小高度由共享组件提供。
- `src/screens/tasks/TaskDetailScreen.tsx` — 任务动作继承 44pt 高度；照片删除使用 `AppIconButton` 44x44 外层触控框。

### Impact / Dependencies

- API / database / migration / config / dependencies: none.
- Related units: existing shared `AppButton` / `AppIconButton` contract; separate from CRL-20260801-011 and its notification dependencies.
- Production data: none read, written, synchronized or changed.

### Validation

- Review evidence: the two confirmation rows render `AppButton`; task actions retain `actionBtn.minHeight: 44`; the delete control renders `AppIconButton` with its 44x44 touch frame and a 40pt visual child.
- `npm run check:ci` — passed: ledger 98/98, typecheck, lint 0 errors / 113 existing warnings, strict button audit, Jest 53 suites / 280 tests.
- `git diff --check -- docs/change-release-ledger.md scripts/audit_button_contract.py` and corresponding cached diff check — passed.
- Device interaction / iOS / Android / EAS — not run.

### Risks / Release Notes

- The exceptions are intentionally exact; a different path, style name, property or value still fails strict audit.
- This static verification is not device-size evidence. Real-device font-scale and narrow-width checks remain unrun.
- Sensitive-information review: no credentials, tokens, database URLs, media, logs or production data were added.
- Git state: uncommitted and unstaged in a concurrent mobile worktree; the audit script already contains unrelated staged work, so any eventual staging must select only this hunk.

## CRL-20260801-009 — 清洁补品缺纸镜后确认与待同步防重复提交

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-01 20:52 AEST
- **Request:** 清洁人员将卷纸标记为不足、确认已检查镜后后，补品提交反复出现确认弹窗而无法继续；按最小方案修复。
- **Outcome:** 镜后确认保存到当前本机草稿并绑定缺纸项目；待同步重进不再重复确认，页面明确等待自动同步并阻止重复提交。

### Implementation

- Previous behavior: 镜后确认只保存在一次点击 Promise；提交未立即完成时，后续点击重新弹出确认。
- New behavior: 草稿持久化 `toilet_paper_mirror_check`；缺纸项目变化会失效。`waiting_sync` 显示等待状态，`failed`/`blocked` 显示失败原因并恢复已有队列的重试入口。
- Key decisions: 不新增 API、数据库、依赖、队列或直传路径；仍由现有补品队列执行上传和业务保存。

### Files / Areas

- `src/lib/cleaningConsumablesDraft.ts` — 本地确认字段的归一化和 patch 合并。
- `src/screens/tasks/SuppliesFormScreen.tsx` — 确认、草稿恢复、同步和重试状态展示。
- `src/screens/tasks/SuppliesFormScreen.test.tsx` — 页面回归。
- `src/lib/cleaningConsumablesSubmitQueue.test.ts` — 草稿更新保留确认回归。
- `docs/change-release-ledger.md` — 当前独立移动端 release unit。

### Impact / Dependencies

- API / database / migration / config / dependencies: none。
- Related units: root `CRL-20260801-009`, FR-004, and root `CRL-20260801-008` shared draft-file hunks.

### Validation

- `npm test -- --runInBand --no-cache src/screens/tasks/SuppliesFormScreen.test.tsx src/lib/cleaningConsumablesSubmitQueue.test.ts` — passed: 2 suites, 35 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors, 113 pre-existing warnings.
- `npm run check:buttons` — not passed: four existing findings outside this unit, with no finding in `SuppliesFormScreen.tsx`.
- Root `npm run check:fast` — passed: root ledger/FR audit, backend build/contracts, frontend tests and mobile typecheck.
- `python3 scripts/audit_change_release_ledger.py` — not passed: 9 pre-existing/unattributed files outside this unit remain uncovered; do not claim full independent-mobile worktree coverage.
- `git diff --check` — passed.
- Android real device / EAS build / OTA or store publication — not run.

### Risks / Release Notes

- Existing local drafts/photos are retained; rollback restores only this unit's hunks and must not delete them.
- Governance: this unit is ready for review, but selective release remains blocked by the independent-mobile worktree's nine pre-existing/unattributed ledger files.
- Sensitive-information review: no tokens, credentials, database URLs, media content, local paths, cookies, private keys, sensitive logs or production data were added.
- Git state: independent mobile worktree has concurrent staged/unstaged changes; this unit is unstaged, uncommitted, unpushed and undeployed.

## CRL-20260801-002 — 清洁照片上传失败诊断与本地恢复

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-01 Australia/Melbourne
- **Request:** 为清洁人员卡住的照片上传展示实际失败阶段/编号，并保留现有本地照片可直接重试。
- **Outcome:** 照片上传失败现在持久化阶段、错误码和上传编号；自完成页面显示这些诊断，失败媒体仍保留 `file://` URI 和原有队列，网络恢复或“重试上传”继续复用原照片。

### Files / Areas

- `src/lib/api.ts` — 清洁照片请求附带诊断编号，并读取服务端失败编号。
- `src/lib/cleaningConsumablesDraft.ts`、`src/lib/cleaningConsumablesSubmitQueue.ts` — 持久化上传/业务保存失败阶段和编号；不改变媒体删除条件。
- `src/screens/tasks/CleaningSelfCompleteScreen.tsx` — 显示“阶段 / 代码 / 编号”，避免把未完成上传误说成已联网成功。
- `src/lib/api.test.ts`、`src/lib/cleaningConsumablesSubmitQueue.test.ts`、`src/screens/tasks/CleaningSelfCompleteScreen.test.tsx` — 请求编号、诊断保存、页面显示和本地照片保留回归。

### Impact / Dependencies

- API: existing `/cleaning-app/upload` response accepts/returns `upload_request_id`; must ship with root `CRL-20260801-008` for server correlation.
- Database / config / dependencies: none.
- Related units: root `CRL-20260801-008`, FR-004, and the existing local-first completion-photo queue.

### Validation

- `npm run test -- --runInBand --no-cache src/lib/api.test.ts src/lib/cleaningConsumablesSubmitQueue.test.ts src/screens/tasks/CleaningSelfCompleteScreen.test.tsx` — passed: 3 suites, 42 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors, 113 pre-existing warnings.
- Device/EAS/production validation — not run; no user photo or production task was modified.

### Risks / Release Notes

- Existing local photos are neither migrated nor deleted. Old failed drafts without a prior diagnostic will show details after the next retry attempt.
- Rollback: restore only this unit's source/test hunks; do not delete local draft files.
- Sensitive-information review: no token, credentials, database URL, media content, local path or production data was added.
- Git state: nested mobile worktree has concurrent staged/unstaged changes; this unit is unstaged, uncommitted, unpushed and undeployed.

## CRL-20260801-001 — 房源当日临时通知安全入口

- **Status:** blocked
- **Reconciliation state:** LOCAL_ATTRIBUTION_BLOCKED
- **Reconciliation evidence:** Current source paths overlap multiple CRL candidates; R0 cannot safely assign the delta without fabricating historical ownership.
- **Updated:** 2026-08-01 Australia/Melbourne
- **Request:** 房源当日临时通知应留在通知详情，不应从多个相关任务中任意打开第一条任务。
- **Outcome:** 带 `scope: property_day` 或 `open_property_day_notice` 的通知在推送点击和通知详情中都不再路由到任务，使用者可查看该房源当天的照片和说明。

### Implementation

- `src/navigation/RootNavigator.tsx` — modified: property-day push response跳过 task route 解析。
- `src/screens/notices/NoticeDetailScreen.tsx` — modified: property-day detail 不显示“查看任务”。
- `src/screens/notices/NoticeDetailScreen.test.tsx` — modified: 覆盖多个 task ID 时仍停留通知详情。
- `docs/change-release-ledger.md` — modified: 记录本独立移动端单元；关联 root `CRL-20260801-005`。

### Impact / Dependencies

- API / database / migration / dependencies: none；依赖 root payload 提供 `scope: property_day`。
- Rollback: 移除 property-day 路由拦截和对应测试；不触碰同文件其他并发改动。

### Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed: 0 errors, 113 existing warnings.
- `npm test -- --runInBand --no-cache src/screens/notices/NoticeDetailScreen.test.tsx` — partial: property-day test passed; existing persisted-notice loading case failed in the shared worktree.
- `python3 scripts/audit_change_release_ledger.py` — blocked by 9 pre-existing uncovered files outside this unit (`.env.example` and unrelated account/contact/API files); this unit's three mobile paths and its ledger entry are recorded.
- Device / push service / EAS build: not run.

### Risks / Release Notes

- Old backend payloads without property-day scope keep their existing task routing.
- No secrets, tokens, credentials, database URLs, user data or production records were added or read.
- Git state: nested mobile worktree has pre-existing concurrent changes; this unit is unstaged, uncommitted, unpushed and undeployed.


## CRL-20260812-009 — Root/mobile PR 范围审计与配对分支 CI 修复

- **Status:** merged-dev
- **Updated:** 2026-08-12 Australia/Melbourne
- **Request:** 修复 mobile PR #24 与配对 root PR #303 的合并门禁失败：CI 的 `--base/--head` PR 范围调用被审计器误拒绝，导致质量作业在参数解析阶段退出。
- **Outcome:** 移动端审计器恢复只读 `base...head` PR 覆盖审计；`--release-report` 仍保留给带 repository/CRL/候选证据的严格 Release Attempt。

### Implementation

- Previous behavior: 审计器把 `--base`/`--head` 误视为只属于 Release Attempt，移动端质量工作流的 PR 调用直接返回 exit 2。
- New behavior: 普通模式接受成对 `--base`/`--head` 并执行三点范围覆盖与空白检查；仅 `--repo`/`--crl` 继续要求 `--release-report`，避免削弱发布审计。

### Files / Areas

- `scripts/audit_change_release_ledger.py` — 恢复 PR 范围审计 CLI 分支并保留台账谱系预检。
- `scripts/tests/test_audit_change_release_ledger.py` — 覆盖成功范围、未登记路径和不完整范围拒绝。
- `docs/change-release-ledger.md` — 本移动端 CI 修复记录。

### Impact / Dependencies

- CI only; no app screen, API, permission, database, cache, R2, OTA or production-data change.
- Paired unit: root `CRL-20260812-009`; both PR #24 and root PR #303 rely on the compatible PR-range CLI.

### Validation

- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/tests/test_audit_change_release_ledger.py` — passed: 18 tests, including PR range success, uncovered path failure and incomplete range rejection.
- `python3 scripts/audit_change_release_ledger.py --base origin/Dev --head HEAD` — passed for PR #24: 27 changed / 27 recorded paths.
- `ruby -ryaml -e 'YAML.load_file(...)'`, `python3 scripts/audit_change_release_ledger.py` and `git diff --check` — passed.
- `npm run check:ci` — passed with a temporary ignored dependency link: typecheck, lint (0 errors / 109 existing warnings), button audit and 56 suites / 293 tests passed; the link was removed.

### Release Attempts

#### RA-20260812-mobile-001-009-03

- Repository: `mobile`.
- Selected CRLs: `CRL-20260812-001`, `CRL-20260812-002`, `CRL-20260812-003`, `CRL-20260812-004`, `CRL-20260812-005`, `CRL-20260812-006`, `CRL-20260812-007`, `CRL-20260812-009`.
- Intended action: `commit`.
- Branch: `codex/release-crl-20260812-001-007`.
- Target: `Dev`.
- Base: `origin/Dev@94b75a81c2a321f2ee44d9c197bf43b0f2b68733`; fetched at `2026-08-12T16:32:37+10:00`.
- Candidate patch SHA-256: `6c6d4ed389a869dd63c074dcdc2942c6197a9e7f42f8a9435d4565aa68cedaa1`, excluding `docs/change-release-ledger.md`.
- Commit SHA: `ec95bf316d9f483f3dbb628295e62cb699ef6c98` (candidate content commit; final audit head is emitted by the release report).
- Dependencies: paired root `CRL-20260812-001`, `CRL-20260812-002`, `CRL-20260812-003`, `CRL-20260812-006`, `CRL-20260812-007`, `CRL-20260812-008`, `CRL-20260812-009`; all base-range mobile paths are attributed to the selected CRLs.
- Required validation: PASS — exact PR range and working-tree ledger audits, 18 ledger regression tests, plus the previously rerun complete `npm run check:ci` gate (typecheck, lint 0 errors / 109 existing warnings, button audit and 56 suites / 293 tests).
- Shared-hunk review: PASS — staged CI files belong only to `CRL-20260812-009`; the complete candidate has no unselected changed path.
- Generated-file / secret review: PASS — no generated outputs, environment files, credentials, tokens, media objects or production data are staged.
- Independent review: GO for `commit` — paired root resolver P1 was repaired and independently re-reviewed; this exact mobile fingerprint remained unchanged, with no generated file or secret risk. P2: this repository's governance references a missing review document; it does not block this CI repair.
- Technical state: `committed`.
- User authorization: `selected-for-commit`; evidence: user asked to repair the root/mobile PR merge gates.
- Action conclusion: `GO` for commit completed. Push requires a new explicit approval bound to the final branch head.

#### RA-20260812-mobile-001-009-04

- Repository: `mobile`.
- Selected CRLs: `CRL-20260812-001`, `CRL-20260812-002`, `CRL-20260812-003`, `CRL-20260812-004`, `CRL-20260812-005`, `CRL-20260812-006`, `CRL-20260812-007`, `CRL-20260812-009`.
- Intended action: `push`.
- Branch: `codex/release-crl-20260812-001-007`.
- Target: `Dev`.
- Base: `origin/Dev@94b75a81c2a321f2ee44d9c197bf43b0f2b68733`; fetched at `2026-08-12T17:33:59+10:00` and unchanged.
- Candidate patch SHA-256: `6c6d4ed389a869dd63c074dcdc2942c6197a9e7f42f8a9435d4565aa68cedaa1`, excluding `docs/change-release-ledger.md`.
- Commit SHA: `ec95bf316d9f483f3dbb628295e62cb699ef6c98` (candidate content commit; final audit head is emitted by the release report).
- Remote branch at action verification: `origin/codex/release-crl-20260812-001-007@ed694512e951d4481b92d6f27aeb3925626a94ad`; source-range push verified at `2026-08-12T17:52:03+10:00`.
- Dependencies: paired root content commit `9ba3a1f72accc721af79c60b695e6eb7d1d73f44` for root `CRL-20260812-001`, `CRL-20260812-002`, `CRL-20260812-003`, `CRL-20260812-006`, `CRL-20260812-007`, `CRL-20260812-008`, `CRL-20260812-009`.
- Required validation: PASS — complete mobile `npm run check:ci` passed: typecheck, lint (0 errors / 109 existing warnings), button audit, and 56 suites / 293 tests; exact range/current ledger audits and whitespace checks pass.
- Shared-hunk review: PASS — complete selected range has no unselected path; current CI-repair paths are exclusive to `CRL-20260812-009`.
- Generated-file review: PASS — no generated outputs, environment files, credentials, tokens, media objects or production data are in the candidate.
- Technical state: `pushed`.
- User authorization: `approved-for-push`; evidence: user replied “授权” to push mobile content commit `ec95bf316d9f483f3dbb628295e62cb699ef6c98` (review head `84a0a10bc71bb7b2e968e469ae642959df52c258`) to this branch and authorized this final authorization receipt.
- Independent review: GO for `push` — independent exact-range review matched base, content commit and fingerprint; all 27 paths are selected, with no generated or sensitive files. P2: this repository's governance references a missing review document; it does not block this CI repair push.
- Action conclusion: `GO` for push completed; remote branch SHA was verified after the fast-forward push.

### Risks / Release Notes

- Risk: PR range coverage remains intentionally narrower than a Release Attempt; it cannot supply candidate hash, push authorization or independent-release evidence.
- Sensitive-information review: no credentials, tokens, environment values or production data are added.

## CRL-20260812-005 — 日用品任务标签中文化（mobile）

- **Status:** merged-dev
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
- Technical state: `pushed`.
- User authorization: `approved-for-push`; evidence: user replied “批准” after root `7046279c978ff982c1731b8a1af55fa3916c60de`, mobile `f57ca04e835659592f2dd46a54c7cec6a334df40` and both branch names were presented.
- Independent review: GO for `push`; evidence: independent committed-range review matched base/head/content commit/fingerprint, verified owner/date and notice-context proxy contract compatibility with root, and found no generated-file or secret risk.
- Action conclusion: `GO` for push completed; blockers: none.
- Remote branch / SHA: `origin/codex/release-crl-20260812-001-007@6c9a96173084be7bb3a100d191fc8bd63c6c6042`, confirmed immediately after the source-range push.

### Risks / Release Notes

- Risk: device and OTA rendering verification are not local-test evidence.
- Sensitive-information review: no secrets, tokens, media bytes, logs or production data are included.

## CRL-20260812-004 — 任务完成操作按钮等宽（mobile）

- **Status:** not-verified
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

- **Status:** not-verified
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

### Reconciliation Receipt — 2026-08-14

- **Authorized scope:** Stage 3 Mobile Ledger-only Reconciliation. Only this ledger was edited in a clean detached worktree based on `origin/Dev@afb46f1dd4b87dc4ab575e50ec9eb3bb38b7fedb`.
- **Source integrity:** the original mobile worktree was read-only. Its normalized porcelain fingerprint was `0393bdcc020355cba835b1c1079bcd36207aa01440fb24adfb43b275322475ac`; its untracked-file-list fingerprint was `49340ce1bffe04c976a358a2d61f57eab170d3d4dd61d7b247c537219be24440`. Both matched before and after R0 collection.
- **Canonical remote units:** the 18 CRLs present on current `origin/Dev` but absent from the prior local ledger are retained here with their remote immutable business identity unchanged.
- **Canonical remote IDs restored by this baseline:** CRL-20260729-003, CRL-20260729-004, CRL-20260730-001, CRL-20260730-002, CRL-20260731-005, CRL-20260731-007, CRL-20260731-008, CRL-20260805-005, CRL-20260805-006, CRL-20260809-001, CRL-20260809-002, CRL-20260810-001, CRL-20260811-004, CRL-20260811-007, CRL-20260811-008, CRL-20260811-009, CRL-20260812-007, CRL-20260812-009.
- **Git state matrix:** 23 remote CRLs have an existing content commit that is an ancestor of current `origin/Dev` and are marked `merged-dev`: CRL-20260725-023, CRL-20260729-003, CRL-20260729-004, CRL-20260731-007, CRL-20260803-003, CRL-20260805-001, CRL-20260805-002, CRL-20260805-003, CRL-20260805-005, CRL-20260805-006, CRL-20260807-001, CRL-20260807-002, CRL-20260808-006, CRL-20260809-002, CRL-20260810-001, CRL-20260811-004, CRL-20260811-005, CRL-20260811-006, CRL-20260811-007, CRL-20260811-008, CRL-20260811-009, CRL-20260812-005, CRL-20260812-009.
- **Unmerged commit:** CRL-20260809-001 has content commit `614dbd11545895488fc001138d30e2c63d970748` on documented local branches, but that commit is not an ancestor of current `origin/Dev` or `origin/main`; it is marked `committed-local-branch`, not Pending.
- **Evidence boundary:** the remaining 44 remote CRLs have no verified mobile content-commit evidence in the current ledger and are marked `not-verified`. Current `origin/main@59e8059cc8117f433bbff1739a17650c646d4144` does not contain this mobile ledger; no current-ledger content commit was verified as an `origin/main` ancestor. This is not a claim that their business behavior is absent from main.
- **Identity conflicts:** all 19 local/remote identity conflicts retain their remote canonical identity. Two source-only local deltas were independently proven and re-identified as CRL-20260814-001 and CRL-20260814-002; the remaining 17 local variants are `LOCAL_CONFLICT_ATTRIBUTION_BLOCKED` and do not receive new CRL numbers.
- **Blocked conflict IDs:** CRL-20260729-001, CRL-20260731-001, CRL-20260803-003, CRL-20260805-001, CRL-20260805-002, CRL-20260805-003, CRL-20260807-002, CRL-20260808-002, CRL-20260808-006, CRL-20260809-004, CRL-20260811-005, CRL-20260811-006, CRL-20260812-001, CRL-20260812-002, CRL-20260812-003, CRL-20260812-004, CRL-20260812-005.
- **Local-only matrix:** 11 non-conflicting local-only CRLs are `LOCAL_UNCOMMITTED_VERIFIED`; 5 are `LOCAL_LEDGER_ONLY`; 17 are `LOCAL_ATTRIBUTION_BLOCKED`. Only the verified group, plus the two separately re-identified conflict continuations, belongs in the final Pending / local-only list.
- **No migration or release action:** no source, test, Registry, Skill, configuration, or original-worktree file was changed. No `git add`, commit, push, PR, deployment, or OTA action was performed.

### Validation

- Candidate validation in progress: ledger regression, compile and exact coverage audit are run before commit.

### Release Attempts

#### RA-20260814-001

- Repository: `mobile`
- Selected CRLs: `CRL-20260812-003` (Mobile Ledger Finalization)
- Intended action: `commit`
- Branch: `codex/mobile-ledger-finalization-20260814`
- Base: `origin/Dev@afb46f1dd4b87dc4ab575e50ec9eb3bb38b7fedb`; fetched at `2026-08-14 13:20 AEST`
- Candidate patch SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty non-ledger content diff; this is a ledger-only candidate)
- Commit SHA: `8e04e375548d65d9e2a48927ea6d619bda290b3d` (candidate content commit; descendant of the recorded base).
- Dependencies: none.
- Required validation: `PASS`; evidence: R0 classification confirms `35 = 13 + 5 + 17`, `git diff --check` passed, and the mobile ledger audit returned Coverage PASS.
- Shared-hunk review: `PASS`; the user explicitly selected the complete Mobile Ledger Finalization as one ledger-only reconciliation scope. The independently reviewed exact range contains no runtime hunk, and every changed hunk is a status, classification, identity-receipt, or Release Attempt record in `docs/change-release-ledger.md`.
- Generated-file review: not applicable; no generated file is in the candidate.
- Technical state: `committed`
- User authorization: `selected-for-commit`; evidence: 2026-08-14 instruction to finalize the ledger-only reconciliation candidate.
- Independent review: `GO for commit`; evidence: independent read-only review completed after correcting the Release Attempt's CRL placement; no P0/P1/P2 findings remain.
- Action conclusion: `GO`; completed action: selected ledger-only commit created. The post-commit exact report verified the base, range, remote lineage, non-ledger fingerprint, generated-file and sensitive-information gates; its push gates remain `NOT VERIFIED` pending a separate exact push authorization.

### Risks / Release Notes

- Risk: missing `origin/Dev` history is correctly `NOT VERIFIED`, not assumed safe.
- Sensitive-information review: no credentials, tokens, database URLs, logs, caches or production data are included.

## CRL-20260812-002 — 反馈照片本地持久化、续传与私有预览收口（mobile）

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** not-verified
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

- **Status:** merged-dev
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

- **Status:** not-verified
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

- **Status:** merged-dev
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

- **Status:** committed-local-branch
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** not-verified
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** merged-dev
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

- **Status:** merged-dev
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** merged-dev
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

- **Status:** not-verified
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

## CRL-20260817-005 — P1-FDB-02 规范回归编号校正（mobile）

- **Repository:** `mobile`
- **Status:** ready; candidate prepared for combined local commit
- **Updated:** 2026-08-17 Australia/Melbourne
- **Request:** 修正历史深清反馈私有媒体的 Root/Mobile CRL 交叉引用。
- **Outcome:** FR-P1-FDB-02 明确关联 `root/mobile CRL-20260817-002`；不改变认证读取或界面行为。

### Implementation

- The corrected identity shares one staged registry hunk with the related original FDB units; no runtime mobile code changes in this follow-up.

### Files / Areas

- `docs/feature-regression-registry.md` — FDB-02 paired CRL identity.
- `docs/change-release-ledger.md` — scope evidence.

### Impact / Dependencies

- Paired unit: `root/CRL-20260817-005`; original source unit: `root/mobile CRL-20260817-002`.
- API / storage / authorization / native runtime / production data: none.

### Validation

- Registry, ledger and diff checks passed in the isolated replacement candidate.

### Staged Commit Scope

- **Repository:** mobile
- **Status:** prepared.
- **Untracked review:** none; clean isolated candidate.
- `docs/feature-regression-registry.md` — SHA-256: `8cca22975fab8886f5bc929af2026b2b724feca471a100c2ece6535f8111594a`

### Release Attempts

- None independently recorded; the exact paired combined attempt is recorded under mobile/CRL-20260817-007.

### Risks / Release Notes

- Governance reconciliation only; it does not prove OTA or device rendering.

## CRL-20260814-003 — Mobile Legacy 冻结边界与分层台账门禁

- **Repository:** `mobile`
- **Status:** ready
- **Updated:** 2026-08-14 21:51 AEST
- **Request:** 为已冻结的 Root/Mobile 脏工作区建立非日期化的 `LEGACY_FROZEN_WORKSPACE` 边界，并在独立 mobile 仓库实施可执行的本地提交与已提交范围门禁；不追溯、恢复或发布任何 Legacy 业务 hunk。
- **Outcome:** Mobile CRL 跨仓引用使用 `mobile/CRL-ID`；本地候选只在干净工作树中按路径与 hunk 通过，提交后按精确 `base...head` 复核。ledger receipt 只能记录已成功的内容提交，不可成为绕过业务 hunk 的入口。

### Implementation

- Previous behavior: mobile 审计仅能检查路径覆盖或 Release Attempt，无法阻止未跟踪文件、仓库身份缺失、暂存 hunk 漏记，历史脏工作区也容易被误当作候选范围。
- New behavior: 增加 `--pre-commit --repo mobile --crl` 的本地暂存检查，强化 `--release-report` 的 canonical identity、精确范围 hunk 与清洁工作树检查；mobile Agent 同步冻结与分层审计规则。
- Key decisions: 保留现有 current-worktree 与 `--base/--head` 覆盖能力；不改业务页面、功能测试、Registry、CI 工作流、依赖、原生构建、API、数据库或生产数据。

### Files / Areas

- `AGENTS.md` — modified: mobile 独立仓库的冻结边界与分层门禁规则。
- `scripts/audit_change_release_ledger.py` — modified: 本地候选、范围 hunk、canonical identity 和 clean-worktree 检查。
- `scripts/tests/test_audit_change_release_ledger.py` — modified: 覆盖通过候选、未跟踪阻断、hunk 不匹配阻断、精确范围 receipt、跨 CRL ledger hunk 与伪造 receipt 指纹阻断。
- `docs/change-release-ledger.md` — modified: 本独立治理 CRL 与 Release Attempt receipt。

### Impact / Dependencies

- API / database / configuration / CI: none.
- Production / device / user role: none.
- Dependencies: `root/CRL-20260814-002` is the matching Root governance unit; neither CRL depends on an extraction from the frozen business workspace.
- Related units: `mobile/CRL-20260814-001` and `mobile/CRL-20260814-002` remain separate, unselected source-only continuations.

### Validation

- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/tests/test_audit_change_release_ledger.py` — passed: 25 tests, including verified receipt acceptance, cross-CRL staged-ledger blocking and bad receipt content-fingerprint blocking.
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/audit_change_release_ledger.py --pre-commit --repo mobile --crl CRL-20260814-003` — passed: canonical identity, selected paths, untracked review, selected-ledger section and 43 non-ledger hunk fingerprints all matched.
- `git diff --check` — passed.
- `npm run check:ci` — blocked after its ledger audit passed because this clean worktree intentionally has no installed dependencies and `tsc` is unavailable; no dependency install is authorized in this governance scope.
- Governance read-only boundary: audit functions invoke local Git only; no mobile screen, service API, database, device, EAS/native build or production environment is in scope.

### Staged Commit Scope
- **Repository:** `mobile`
- **Status:** `prepared`
- **Untracked review:** `none; clean candidate worktree confirmed`
- `AGENTS.md` — SHA-256: `ae5042d4621108e5957b94792ce7c81fc444b4d3109057035ebf7a665439e425`
- `scripts/audit_change_release_ledger.py` — SHA-256: `0485fd6915b60941b191e112b7627a0f4391711e94f547233095c96dc4d3e4d9`
- `scripts/audit_change_release_ledger.py` — SHA-256: `06e9da5af178fcc4caffc446ed2e24e685761fc185ad803b003563533e374f77`
- `scripts/audit_change_release_ledger.py` — SHA-256: `0ac1525678952e50adeb934c115fd45fca54a7bdb6b4bca29a6bd7b8d24a172b`
- `scripts/audit_change_release_ledger.py` — SHA-256: `1b5fb463fe8b606c69fd3ad49036a661e1ab79a4502de6b91a2f0b232fe14cc9`
- `scripts/audit_change_release_ledger.py` — SHA-256: `29e0e5d5ae854b91bf4931eee5aa3ce7c24baceb7aded46ef35069c2124ab416`
- `scripts/audit_change_release_ledger.py` — SHA-256: `47b16ef7089ac774d46214b89d88c6bcb9cecab36f20d55bd703d76f70719df1`
- `scripts/audit_change_release_ledger.py` — SHA-256: `4c002c6d6d6c0a32bc5e452a07c966dc574276a844794646fef318ad77dd9d7d`
- `scripts/audit_change_release_ledger.py` — SHA-256: `4c6f6318eb20231d465d075116f4c9b36358bb6cc75ac20de551aa5570c7a359`
- `scripts/audit_change_release_ledger.py` — SHA-256: `56516d457b72af1e6e0bfdb7392c738e6816d1701c70bd35c7f48c44113d24da`
- `scripts/audit_change_release_ledger.py` — SHA-256: `5b2610bcd0634eee2baf832f6704ec6aef5a1702c98b2409f07f91d43c2007e5`
- `scripts/audit_change_release_ledger.py` — SHA-256: `5e92f2f371ff84495ce85a553fa3e556d61e21ee2c376e245232069364696b1b`
- `scripts/audit_change_release_ledger.py` — SHA-256: `638d7a3f967e75b2a84514db4b2552a71c04fc1ee423f561550b8c742f5a96ef`
- `scripts/audit_change_release_ledger.py` — SHA-256: `7a7ae2164d0f45eb3b497985588db82f45e9432c57103b875c827d788364505c`
- `scripts/audit_change_release_ledger.py` — SHA-256: `7d790629856ef31206f868bb787867c271abc3e5e8fa74734f2ed22f054fd917`
- `scripts/audit_change_release_ledger.py` — SHA-256: `8319d4af6512f046abe5aefcbdf1be5b351dda6a104bab760db4d08f010173ec`
- `scripts/audit_change_release_ledger.py` — SHA-256: `9538785cbdcc465be4fbac52c3d58210bf4ad2d330c452e19352a03565cd1534`
- `scripts/audit_change_release_ledger.py` — SHA-256: `95431539215650b427d3bc17d987f81612bb9297d47715c70847f4a4707a359f`
- `scripts/audit_change_release_ledger.py` — SHA-256: `a51a55ce625c93d6fa09f9a02c6380316627b5fb0baa50f7accbc76310df8f82`
- `scripts/audit_change_release_ledger.py` — SHA-256: `a5f40ea25ea24eb72232e86f515ec9aad938c0bd038673e52187568a3230b7f6`
- `scripts/audit_change_release_ledger.py` — SHA-256: `aba40c7c5b638b0aa5e45170270d09c823da5fbefed9eb69aada75253a80d674`
- `scripts/audit_change_release_ledger.py` — SHA-256: `b9cdf50e233b8ec72e6a28594a0e87af69f691c71db0af59dea8f58c026f1920`
- `scripts/audit_change_release_ledger.py` — SHA-256: `c48cc52c8e610da8c9a1c4b292b19e39a9b5c91a2baa29a9515f45c2e7ae7aae`
- `scripts/audit_change_release_ledger.py` — SHA-256: `c89a3efd5de56faaef75518a8a02b433c9a1f95dcf52e947632354a367ae7e4a`
- `scripts/audit_change_release_ledger.py` — SHA-256: `d4e85a39aa966a85119870890257946e0885d0dc22f56a03925eca57284cb222`
- `scripts/audit_change_release_ledger.py` — SHA-256: `d6c85fb8f6e44d4c718cfc85465dabccf2529711e19e4578ab3c989655fea979`
- `scripts/audit_change_release_ledger.py` — SHA-256: `de2f4f5b0e0b57aa5f34d3c8dd5008a6a8a1e43a4bce264b5420abcc431fe866`
- `scripts/audit_change_release_ledger.py` — SHA-256: `f7140a93472a38725186d5714b5b9a231e4ca7a4f0c1e20c4eece7dfff895da0`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `0785911eb1be14086179d00a1bff5cbdd622295fd0d1a1a78934e82ff6214909`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `1f6520e8915461a9331547b2bb745f2c82de1d8c8e9e0fd2fa142cc5b58f42c1`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `384217018cdf605bcf19fd716b4856c8c857179aca8e380e8b60e972e6176f8a`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `3dd71a751e66437e60ca3370f16c6fe29f7cb4457bed8ea150ee2e399fa0194a`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `69ff1580d3609303cc89af20c1093ad6dc665b791c0c8c94137d5529573d007b`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `6bdece6c4545b2deae59ef7a113a5ab4dcc213f56a71e36fde2eb9e2b7acceab`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `6dc35d590d6d55238db8e05a188320214e77427fbac975023f01c6a6f41acc24`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `92cf1c5ab8d574645975db435d4dff4dbc25afb99214f7582a03dc449cfc3c65`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `94dbabf5153e6c88778d8239c1f9b10c240afadfe857ee68e9b08be6532ca518`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `9d4d90d5c3c6472601c56df72f839af9db76cde2ddc40865f4403b3bfbf61f0c`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `9f7e07582e0594c1dfe633680928ad47f6e38b84f662dbf2e139038e538fae3f`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `af6a38ea5e0dcc3b8dbcc6bc391a2454531aa76df24c7d3b0ebd42db8f72349c`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `eb6ed5581db057ac5a8238887012e4d2ce820de1038eee7f4ebca23db57537d2`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `eddac5a800751f8622c8e659d70c936f5475b390c463e02f58e400566be2de5b`
- `scripts/tests/test_audit_change_release_ledger.py` — SHA-256: `f35c682758c77f015935bcc7cc8af153680ba13e64c8d544d8d379295ef8167d`
### Release Attempts

#### RA-20260814-003

- Repository: `mobile`
- Selected CRLs: `CRL-20260814-003`
- Selected CRL identities: `mobile/CRL-20260814-003`
- Intended action: `commit`
- Branch: `codex/governance-ledger-gates-20260814`
- Base: `origin/Dev@4c264ba2e46b9bdc2632509f73eb087a60a2fa9a`; fetched at `2026-08-14 AEST`
- Candidate patch SHA-256: `c7c83a20601227ed9cc4bfbed0b0b76ff143862dab19310dd83056912f349575` excluding `docs/change-release-ledger.md`
- Commit SHA: `879ee3b61be6ae6f682e4421021028bc7bf82f02`; content commit for this selected CRL
- Dependencies: `root/CRL-20260814-002` is parallel governance only; no cross-repository content dependency.
- Required validation: `PASS` — focused audit suite, diff check and exact pre-commit gate passed; `npm run check:ci` remains blocked because this clean worktree intentionally has no dependencies and `tsc` is unavailable.
- Shared-hunk review: PASS — 43 declared non-ledger hunks plus the selected CRL ledger section.
- Generated-file review: not applicable.
- Technical state: `committed`
- User authorization: `selected-for-commit` — user said “就这样做吧”.
- Independent review: `GO` — 2026-08-14 fresh independent read-only pre-commit review found no P0/P1.
- Action conclusion: `GO` — commit only; push, PR, merge and deployment remain separate actions.

#### RA-20260814-004

- Repository: `mobile`
- Selected CRLs: `CRL-20260814-003`
- Selected CRL identities: `mobile/CRL-20260814-003`
- Intended action: `push`
- Branch: `codex/governance-ledger-gates-20260814`
- Base: `origin/Dev@4c264ba2e46b9bdc2632509f73eb087a60a2fa9a`; fetched at `2026-08-14 22:34 AEST`
- Candidate patch SHA-256: `c7c83a20601227ed9cc4bfbed0b0b76ff143862dab19310dd83056912f349575` excluding `docs/change-release-ledger.md`
- Commit SHA: `879ee3b61be6ae6f682e4421021028bc7bf82f02`; content commit for this selected CRL
- Remote branch: `origin/codex/governance-ledger-gates-20260814@b4fb6f14209b5dd08aee950f0e1f0c792b40298c`; initial push succeeded on 2026-08-14.
- Dependencies: `root/CRL-20260814-002` is parallel governance only; no cross-repository content dependency.
- Required validation: `PASS` — focused audit suite, diff check and exact range audit passed; `npm run check:ci` remains blocked because this clean worktree intentionally has no dependencies and `tsc` is unavailable.
- Shared-hunk review: `PASS` — 43 declared non-ledger hunks plus the selected CRL ledger section.
- Generated-file review: not applicable.
- Technical state: `pushed`
- User authorization: `approved-for-push` — user said “推送” after receiving the exact Mobile branch and current HEAD `2de3a035c06f18111d9c1cb62812886cef7af279`.
- Independent review: `GO` — 2026-08-14 fresh independent read-only pre-commit review found no P0/P1.
- Action conclusion: `GO` — pushed to the authorized branch; PR, merge and deployment remain separate actions.

### Risks / Release Notes

- Risk: this gate deliberately cannot prove or classify frozen historical working-tree deltas; a later business recovery needs a new CRL and fresh hunk extraction.
- Rollback: revert only this governance CRL's commits; no runtime data or mobile device state needs rollback.
- Sensitive-information review: no secrets, credentials, tokens, `.env` values, private URLs, caches, logs or production data are added.
- Git state: clean worktree candidate on `origin/Dev@4c264ba2e46b9bdc2632509f73eb087a60a2fa9a`; not committed, not pushed, no PR, not published, no device verification.

### Governance extraction — 2026-07-29

- `package.json` 的质量 scripts hunk、`.nvmrc` 和 `.github/workflows/quality.yml` 从这个长期未完成的屏幕测试单元中拆出，由 `CRL-20260729-001` 单独治理、验证和选择性提交。
- 本单元保留屏幕测试和 SafeArea 业务/UI 范围；不得因为治理文件的提交而把这些未完成页面改动混入发布。
## CRL-20260817-006 — P1-FDB-03 规范回归编号校正（mobile）

- **Repository:** `mobile`
- **Status:** ready; candidate prepared for combined local commit
- **Updated:** 2026-08-17 Australia/Melbourne
- **Request:** 修正日用品前后照片保护规则的 Root/Mobile CRL 交叉引用。
- **Outcome:** FR-P1-FDB-03 明确关联 `root/mobile CRL-20260817-003`；不修改认证读取或界面行为。

### Implementation

- The corrected identity shares one staged registry hunk with the related original FDB units; no runtime mobile code changes in this follow-up.

### Files / Areas

- `docs/feature-regression-registry.md` — FDB-03 paired CRL identity.
- `docs/change-release-ledger.md` — scope evidence.

### Impact / Dependencies

- Paired unit: `root/CRL-20260817-006`; original source unit: `root/mobile CRL-20260817-003`.
- API / storage / authorization / native runtime / production data: none.

### Validation

- Registry, ledger and diff checks passed in the isolated replacement candidate.

### Staged Commit Scope

- **Repository:** mobile
- **Status:** prepared.
- **Untracked review:** none; clean isolated candidate.
- `docs/feature-regression-registry.md` — SHA-256: `8cca22975fab8886f5bc929af2026b2b724feca471a100c2ece6535f8111594a`

### Release Attempts

- None independently recorded; the exact paired combined attempt is recorded under mobile/CRL-20260817-007.

### Risks / Release Notes

- Governance reconciliation only; it does not prove OTA or device rendering.

## CRL-20260814-004 — P1-NTF-01 Legacy Recovery：当天临时通知认证媒体渲染（mobile）

- **Repository:** `mobile`
- **Status:** verified; selected-for-commit
- **Updated:** 2026-08-15 Australia/Melbourne
- **Request:** 从 `mobile` Legacy source `CRL-20260813-002` 恢复 P1-NTF-01 的 Inbox 列表、详情和大图认证读取到 `origin/Dev@7ecdbf5114a61ecf951efde194d0a56eeccc2982`，仅处理 `guest_luggage_updated` 的私有照片。
- **Outcome:** `guest_luggage_updated` 的缩略图、详情图和大图都通过已有认证媒体组件读取，并从同一 Inbox `data.guest_luggage_id` 传递精确通知上下文；缺失或非 UUIDv4 的 ID 时不渲染、不请求私有媒体。其他通知类型保持当前 Dev 行为。

### Implementation

- Previous behavior: 通知列表和详情对临时通知直接使用私有引用作为 `<Image source={{ uri }}>`，认证代理无法获得通知 ID。
- New behavior: 仅 `guest_luggage_updated` 使用 `CleaningMediaImage` / `CleaningMediaPreview`；共享媒体库先将 `guest_luggage_id` 规范化为 UUIDv4，只有有效值才允许列表、详情和 viewer 创建私有媒体组件或请求。既有 `GuestLuggageCard` 保持现有职责，不重复修改。
- Key decisions: 不迁移钥匙、问题反馈、收件人、Badge、Push 或缓存治理；没有原始 URL 回退。

### Files / Areas

- `src/screens/tabs/NoticesScreen.tsx` — Inbox 列表缩略图认证读取。
- `src/screens/notices/NoticeDetailScreen.tsx` — 详情缩略图和 viewer 认证读取。
- `src/lib/cleaningMedia.ts` — 临时通知媒体 ID 的 UUIDv4 规范化与失败关闭。
- `src/screens/tabs/NoticesScreen.test.tsx`, `src/screens/notices/NoticeDetailScreen.test.tsx` — ID 全链路回归与缺失 ID 的零渲染/零请求边界。
- `src/lib/cleaningMedia.test.ts`, `src/components/CleaningMediaPreview.test.tsx`, `src/components/GuestLuggageCard.test.tsx` — 使用真实 `mzapp/...` 引用的认证 URL / 卡片契约。
- `docs/change-release-ledger.md` — 本恢复候选记录。

### Impact / Dependencies

- Backend API contract: requires the paired `root/CRL-20260814-003` exact association and authorization path.
- Database / migration / OTA / production data: none.
- Deferred: `docs/notification-registry.yaml` and non-P1 notification governance are out of scope and do not block this source-specific render repair.

### Validation

- `npm test -- --runInBand --no-cache src/lib/cleaningMedia.test.ts src/components/CleaningMediaPreview.test.tsx src/components/GuestLuggageCard.test.tsx src/screens/tabs/NoticesScreen.test.tsx src/screens/notices/NoticeDetailScreen.test.tsx` — passed: 5 suites, 34 tests; covers valid UUIDv4 propagation plus missing and non-string invalid ID zero-render boundaries.
- `npm run typecheck` — passed.
- `npm run lint` — passed with 0 errors and 109 existing warnings.
- `git diff --check` — passed.
- Independent candidate review (2026-08-15): initial `NO-GO` identified missing-ID private-media rendering; follow-up review also rejected non-string invalid IDs. Both remediated with UUIDv4 validation plus list/detail/viewer suppression. Final combined independent review: `GO` for the commit action.
- Compatible backend deployment, OTA/build installation, and real-role device verification: not run.

### Staged Commit Scope

- **Repository:** `mobile`
- **Status:** prepared for selected `mobile/CRL-20260814-004` and `mobile/CRL-20260815-001` only.
- **Allowed paths:** only the eight non-ledger paths listed in **Files / Areas** plus this ledger section.
- **Untracked review:** none expected.
- `src/components/CleaningMediaPreview.test.tsx` — SHA-256: `03168d0888faca1d4f9fb088ed233f7dde496f28f1478b1c26be90c3efa31a6c`
- `src/components/CleaningMediaPreview.test.tsx` — SHA-256: `555d7639d4e2f9a6c4819133f05f3d0efab7b9850926ed3cad07d30cd4bd814a`
- `src/components/CleaningMediaPreview.test.tsx` — SHA-256: `d9361e678c8ef02feceb91da5ddae5ff1bc3feae94547d82a8ac44e69aa3b892`
- `src/components/GuestLuggageCard.test.tsx` — SHA-256: `637c60c306829a8078688e7b476775271c331abe7fcd7b4f4d9ec8708e9d1fe4`
- `src/components/GuestLuggageCard.test.tsx` — SHA-256: `63c45e11e05e9342818b66249eced7d0a109dbbfbd720684cd62c52d98ae4b94`
- `src/components/GuestLuggageCard.test.tsx` — SHA-256: `dcd1fef7448c31b85ed10632256a30681b1a0287eaefee30830f097c8a84544f`
- `src/lib/cleaningMedia.test.ts` — SHA-256: `8acd4fa4340dbb4d826cc34ad6a402a5e0050d186f822009e9e496a70c3c90e0`
- `src/lib/cleaningMedia.test.ts` — SHA-256: `95d1c2c47869dc84f2449736670761db6066ed90fd03bbf2aa52010b7a61fac8`
- `src/lib/cleaningMedia.test.ts` — SHA-256: `b1e5aa5060a1515df2157df64dd3c359bc3fbbb1b7f0263ccc061c560de80cb9`
- `src/lib/cleaningMedia.test.ts` — SHA-256: `f74c4aad91af7fa1a864d999177898656572cf24a697ea27963185c49ca0195a`
- `src/lib/cleaningMedia.ts` — SHA-256: `a4c15db59f6150ac251cf7baf29e9c25689172ff0e66279595b2e204218ed9ec`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `0d2c5db623cf6fd367c30767eded315aa01f63b0015fc804d4cd5769151473e9`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `0d479cbc9a70b4d17b35d0f25487244aa5d99eca68d56390abf679e2e6a14500`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `251fb7e8aa2d66ea630f199056536e6e0fedd3121043f053c66f18ac4d2f83fa`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `7b1c33f89fcd0937312d56926700c7a1bed267a8f93ba00ffdc1c695b09b7d0e`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `b5fe994835167303fcd55f1d3388dd66ac5b7458d4cf10bfffadc61e38e98053`
- `src/screens/notices/NoticeDetailScreen.test.tsx` — SHA-256: `b7961a5853439f8cede691ddc2e31b99dfe8f8a8e07924707f960f34a5b94770`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `17ad257384a1b824179f3863b3893b346526ede8295ebc8d353cd9f8e35ca173`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `2564504d4401e818da174cca8d7679ae381942cfc54fb4488d923f98edb0fdae`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `59a32bc95d3a1add647feef289202484a902652870435e0c14ccadd105d6aedd`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `5cf643e166c329926af8acec4f3763d3bb53932ffc959dd92ab29bed2b0498cc`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `65e6312e9dfeb2e4e1a3b7d956f28d8b41a510f0c73e7b0cc9f691f7ab0d0e7b`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `67a9e7607a11f7bd4ae36d7ed9f4fcbee5935fe6b9c653fc1f8f6c29dcd19962`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `703ca8bc7149c2d0e99b3d07f0b781e0d4c01c52f9056a6e0d5d31b64c1d489f`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `800bf8cb1e210b3f886122f274e363c5543139d2fe5daf4cfe6789fe2b1d7845`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `8b0f5c92c299c52370969c944d822807dd2967ce230cef62ab48089c34a266b5`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `9a875952f112d886fcc90135bf6073fe248d7c22e6529c6b661a212731651a34`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `a3064a4282fd6241ea5cfb52fedd0687bfdee84670f13a7b63f594cf5757f211`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `b1850ac316d18ec3b916830161efdc9742743d477aefc1a35c06d6318532bed3`
- `src/screens/notices/NoticeDetailScreen.tsx` — SHA-256: `f755e9681d22a494ad2027883720be682a00172e3068ee0d625b725db26b9a64`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `389df156ebb8b020aabd2c689e033e7fb2315767afcd054e21a4f1b454ac274d`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `720deee79b29a24a64d522d3b89b540862cb5e11023c3826c1b7de4170994d94`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `9a5ffe46b72daafa6778379aecc3197d2be7c428af2791cfea6f2a65167ce9af`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `a8aacc79d19113d262daf693c3cb57943296112e1399da51255e67288a619960`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `d8ada42dbc13de41f7b3912e88e6804e278e77b0f42a4689001fff76789fbeb0`
- `src/screens/tabs/NoticesScreen.test.tsx` — SHA-256: `f8387bd12a1995dd63e4717944ad11fafcfaca352ac676a710e5e221e5bf8632`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `301104578b63f6409294ac655c98bb71dda4122a30854b2e17bfa23048e2465b`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `4b55e41a388096e08968381f1de6e41f2091a28d368d36c7875681aa285bc15b`
- `src/screens/tabs/NoticesScreen.tsx` — SHA-256: `c3f45e29fe1e82bed32539d4ff77b59a6c6b5baafe37a7cf7d47a0c7e17e0244`

### Release Attempts

- See `RA-20260815-p1-ntf01-ntf02-mobile-01` under `mobile/CRL-20260815-001`; this paired CRL is selected only for the same commit attempt.

### Risks / Release Notes

- Runtime risk: tests prove token/context propagation, not receipt of a compatible OTA/build on a real device.
- Security boundary: notification subtype selection is fail-closed on missing or invalid `guest_luggage_id`; no raw private URL is introduced for this subtype.
- Sensitive-information review: no secrets, credentials, tokens, `.env` values, private media payloads, production data, or logs are added.
## CRL-20260817-007 — P1-FIN-01 凭证读取无 DDL 边界与契约补全（mobile）

- **Repository:** `mobile`
- **Status:** ready; paired source fixed and local regression passed
- **Updated:** 2026-08-17 Australia/Melbourne
- **Request:** 将移动端凭证认证读取与 Root 的无 DDL reader hardening 纳入同一安全替代候选。
- **Outcome:** 已保存凭证继续仅经 `receiptId + imageId` 认证 source 读取；与 Root 的无 DDL 路径成对发布。

### Implementation

- No raw URL fallback or new mobile runtime behavior is added here; this unit corrects FIN source/follow-up identity and binds the paired Root read-only boundary.

### Files / Areas

- `docs/feature-regression-registry.md` — FIN original/follow-up identity.
- `docs/change-release-ledger.md` — superseding combined release evidence.

### Impact / Dependencies

- Paired unit: `root/CRL-20260817-007`; original source unit: `root/mobile CRL-20260817-004`.
- API / storage / authorization / native runtime / production data: none in this mobile follow-up.

### Validation

- Mobile expense-receipt helper tests, typecheck, lint/static raw-URL audit and paired Root receipt contract are recorded as passing locally.

### Staged Commit Scope

- **Repository:** mobile
- **Status:** prepared.
- **Untracked review:** none; clean isolated candidate.
- `docs/feature-regression-registry.md` — SHA-256: `41d34bbe3132899ae8a80ab1ec5c992ebe2b6cfb6bdd98e0e8d8c13e895db5bf`

### Release Attempts

#### RA-20260817-004

- Repository: `mobile`.
- Selected CRLs: `CRL-20260817-002`, `CRL-20260817-003`, `CRL-20260817-004`, `CRL-20260817-005`, `CRL-20260817-006`, `CRL-20260817-007`.
- Selected CRL identities: `mobile/CRL-20260817-002, mobile/CRL-20260817-003, mobile/CRL-20260817-004, mobile/CRL-20260817-005, mobile/CRL-20260817-006, mobile/CRL-20260817-007`.
- Intended action: `commit`.
- Branch: `codex/p1-fdb-fin-20260817-final-v2`; target: `Dev`.
- Base: `origin/Dev@e285ad7679c913a0ca8fbe3b41b410542f143bc4`; fetched at `2026-08-18T00:08:41+1000`.
- Candidate patch SHA-256: `e314e0c3221de37349274e4daa8b1b7ea41fc8cb58c7af9882c5e0adfb376c8d`, excluding `docs/change-release-ledger.md`.
- Commit SHA: `fdfe57c685dde4288433268110bfe901419cdcda`; candidate content commit.
- Dependencies: paired root CRLs `002` through `007`; both repositories must travel together.
- Required validation: PASS — targeted mobile media tests, shared reader tests, typecheck/lint/static raw-URL audit and paired Root evidence recorded for the isolated candidate.
- Current isolated-candidate recheck: TypeScript is NOT VERIFIED in this worktree because it intentionally has no `node_modules` and no dependency installation is authorized; the unchanged mobile source-test evidence remains recorded above.
- Shared-hunk review: PASS — registry identity hunks are intentionally shared with their original unpushed source units under this exact selected range.
- Generated-file / secret review: PASS — no generated files, credentials, private bytes, logs or production data are staged.
- Technical state: `committed`.
- User authorization: `selected-for-commit`; evidence: user explicitly authorized replacement of unpushed CRL-002 through CRL-004 scope evidence with corrected CRL-005 through CRL-007 follow-ups.
- Independent review: GO for commit — final independent read-only review verified the exact base, candidate fingerprint, full staged range, authenticated readers, registry mappings and scoped evidence.
- Prior blocked attempt: `RA-20260817-003` was independently NO-GO for push because of incorrect CRL mappings, incomplete media contract registration and request-time schema bootstrap; it remains preserved as source evidence on the prior recovery branch and is superseded here rather than erased.
- Action conclusion: `GO` — candidate content committed locally; push, PR, merge, deployment, OTA, production writes and device verification remain unapproved.

#### RA-20260818-001

- Repository: `mobile`.
- Selected CRLs: `CRL-20260817-002`, `CRL-20260817-003`, `CRL-20260817-004`, `CRL-20260817-005`, `CRL-20260817-006`, `CRL-20260817-007`.
- Selected CRL identities: `mobile/CRL-20260817-002, mobile/CRL-20260817-003, mobile/CRL-20260817-004, mobile/CRL-20260817-005, mobile/CRL-20260817-006, mobile/CRL-20260817-007`.
- Intended action: `push`.
- Branch: `codex/p1-fdb-fin-20260817-final-v2`; target: `Dev`.
- Base: `origin/Dev@e285ad7679c913a0ca8fbe3b41b410542f143bc4`; fetched at `2026-08-18T00:08:41+1000`.
- Candidate patch SHA-256: `e314e0c3221de37349274e4daa8b1b7ea41fc8cb58c7af9882c5e0adfb376c8d`, excluding `docs/change-release-ledger.md`.
- Commit SHA: `fdfe57c685dde4288433268110bfe901419cdcda`; candidate content commit.
- Pre-push receipt parent: `1b341abc7d0bbfb329817cc362dceec4fbb1876f`.
- Dependencies: paired root CRLs `002` through `007`; both repositories must travel together.
- Required validation: PASS — exact `base...pre-push receipt parent` release report passed with selected paths, 41 hunk fingerprints, clean worktree and no sensitive/generated files.
- Shared-hunk review: PASS — unchanged from the committed candidate range.
- Generated-file / secret review: PASS — no generated files, credentials, private bytes, logs or production data are selected.
- Technical state: `committed`.
- User authorization: pending final commit-bound confirmation; user authorized pushing the exact pre-push receipt parent shown above, and must confirm the final receipt head after this entry is committed.
- Independent review: GO for push-attempt receipt commit — independent read-only review verified the exact base, branch, content commit, staged ledger-only scope and absence of nonledger or sensitive changes; this does not authorize `git push`.
- Action conclusion: `NOT VERIFIED` pending final receipt, push review and final commit-bound confirmation.

### Risks / Release Notes

- Source/local tests do not prove OTA delivery, historical object availability or device rendering.

## CRL-20260816-001 — 修复移动端 PR 范围空白检查失败

- **Repository:** `mobile`
- **Status:** ready
- **Updated:** 2026-08-16 14:31 AEST
- **Request:** 修复 Mobile quality 在 PR Ledger range audit 阶段报出 `Git command failed.` 的问题。
- **Outcome:** `main...Dev` 的 PR 差异不再因 `src/lib/companyContent.test.ts` 文件末尾空白行而使 `git diff --check` 返回失败；账本审计可继续到覆盖检查。

### Implementation

- Previous behavior: 测试文件结尾多出一个空白行，`git diff --check` 报 `new blank line at EOF`；审计脚本将其包装为通用 Git 错误并停止 CI。
- New behavior: 删除该末尾空白行，不改变测试断言或任何移动端运行时逻辑。
- Key decisions: 仅修复导致 CI 阻断的格式错误；不修改审计脚本、工作流、依赖或业务功能。

### Files / Areas

- `src/lib/companyContent.test.ts` — 删除 EOF 空白行，使 PR 差异通过 Git 空白检查。
- `docs/change-release-ledger.md` — 记录本次独立的 mobile CI 修复单元。

### Impact / Dependencies

- App/API/database/config/dependencies: none.
- Feature Regression Registry: not applicable; no business invariant, runtime behavior or application route changes.
- Related units: none.

### Validation

- `git diff --check origin/main` and `git diff --check` — passed in the isolated worktree; confirms the prospective `main...Dev` content no longer contains the EOF blank-line error.
- `python3 scripts/audit_change_release_ledger.py` — passed: 2 changed files, 2 recorded files, coverage PASS.
- `npm run check:ci` — passed: ledger audit, typecheck, lint (0 errors; 109 existing warnings), button audit, fast Jest and full Jest completed successfully.
- Independent pre-commit review — GO for `commit` only: no P0/P1; candidate scope, non-ledger fingerprint, staged hunk and secret/production-write boundaries were independently verified.

### Staged Commit Scope

- **Repository:** `mobile`
- **Status:** prepared
- **Untracked review:** none; clean candidate worktree contains no untracked files.
- `src/lib/companyContent.test.ts` — SHA-256: `ca80c2293c04b2074046436fca00193f6f28ff08ae98ce0e2e9c23c8b5a214c9`

### Release Attempts

#### RA-20260816-001

- Repository: `mobile`
- Selected CRLs: `CRL-20260816-001`
- Selected CRL identities: `mobile/CRL-20260816-001`
- Intended action: `commit`
- Branch: `codex/fix-mobile-ci-whitespace-20260816`
- Base: `origin/Dev@195b9e8ae26a13a9f9e604dd2cb4bb8eb8dda3e0`; fetched at `2026-08-16 14:11 AEST`
- Candidate patch SHA-256: `1a69f3f78b5c6d0dcb76aa50ac254242cbd4d31c2b792e6722a5936360bb6412` excluding `docs/change-release-ledger.md`.
- Commit SHA: `aa02d04b1b7fad0eaa6596ba44939fe87648abf1`; candidate content commit.
- Dependencies: none.
- Required validation: PASS — `npm run check:ci` completed successfully; lint has 109 pre-existing warnings and zero errors.
- Shared-hunk review: PASS — one declared non-ledger hunk matches the staged source deletion; the ledger hunk is confined to this CRL section.
- Generated-file review: not applicable — source test and Markdown ledger only.
- Technical state: committed.
- User authorization: selected-for-commit — user said “推送” after being shown only `mobile/CRL-20260816-001`.
- Independent review: GO — independent read-only pre-commit review on 2026-08-16 found no P0/P1; verdict applies only to this exact candidate commit.
- Action conclusion: GO — candidate content commit created; a post-commit exact range audit and a new commit-bound user authorization remain required before push.

### Risks / Release Notes

- Risk: this removes only a whitespace-only CI blocker; it does not improve the auditor's generic error reporting.
- Governance P2: `origin/Dev` does not yet version `docs/codex-release-review.md`; the reviewer used the original worktree's procedure only as read-only instructions. Template restoration is out of scope for this CI fix.
- Rollback: restore the final blank line if necessary, though doing so will reproduce the CI failure.
- Sensitive-information review: no secrets, credentials, tokens, `.env` values, private URLs, caches, logs, or production data are added.
- Git state: candidate content commit `aa02d04b1b7fad0eaa6596ba44939fe87648abf1` on `codex/fix-mobile-ci-whitespace-20260816`, based on `origin/Dev@195b9e8ae26a13a9f9e604dd2cb4bb8eb8dda3e0`; not pushed, no PR, deployment/OTA, or device verification.
