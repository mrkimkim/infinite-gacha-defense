# CLI / evaluation checkpoint — Issue #25 schema3 runtime connection

Pinned runtime dependency: PR #29 `e2d11aad22ff2e63c4d05c431ac4f5a753bc03a0`, following approved API/data `b753dbf6c37078fbe4eb17dd7ac96c25c3ddbad9`.
This draft remains stacked on `momo/playable-v2-core`. The exact runtime commit is incorporated as an additional parent without leader edits to its 17 changed dependency files. This update changes only `tests/integration/v2-cli.test.ts` and this document. It does not merge to main or deploy.

## Runtime transport

- `run --input` defaults to schema1. Schema3 requires explicit `schemaVersion:3` and `rulesId`; schema2 run/replay is explicitly unsupported.
- Replay accepts either native `finalHash` or CLI `expectedFinalHash`, never both. Header fields and transport shape are checked by CLI; entry semantics and rule digest validation remain core-owned.
- Actual schema3 exports, including `previewRecruit`, are required. API-only and partially implemented modules remain rejected by isolated capability fixtures. The pinned module now executes real commands and replay; it is no longer expected to report CORE_NOT_IMPLEMENTED.
- CLI computes Node SHA-256 over canonical bytes and checks the core hash. Replay headers come from authoritative state, preserving schema/rules ID/digest/seed.

The subprocess regression uses both fixed profiles and real seed1 commands: recruit, move to(3,3), recruit, reroll, recruit with automatic star2 promotion, startWave, advance17. It verifies the committed result ID4/star2/location, gold5, combat tick17, seven accepted entries, exact header and independently computed SHA. Both replay hash aliases must reproduce the entire CLI output. Real schema1 execution, schema2 rejection, wrong schema3 rules digest and missing runtime capabilities remain covered. No mock engine success is used.

## Evaluation boundaries

EnginePort remains rule-independent. Policies receive detached/frozen plain public JSON, rejecting hidden/private keys, accessors, sparse or decorated arrays and nonstandard prototypes. This is an input boundary, not a sandbox against malicious closures. Each accepted action is followed by fresh observation; terminal completion at the action budget is accepted, while incomplete runs, errors and stalls are never classified as losses.

Plans pair explicit profile/seed sets and keep tuning, validation and stress cohorts separate. Census metrics cover first star2/star3, composition changes/diversity, unchanged-composition streaks, bench saturation, idle gold and observed pressure. These are proxies, not fun scores. Removed XP/books/manual merge and a separate eight-unit board cap are not restored. Three-star2x2 and final economy/rarity data are outside this checkpoint.

## Validation and remaining scope

The combined source passes232 tests with0 failures/0 skips, full TypeScript checks, v1 and schema3 ES2022 portability, tooling and existing-web production builds. Earlier API-only137-pass and integrated229-pass/2-obsolete-expectation-failure results are historical checkpoints, superseded by this runtime-aware suite.

Independent local integration review of the same pinned core and prior CLI8ed90a4 also exercised12 public-observation policy runs (two profiles × two preliminary policy hypotheses × seeds1/3/7), actual CLI run/replay, purchase preview/commit parity and rejected-command rollback. Both wins and wave20 finalTimeout losses occurred. A separate synthetic stabilized full-bench boundary exercised a two-step chain with placement/max-cooldown inheritance; it was not presented as a naturally reached inventory. Normal seed3 count40 at1000/17/1-tick batching had identical canonical hash and entire combat-event trace. These external review scripts are evidence, not shipped or calibrated player policies.

Short advances remain a core-owned performance concern: the local5366-tick run took approximately0.36s/0.56s/7.16s for1000/17/1-tick batches, and cost grew with accepted-log length. No core optimization is included here. Browser–Node integration, live v2 controller/layout, human play, calibrated ordinary/expert policies,500-game evaluation and final balance remain outstanding. PR28's inert layout does not establish live v2 gameplay. Current-head independent review is required before merge.
