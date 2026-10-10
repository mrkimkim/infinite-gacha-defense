# CLI / evaluation checkpoint — Issue #25 schema3 compatibility update

Dependency: PR #29 API-only SHA `b753dbf6c37078fbe4eb17dd7ac96c25c3ddbad9`.
This branch is stacked on `momo/playable-v2-core`; its PR targets that branch so core sources are not duplicated in the integration diff. The approved dependency is incorporated unchanged as an exact parent; only four CLI-owned files are modified for this update. No core/web source is edited by the leader. Keep this draft stacked until the dependency lands; this is not a merge to main.

## Superseding user direction

The user removed the separate eight-unit cap in favor of available 4×4 space, requested automatic three-copy promotion/chains, character rarity separate from star level, and removal of level/XP/books. Three-star 2×2 occupancy and rarity odds/data are still under discussion. API29 generation1/proposal1 is historical input. The dependency above defines schema3 types/data only, reviewed against PR36 exact19c4dac76a7ed14c27fb87c3d5167c8478c2ec78; no runtime engine is exported. No manual merge, XP/book policy, eight-unit constant, altered profile, invented rarity schedule or gameplay bot ships in this checkpoint. Earlier proposal1 policy drafts were retained outside this repository for recovery, not published or counted as validation of the new direction.

## What runs

- Existing `run --input` remains schema1 by default; explicit `schemaVersion:1` is accepted. Schema3 requires an explicit rulesId. Schema2 is explicitly UNSUPPORTED_SCHEMA for both run and replay. Replay routing uses header.schemaVersion.
- Replay transport accepts the CLI's expectedFinalHash or native document finalHash, never both. Header fields/hash format/entries container are checked; entry semantics and digest validation belong to the selected core.
- Schema3 dynamically checks for actual engine exports, including previewRecruit. Exported replay headers preserve schema3 from the reviewed state rather than hardcoding the old schema2. API-only29 returns CORE_NOT_IMPLEMENTED, exit1, without a partial state. A future engine adapter must be reviewed against its new exact API before real new-rule evaluation.
- Rules-independent EnginePort and publicSnapshot isolate policy callbacks from match state. Inputs are detached/frozen plain JSON and private keys are rejected recursively before callback. This is an API boundary, not a sandbox against malicious policy closures.
- Evaluation plans pair seeds across explicit profile IDs, separate tuning/validation without overlap, and retain stress cohorts separately. No fixed profiles are implicitly chosen. The 500-validation-games-per-profile goal awaits the new reviewed profiles and actual engine.
- The generic runner consumes accepted engine progress only, re-observes after every action, stops on errors/stalls/step limits, and never calls incomplete execution a loss. Multi-action search must choose again from the next observation. Canonical/hash/replay export and validation are the real adapter's responsibility.
- Neutral census measures first2/3-star observation, composition changes/diversity, unchanged-composition streaks, bench saturation and idle gold at starts, plus peak observed pressure. These are proxies, not meaningful-choice or fun scores. Exact action/purchase/sale/role transitions and their definitions await the new API. Aggregation separates policy/profile/partition/cohort and boss-wall denominators count only waves actually reached.

## Policy preparation / remaining work

Ordinary and expert policies will receive only public observation/rules. Ordinary must understand roles, synergy, automatic promotion material and reserve budgets; expert explores a wider current-observation action set. Neither sees seed/RNG/nextID/log/future random offers. Any hypothetical sampling uses a separate RNG and published probabilities; identical evaluation seeds do not imply identical shop histories when rerolls differ.

Growth/role/synergy policy variants, rarity-aware buying, legal spatial placement, automatic promotion/packed-bench purchase boundaries, and economic recycling/duplicate-support stress await the real schema3 implementation and its exact-SHA review. Removed XP stress/books will not be carried forward. No fake engine success, policy win rate, 500-game run, new-rule browser replay comparison or new-rule gameplay is claimed here.

Tests exercise strict transport, actual schema1 CLI, honest schema3 unavailable error, public input isolation, deterministic matrix construction, neutral metric arithmetic and a rejection-only injected port. Unit data for metrics are synthetic test inputs, not game outcomes. PR #28's separately observed inert layout is not new-rule gameplay evidence.

## Validation scope of the schema3 update

Tests cover real v1 execution, schema3 routing and honest unavailable-engine errors,
schema2 run/replay rejection, strict replay envelope aliases, missing preview capability,
and header projection from static transport data. Header projection is not a mocked
engine success. The rules-independent evaluation harness remains unchanged.
No planner/automatic-upgrade/full-bench transaction, schema3 combat or successful
schema3 replay has run: the dependency contains types, data and static examples only.
After runtime publication, verify preview/commit parity, ID/cooldown/event chains,
atomic rollback, replay/hash parity and browser/Node agreement before any policy run.
