# Design QA

## 2026-10-28 — MZ-078 / MZ-090

- Source reference: `libfile_d1a95f307f3c81918d02454ff1953214` (ordinary cleaning read-only details)
- Source reference: `libfile_c8272d8a3d8c8191a51c1ce0e0ada9c8` (inspector photo layout)
- Target widths: 320, 360, 375, 390, and 430 px; font scale 1.0, 1.2, and 1.35.

### Source findings

- MZ-078: empty bathroom, sofa, and bedroom cards appear in an ordinary cleaning history even though they are not cleaner-required capture items.
- MZ-090: a photo-heavy bedroom card determines the row height in a three-column phone grid, stretches neighboring cards into large blank columns, and pushes later rooms far down the page.

### Candidate review

- The implementation narrows only ordinary-cleaning history presentation while preserving the existing eight-item active completion gate for ordinary direct entry, self-complete, and stayover; nonempty legacy media remains in a read-only extra-history section.
- The inspection candidate uses one compact column, two phone columns, top-aligned natural-height cards, and responsive square thumbnails.
- Permissions, media sources, upload/delete behavior, video, task actions, and persistence contracts remain outside the visual change.

### Executed component fixture

- With user authorization, dependencies were installed from `package-lock.json` using `npm ci --ignore-scripts --no-audit --no-fund`; no root lifecycle script exists, and the two dependency install scripts flagged by the lockfile were not executed.
- A temporary Expo Web fixture rendered the production `ResponsiveImageGrid` and the production cleaning-mode schema with React Native components and synthetic media only. It did not use static HTML, production APIs, credentials, or real task/media data. The temporary fixture and `App.tsx` switch were removed after capture and are not part of the candidate.
- Executed widths: 320, 360, 375, 390, and 430 px. Executed text scales: 1.0, 1.2, and 1.35. Every one of the 15 combinations had no horizontal overflow; 320 px rendered one inspection-card column and 360–430 px rendered two.
- The first rendered attempt exposed a real breakpoint bug: the nested grid's padded container width caused 360/375/390 px phones to remain one column. The production grid now uses viewport width only to choose the custom one/two-column policy while continuing to use measured container width for item sizing.
- The inspection fixture covered cards with 0, 1, 2, 3, and 8 photos. Measured card styles remained `alignSelf: flex-start`, and card heights remained content-dependent rather than equalized. Activity/read-only switching removed add controls in read-only mode.
- The cleaning fixture covered ordinary history, self-complete, stayover cleaning, and ordinary legacy history. Ordinary history rendered only its five applicable display groups; all active completion gates retained the original eight items; legacy bathroom/sofa/bedroom media appeared only in the read-only “其他历史照片” section.
- The viewer was opened, closed, reopened, and closed again in the browser; the same repeat cycle is also covered by focused Jest tests for both cleaning and inspection viewers.

### Captured evidence

- `/tmp/mz078-mz090-final-320-fs135.png` — corrected fixture, 320 px at 1.35 text scale: active ordinary/self-complete/stayover remain eight items, ordinary history is a five-group projection, and the inspection grid is one column without horizontal clipping.
- `/tmp/mz078-mz090-final-375-fs12.png` — corrected fixture, 375 px at 1.2 text scale: two columns and natural-height cards.
- `/tmp/mz078-mz090-final-430-fs1.png` — corrected fixture, 430 px at 1.0 text scale: two columns and the 0/1/2/3/8-photo matrix.
- `/tmp/mz078-final-history-390-fs12.png` — corrected 390 px read-only state: add controls are absent and the ordinary-history/legacy-extra contract is stated in the rendered fixture.
- `/tmp/mz078-mz090-ios-simulator.png` — the same no-login synthetic fixture rendered in the already-installed Expo Go 54.0.7 on the already-booted iPhone 17 / iOS 26.3 simulator. It visibly preserves the 8/5/8/8 split and two natural-height phone columns.
- Browser console: 0 errors; three React Native Web development warnings. Screenshots and CLI session logs remain temporary local evidence and are not selected for commit.
- Browser interaction: five add controls in activity mode and zero in read-only mode; the synthetic viewer completed open/close/reopen/close. Real-screen Jest separately covers the cleaning and inspection viewers' repeated close behavior.
- iOS interaction boundary: native rendering passed, but the Mac was locked and the native UI automation layer could not attach, so simulator tap/scroll/viewer interaction was not claimed. Camera/gallery, long-press deletion and physical-device behavior remain untested.
- Android boundary: the SDK contains `adb`, but no emulator binary and no AVD directory are installed, so no Android emulator run was possible without installing system-level tooling (explicitly excluded).

final result: pass for Expo Web synthetic-component QA and iOS simulator rendering; native simulator interaction, Android, and physical-device validation remain unrun

