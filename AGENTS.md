# MZStay Mobile Repository Agent Instructions

This repository is independent from the root MZ Property System repository. Do not assume that a root worktree, its `.codex` files, or its uncommitted changes exist here.

## Scope And Safety

- Before editing, state the target screen/module, affected roles, permitted files, protected behavior, validation plan, and excluded modules.
- Default to read-only discovery when the task, data environment, or allowed writes is unclear.
- Do not call production APIs, modify production data, perform external synchronization, install dependencies, change schemas, alter core auth/permissions, or run EAS builds unless the user explicitly authorizes the exact action.
- Keep one confirmed issue or feature per change unit. Do not perform unrelated refactors, visual polish, or cleanup.
- Never read, expose, log, stage, or commit `.env` files, credentials, tokens, cookies, private keys, database URLs, device logs, or local caches.

## Protected Mobile Workflows

- Preserve server-authoritative `available_actions`, roles, task transitions, payload contracts, submission semantics, navigation, and weak-network retry behavior unless the request explicitly changes them.
- For task, permission, sync, notification, media, or cache changes, inspect the backend payload/action contract plus normal entry, notification/deep-link entry, and re-entry with cached state before editing.
- Treat capture, upload, business save, retry, and local cleanup as separate states. Do not delete local media or re-upload an acknowledged remote medium before business save succeeds.
- A cross-repository task must cite the related root-repository FR/CRL in this repository's ledger and remain unreleaseable until the exact root/mobile pair completes the Phase 4 integration check.

## Quality Evidence

- Run `npm run check:ci` after mobile code or quality-gate changes. Run focused Jest tests when the changed screen/workflow has one.
- `npm run check:ci` proves TypeScript, lint, static button-contract checks, Jest, and this repository's ledger audit only. It does not prove real camera, gallery, network interruption, push notification, native build, simulator, or device behavior.
- Report iOS simulator, Android emulator, physical iOS, physical Android, EAS/native build, and real weak-network verification separately as passed, failed, or not run.
- Do not claim no regression, consistent behavior, or completed native validation without executed evidence.

## Change Ledger And Release

- Every repository mutation needs a granular entry in `docs/change-release-ledger.md` with exact files, behavior, validation, risks, dependencies, rollback, sensitive-data review, and Git state.
- Run `python3 scripts/audit_change_release_ledger.py` after updating the ledger. It verifies current working-tree path coverage; Phase 2 will add base/head PR coverage.
- Preserve concurrent changes. Never reset, clean, broad-stage, or use `git add .` / `git add -A`. Stage only reviewed files or hunks.
- Before commit, push, deployment, or EAS release, use an independent read-only review of the complete diff, ledger, tests, secret risk, and production-write risk. Do not push without explicit authorization.
