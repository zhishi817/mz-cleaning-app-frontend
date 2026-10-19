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
- Run `python3 scripts/audit_change_release_ledger.py` after updating the ledger. It verifies current working-tree path coverage; a release attempt additionally requires the exact base/head range evidence defined below.
- The audit also compares the local ledger with fetched `origin/Dev`: every remote CRL must remain present, and a shared ID must retain its title, Request, Outcome, Implementation, Files / Areas, and Impact / Dependencies. A mismatch is `BLOCKED`; assign a new CRL and keep only a dated reconciliation receipt on the historical unit.
- Preserve concurrent changes. Never reset, clean, broad-stage, or use `git add .` / `git add -A`. Stage only reviewed files or hunks.
- Before commit, push, deployment, or EAS release, use an independent read-only review of the complete diff, ledger, tests, secret risk, and production-write risk. Do not push without explicit authorization.

### Release Decision Contract

### Legacy Freeze And Layered Ledger Gates

- `LEGACY_FROZEN_WORKSPACE` is a snapshot boundary, not a date rule: it covers every staged, unstaged, and untracked delta that existed in the original Root or Mobile worktree at the recorded freeze snapshot. Do not infer an unresolved hunk's creation date, restore it, or assign it retroactively to a CRL.
- Preserve a frozen workspace as source evidence only. It is never a candidate or release source. A later request to ship one historical business change requires a new CRL and a fresh, hunk-scoped extraction into a clean `origin/Dev` worktree.
- A canonical CRL identity is repository-qualified: `root/CRL-YYYYMMDD-NNN` or `mobile/CRL-YYYYMMDD-NNN`. IDs may repeat across repositories, but a report, scope, dependency, or Release Attempt must never use a bare ID when the repository boundary matters.
- Before a content commit, run the local gate in the candidate repository: `python3 scripts/audit_change_release_ledger.py --pre-commit --repo <root|mobile> --crl <CRL-ID>`. It blocks untracked files, paths outside the selected CRLs, missing/mismatched repository identities, and staged hunks not listed in each selected CRL's `### Staged Commit Scope`.
- The PR gate is an exact committed-range check, not a historical-worktree check: `--release-report --repo <root|mobile> --base <base> --head <head> --crl <CRL-ID>`. It must verify canonical identity, selected paths/hunks, candidate content receipt, exact Git ancestry/state, and sensitive/generated-file evidence. It must not claim visibility into a separate Legacy frozen workspace.

- This mobile repository is independent. A root CRL, root branch, root review, or root test is never mobile release evidence unless this ledger records the exact related root CRL/SHA as a dependency.
- A CRL describes an implementation change. A **Release Attempt** records one exact release attempt and must bind repository, selected CRLs, target action, base ref/SHA and fetch time, candidate patch SHA-256, candidate content commit SHA when one exists, branch, dependencies, review/validation evidence, authorization, and remote evidence. The report command, not a self-referential ledger line, records the exact audit `head` SHA.
- Keep these facts separate:
  - technical state: `candidate`, `verified`, `committed`, `pushed`, `merged`, or `deployed`;
  - user authorization: `not-selected`, `selected-for-commit`, or `approved-for-push`;
  - conclusion for a stated action: `GO`, `BLOCKED`, or `NOT VERIFIED`.
- `NOT VERIFIED` means evidence is absent. `BLOCKED` means a concrete gate failed, including stale/invalid base, scope collision, range mismatch, failed test, uncovered path, generated-file issue, or sensitive-information risk. Do not call either situation “基本可以推”.
- `commit-ready` requires `verified`, `selected-for-commit`, and `GO` for commit. `push-ready` requires `committed`, a passing exact `base...head` range audit, `approved-for-push`, and `GO` for push. A selection never authorizes push. Changes to CRLs, base SHA, commit SHA, or branch invalidate prior push approval.
- Candidate patch SHA-256 is calculated from selected `base...head` content excluding `docs/change-release-ledger.md`; the exact range audit still includes the ledger. A recorded candidate content commit must be inside the reported range. This avoids impossible self-reference when a commit records its own hash.
- When asked “哪些更新可以推送”, report only: `可供选择的候选`、`已选择但仍被阻塞`、`已获授权且可提交`、`已提交、已批准且可推送`、`已推送`、`不在本次范围`. An uninspected worktree or `codex/*` branch is `NOT VERIFIED`, not absent.
- After user scope selection, fetch and record `origin/Dev@SHA`, then prepare the attempt in a clean mobile release worktree based on that SHA. Do not pull, rebase, stash, reset, clean, or derive a release from the mixed development worktree. Only selected CRL files or verified hunks may enter the release worktree; it must be clean after its commit.
- Use `docs/codex-release-review.md` for a pre-commit independent review of the staged candidate fingerprint. The reviewer `GO` authorizes only the stated commit action; after commit, the range fingerprint must match before a separate explicit user push approval can be used.
- After a candidate content commit exists, run the read-only exact attempt report with `python3 scripts/audit_change_release_ledger.py --release-report --repo mobile --base <origin-dev-sha> --head <audit-head-sha> --crl <CRL-ID> --format markdown`. It never fetches or changes Git/ledger state; `0` is `GO`, `1` is `BLOCKED`, and `2` is `NOT VERIFIED`. Use `--format json` only for the same evidence in machine-readable form.