## 2026-09-14 — 工作量反馈列表优先与按日分组

- Source visual truth: `/Users/zhishi/.codex/generated_images/01a08935-889d-7353-a5b7-d510e6683deb/exec-52f90bf6-e5aa-47e9-927f-55f5d4c79545.png`
- Implementation screenshot: `/private/tmp/mz-personnel-claims-daily-list-20260914.png`
- Combined comparison: `/Users/zhishi/.codex/generated_images/01a08935-889d-7353-a5b7-d510e6683deb/exec-416d7fd9-8494-42a3-b16e-c179a92c8e27.png` (reference left, fixed Preview implementation right)
- Viewport/state: fixed Preview, iPhone 17 simulator portrait; “我 → 费用结算 → 工作量反馈” history state with four real Preview records.
- Dimensions/density: source 853×1844 px; implementation 1206×2622 px at simulator 3x density; both aspect-fitted at equal height in the combined comparison.

### Comparison history

1. Initial state (P2): the long creation form occupied the first screen and each history record used a separate card plus a full-width “查看详情” button, so users could not scan recent feedback efficiently.
2. Fix: made history the default content, moved creation to the 44pt header action, grouped records by `service_date`, and replaced per-record cards/actions with edge-to-edge tappable rows, separators and chevrons.
3. Post-fix evidence: the fixed Preview shows four dated records in one viewport while retaining type, status, note, duration/amount and evidence count; the reference hierarchy and information density are preserved.

### Fidelity surfaces

- Typography: centered 18pt navigation title, bold segmented tabs and date headers, 16pt row titles, smaller status/metadata hierarchy match the selected direction without clipping.
- Spacing/layout rhythm: summary, full-width gray date bands and white list rows now form one continuous scan path; row padding remains content-driven and substantially denser than the prior card/button layout.
- Colors/tokens: existing MZ primary blue, neutral page gray, pale date bands and orange pending status are reused; no new palette or shadow system was introduced.
- Icons/assets: existing navigation, tab and Ionicons assets are reused; the row chevron is decorative while the whole row owns the accessible action.
- Copy/content: the implementation uses live fixed Preview records, so `共 4 条反馈` and the real `$20.00` subsidy differ from the three-record `$35.00` sample; these are data differences, not layout drift.

### Findings

- No remaining actionable P0/P1/P2 fidelity issue in the inspected iPhone 17 list state.
- P3 follow-up: Android, landscape, enlarged system font and physical-device rendering were not inspected.

### Interaction verification

- Automated UI tests open the right-header action, exercise the existing date/time/rule/amount/photo/submit form, and confirm the form is absent from the default history view.
- Automated UI tests group same-day records without merging them, open detail from the whole row, and continue editing a `returned` record from detail.
- Fixed Preview accessibility state exposes each history row as one descriptive button; no business submission or production write was performed during visual inspection.

final result: passed

## 2026-09-13 — 紧凑型滚轮时间选择器

- Source visual truth: `/var/folders/ms/73s197d90g1gf12q9_9cdn980000gn/T/codex-clipboard-c85f0b73-abcc-485d-a884-9951cda55333.png`
- Implementation screenshot: `/private/tmp/mz-time-wheel-compact-20260913.png`
- Focused comparison: `/private/tmp/mz-time-wheel-compact-comparison-20260913.png` (large implementation left, compact implementation right)
- Viewport/state: fixed Preview, iPhone 17 simulator portrait; `仓管工作` selected and the start-time picker open at `09:05`.
- Dimensions/density: source crop 435×594 px; implementation capture 1206×2622 px at simulator 3x density; focused implementation crop normalized to 435×592 px; comparison 890×634 px.

### Comparison history

1. User finding (P2): the five-row, 52pt wheel and large heading hierarchy made the picker occupy too much of the screen and feel visually heavy.
2. Fix: reduced the wheel viewport to three 44pt rows, tightened the sheet gap from 12pt to 8pt, reduced title/current-time/row typography, inset the selection band, and softened the shadow while retaining 44pt action buttons.
3. Post-fix evidence: the sheet now begins substantially lower in the same iPhone 17 viewport, exposes more useful form context, and keeps the selected row, labels and actions clearly separated without clipping.

### Fidelity surfaces

- Fonts/typography: title is 18pt, current time 21pt, selected row 24pt and adjacent rows 17pt; hierarchy remains clear without the prior oversized feel.
- Spacing/layout rhythm: three 44pt rows replace five 52pt rows; 8pt internal gaps and 20pt side padding create a compact but breathable layout.
- Colors/tokens: existing MZ primary, neutral text and pale-blue selection colors remain unchanged; only shadow opacity is softened.
- Image quality/assets: no raster asset or icon is involved; all visible picker elements remain native text and views.
- Copy/content: all picker labels and the `09:05` state are unchanged.

