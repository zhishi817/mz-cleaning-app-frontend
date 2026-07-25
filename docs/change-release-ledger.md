# Change Release Ledger

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
- `package.json` — modified: 增加 `check:ci`。
- `.nvmrc` — added: 固定 Node 20.19.4。
- `.github/workflows/quality.yml` — added: locked install、typecheck、lint、Jest 质量门禁。
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
