# MZ-115 deep-cleaning mobile contract

Phase 3, authorized local implementation only. Deep-cleaning `PROPERTY_FEEDBACK` evidence belongs to the exact `property_deep_cleaning` source. Source original `photo_urls` projects to work-task `photo_urls`; source `repair_photo_urls` projects to `completion_photo_urls`. The server owns both association and capabilities.

## Diagnosis

- Source tracing: task details omitted the original-photo panel for this source and routed completion through generic task marking with a hardcoded `done` local patch. First broken boundaries: domain adapter and completion transition. Evidence: source inspection and synthetic component tests, not deployed service inspection.
- Business row, object existence, live authorized proxy response and device rendering: not checked. No production data/object repair is implied.
- Legacy photo references remain unchanged. Before and after lists never infer each other from summary text.

## Media lifecycle

Use existing `maintenanceCompletionPhotoDraft` storage with exact work-task ID and owner; its name is historical, its storage key includes both identifiers and has no maintenance API or permission binding. No second upload queue, proxy or renderer is introduced. Durable local JPEG precedes upload. Remote reference is retained on failed business submission, retry does not reupload it, and cleanup requires canonical association. Partial-upload drafts cannot be cleared merely because the already-uploaded subset appears in a task snapshot.

Before and after thumbnails/viewer reuse `CleaningMediaImage` / `CleaningMediaPreview` and the exact `media_access_work_task_id` context. Unassociated after photos use their local image only. A missing local image gets an explicit state, not a request for an unassociated private object. Existing viewer close/back behavior is retained, not claimed to be newly standardized.

## Workflow and verification boundary

Only server `deep_cleaning_workflow.available_actions` enables `complete`. The dedicated request contains photos, optional note and an operation ID, never price or required times. The receipt must say `pending_review`; no optimistic `done`. Pending, terminal, missing-action and readonly records cannot mutate. Local visibility is reconciled when domain workflow fields change; notification/direct detail and cached entry refresh the source projection.

Existing feedback/report creation and project editing remain in scope for compatibility, not permission expansion. Optional time inputs/history remain. The user additionally approved selecting the actual cleaner for a completed report: self defaults only if eligible; any selected person is persisted by ID. New completed feedback uses atomic `record_complete`, carrying the original source task and client item; an existing partial source ID is reused. Inspection drafts/queue retain the person, UUID and operation ID, excluding these reports from prior generic creation. Backend alone authorizes manager submission, source access, final eligibility and pending review.

Old non-draft inspection batches without a selected person cannot infer one and stop with retained evidence. The approved per-item recovery requires explicit person confirmation and same-owner proof: new local owner identity, or exact server owner/source proof for old mapped records. It preserves all original media/checkpoints and reconciles acknowledged-lost completions only against canonical photos. Ownerless/unmapped batches stay blocked for manual verification. No real storage migration was performed. The legacy project modal currently has no `openProjectAction` caller in source search; its deep-complete branch explicitly blocks and points to whole-record task completion, rather than converting one project into completion of the whole record. Two-project source-guard tests do not claim a reachable UI interaction.

Automated evidence is recorded in mobile/CRL-20261112-001 and the feature registry. Full actual-service/root-mobile pair verification, simulator, device, authenticated media/object-store and production tests remain separate gates. No release actions are authorized.

## Deep photo-view follow-up

Before capture is optional and joins the existing complete transaction as before_photo_urls; after evidence remains required. Before storage adds a task/source/owner/phase key, while the existing after storage key remains compatible. Deep before and after view state each bind photos to their loaded identity. New identity hydration must succeed before submission; old asynchronous loads/capture results cannot populate the new scope. Late upload acknowledgments retain references only in the original bucket. Cleanup re-reads that bucket and requires every persisted reference to be canonical. Maintenance keeps its legacy state/loader path.

Local-only deep before/after full previews use the actual localUri with an empty remote reference; the dialog is scoped to the same task/source/owner and closes on an identity change. Missing unuploaded local files are distinguished from retained uploaded references. Synthetic tests verify actual TaskDetail click routing, late-load/capture/save isolation, readonly pending R2 context for admin/staff, and shared authenticated-reader behavior. They do not prove production object existence, historical association completeness, actual authorization for every reassigned executor, or native camera/network behavior.