### Findings

- No remaining actionable P0/P1/P2 issue in the compact iPhone 17 state.
- P3 follow-up: Android, landscape, enlarged system font and physical-device rendering were not inspected.

### Interaction verification

- Fixed Preview adjustment moved the compact minute wheel from `09:00` to `09:05`; the center row and header updated together.
- Automated test asserts the compact wheel height is 132pt, selects `10:05`, and confirms the existing write-back behavior.
- Cancel and confirm remain shared 44pt `AppButton` actions; API and submission handlers are unchanged.

final result: passed

## 2026-09-13 — iPhone 风格滚轮时间选择器

- Source visual truth: `/Users/zhishi/.codex/generated_images/01a08935-889d-7353-a5b7-d510e6683deb/exec-c6945b3f-502c-4207-9597-3b0765da47ba.png`
- Implementation screenshot: `/private/tmp/mz-time-wheel-picker-20260913.png`
- Combined comparison: `/private/tmp/mz-time-wheel-comparison-20260913.png` (source left, implementation right)
- Viewport/state: fixed Preview, iPhone 17 simulator portrait; `仓管工作` selected and the start-time bottom sheet open.
- Dimensions/density: source 1024×1536 px; implementation 1206×2622 px at simulator 3x density; comparison 1600×1580 px with both images aspect-fitted.

### Comparison history

1. Initial state (P2): the prior picker rendered 24 hour buttons and 12 minute buttons as a long grid, requiring substantially more visual scanning and vertical space than an iPhone wheel.
2. Fix: replaced the grid with two independent snapping wheels, five visible rows, a continuous pale-blue center band, centered colon, selected-time header, top handle and existing MZ cancel/confirm actions.
3. Post-fix evidence: the fixed Preview rendering preserves the selected reference hierarchy and spacing while sizing the sheet intrinsically for the real iPhone 17 viewport.

### Fidelity surfaces

- Fonts/typography: selected time and center values use bold tabular numerals; adjacent rows progressively reduce weight, size and opacity as in the reference.
- Spacing/layout rhythm: both wheels expose five evenly spaced 52pt rows; the labels, center band, buttons and safe-area bottom spacing remain separated and unclipped.
- Colors/tokens: the selected band uses pale MZ blue, the header value and confirm action use the existing primary blue, and cancel remains the shared neutral secondary action.
- Image/assets: no raster asset or new icon was introduced; the handle, text, band and buttons are native views.
- Copy/content: `选择开始时间`, `小时`, `分钟`, `取消` and `确认时间` match the approved preview; the same component also derives `选择结束时间` for the end-time field.

### Findings

- No remaining actionable P0/P1/P2 difference for the selected wheel-picker state.
- P3 follow-up: Android, enlarged system font, landscape and physical-device rendering were not inspected in this pass.

### Interaction verification

- Fixed Preview accessibility adjustment changed the minute wheel from `09:00` to `09:05`; the wheel snapped to the next 5-minute value and the header updated in the same rendered state.
- Automated interaction selects hour `10` and minute `05`, confirms `10:05`, and covers offset clamping plus minute normalization.
- Backdrop close, cancel and confirm reuse their existing handlers; no API, payload, fee calculation, media or submission logic changed.

final result: passed

## 2026-09-13 — 补充费用表单纵向间距

- Source visual truth: `/var/folders/ms/73s197d90g1gf12q9_9cdn980000gn/T/codex-clipboard-e38fc6e3-e367-453f-8ec5-e99e842106b4.png`
- Implementation screenshot: `/private/tmp/mz-settlement-supplement-spacing-20260913.png`
- Focused comparison: `/private/tmp/mz-settlement-supplement-spacing-comparison-20260913.png` (source left, implementation right)
- Viewport/state: fixed Preview, iPhone 17 simulator portrait; weekly settlement detail with `补充工作或费用` expanded and no selected evidence photo.
- Dimensions/density: source focused crop 401×545 px；implementation full capture 1206×2622 px at simulator 3x density；focused implementation crop 1166×1722 px normalized to 401×592 px；combined comparison 812×592 px.

### Comparison history

1. Initial reference finding (P2): adjacent labels, fields, photo actions and the final submit button had effectively no section spacing, so the entire form read as one compressed block.
2. Fix: added the shared 12pt outer form gap and kept related labels/controls inside 6pt field groups.
3. Post-fix evidence: the focused comparison shows distinct separation between fee type, date, amount, note, evidence and submission while preserving compact grouping inside each field.

### Fidelity surfaces

