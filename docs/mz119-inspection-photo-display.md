# MZ-119 manager inspection-photo display

## Scope and phase

Phase 3 single-incident local repair, authorized by the owner's November 16 request to create a board number and repair the PR3001 issue. Target: ManagerDailyTaskScreen inspection-photo section, existing admin/customer-service/offline-manager readers. Permitted changes: domain-only grouping, labels, tests and documentation. No production access/write, object recovery, upload/save/auth changes, new viewer, release or dependency installation.

## Media Incident Diagnosis

- Classification: TASK_OPERATIONAL, existing inspection media, server-owned task association and read authority.
- Business owner and persisted association: historical read-only investigation reported PR3001 November 15 task with eight inspection records including bathroom and balcony. Not re-queried in this repair; no production-data claim from fixtures.
- Storage object: NOT CHECKED. An existing reference does not prove the bytes still exist.
- Authenticated read context / authorization: PASS at source-contract level only. Existing CleaningMediaImage / CleaningMediaPreview and historical accessSourceIds/mediaScope are unchanged. Live role/account access NOT CHECKED.
- API: PASS at source-contract level. Root mzapp inspection-photos route selects inspection_* records, derives area, preserves bathroom/balcony and applies existing unclean authorization. Mobile getInspectionPhotos returns string area without filtering. History maps exact actor-bound records to inspectionItems.
- Domain state: PASS at source-contract level, keeps returned area/url/note.
- Renderer grouping: FAIL on baseline cfc22004. Fixed four-area list dropped bathroom, balcony and historical returned inspection categories before thumbnails received them. Three role render regressions failed before the repair.
- First broken boundary: domain-specific manager inspection section grouping, code omission, high confidence for source behavior. No assertion about live storage or device behavior.
- Affected source: inspection photos in live/cached task detail and historical manager records. Other business media sources are excluded.
- Shared dependencies touched: none. Existing proxy, renderer, viewer, queue, payload and permissions unchanged.
- Legacy compatibility: preserve returned non-unclean categories (including toilet/shower_drain), keep original raw reference and note. Unknown nonempty areas use their returned label instead of disappearing. Existing unclean section and role restriction remain separate.
- Production/data/object repair: not indicated by the diagnosed source defect; actual object existence not checked.

## Surface and regression reference

Inspection API / exact historical records -> inspectionItems -> managerInspectionPhotoGroups -> existing authenticated CleaningMediaImage -> existing CleaningMediaPreview. Six current room sections keep stable order; other returned categories append. No private URL reconstruction or fallback. No writes, upload retries or cleanup are introduced. This narrow reference supplements the source-map's manager display entry; it does not change shared media contracts.

- ManagerDailyTaskScreen.test.ts: six empty sections, multiple bathroom photos, legacy and unknown categories, no duplicate unclean section, deterministic repeated grouping.
- ManagerDailyTaskScreen.render.test.tsx: eight-photo-shaped synthetic sample plus legacy/unknown/unclean records under three existing manager roles, each rendered once; bathroom/balcony open-close-reopen; historical thumbnail and preview retain identical source authority and exclude replacement actor media.
- Existing screen, navigation/history and media helper tests remain required. Native iOS/Android, real object/proxy and production record verification are separate, not inferred from Jest.

## Delivery boundary

No backend change or migration required. Source-only repair is not available to users until authorized commit/review/push/merge and compatible OTA/build delivery. Real-device verification is not run.