- Fonts/typography: unchanged; label weights, input text and button labels retain the existing MZ hierarchy and wrapping behavior.
- Spacing/layout rhythm: direct form groups now use 12pt; fee type and evidence labels remain visually tied to their controls with the existing 6pt field gap.
- Colors/tokens: unchanged; the selected fee type remains blue and secondary photo controls remain neutral outline.
- Image quality/assets: no image asset or icon changed; the inspected state has no selected evidence photo.
- Copy/content: all labels, helper text and button wording are unchanged.

### Full-view and focused evidence

- Full implementation capture confirms the expanded form remains within the existing scrollable settlement detail without horizontal overflow or clipped controls.
- The user source is a focused crop rather than a complete device frame; density-normalized focused comparison therefore provides the direct before/after evidence for the requested region.

### Findings

- No remaining actionable P0/P1/P2 difference for the requested expanded form state.
- P3 follow-up: Android, enlarged system font, filled photo-grid state and physical-device rendering were not inspected in this pass.

### Interaction verification

- Existing fee-type, date, amount, note, camera/library and submit controls remain present in the accessibility tree.
- Automated test confirms the outer 12pt layout token; no handler, payload, media or calculation code changed.

final result: passed

## 2026-09-13 — 核对按钮间距与红色提醒

- Source visual truth: `/var/folders/ms/73s197d90g1gf12q9_9cdn980000gn/T/codex-clipboard-09fa74a9-a73b-4a6a-8935-19b26dbcfb35.png`
- Implementation screenshot: `/private/tmp/mz-settlement-reconciliation-spacing-red-20260913.png`
- Focused comparison: `/private/tmp/mz-settlement-spacing-red-comparison-20260913.png` (source left, implementation right)
- Viewport/state: fixed Preview, iPhone 17 simulator portrait; weekly settlement detail, `现有结算需要核对` selected, empty issue note.
- Dimensions/density: source focused crop 389×317 px; implementation capture 1206×2622 px at simulator 3x density; focused implementation crop 1166×951 px normalized to 389×317 px; combined comparison 798×317 px.

### Comparison history

1. Initial reference finding (P2): the multiline issue field and submit button visually touched, weakening field/action separation; the selected calculation-review option used the same blue as the normal positive path.
2. Fix: added the shared 12pt button row gap above the submit action and changed only the selected calculation-review option to the shared red `danger` tone.
3. Post-fix evidence: the focused comparison shows a distinct white gap between field and action; the selected review option is red with white text, while `补充工作或费用` remains a neutral outline.

### Fidelity surfaces

- Fonts/typography: unchanged from the existing MZ screen; labels, placeholder and button weights remain consistent and readable.
- Spacing/layout rhythm: 12pt separation now matches `layoutTokens.button.rowGap`; equal-width 44pt choice buttons and card padding remain unchanged.
- Colors/tokens: selected review action uses shared `danger` `#DC2626`; normal confirmation remains blue and the unselected alternative remains neutral.
- Image/assets: no visible image asset or icon changed; this focused state contains only native text controls.
- Copy/content: all labels and the existing submission wording are unchanged.

### Findings

- No remaining actionable P0/P1/P2 difference for the requested focused state.
- P3 follow-up: Android, enlarged system font and physical-device rendering were not inspected in this pass.

### Interaction verification

- Selection still reveals the same issue-note field and submit handler.
- Automated test confirms the danger background/border and 12pt submit spacing; no API or payload code changed.

final result: passed

## 2026-09-13 — 周结算核对入口合并

- Reference: `/var/folders/ms/73s197d90g1gf12q9_9cdn980000gn/T/codex-clipboard-502b132a-1c45-490b-b771-fc56967b93be.png`
- Rendered implementation: `/private/tmp/mz-settlement-reconciliation-after.png` and `/private/tmp/mz-settlement-supplement-after-final.png`
- Viewport: fixed Preview, iPhone 17 simulator, portrait.

### Comparison

- The prior screen separated a red text-only dispute action from a second compensation form, so the same issue could be entered twice and the relationship between the two actions was unclear.
- The rendered screen keeps the existing MZ card, spacing, typography, blue primary action, safe-area close control, and single scrolling detail page.
- One question now presents two equal 44pt paths: `补充工作或费用` and `现有结算需要核对`. The structured form is disclosed only after choosing the first path, reducing initial density.
- The expanded form keeps the current amount, pending amount, projected total, date, amount, note, and photo evidence in one hierarchy. No content is clipped at the inspected viewport; remaining fields continue in the existing vertical scroll.
- Visible terminology describes Homixa and the service provider as cooperating parties: `反馈`, `核对`, `确认计入`, and `需要补充资料` replace approval/reporting language.

### Result

Passed for the implemented fixed Preview state. Automated interaction tests cover both paths; live simulator inspection confirms the updated labels, responsive card layout, safe-area close button, and progressive disclosure. Native camera/photo selection and a real write submission were not exercised in this visual check.
