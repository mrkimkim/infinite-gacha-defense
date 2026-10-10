# CLI / evaluation checkpoint — Issue #25 generation 1

Dependency: PR #29 API-only SHA `361ed54339daab180cd8dfc1cc2526fee479eded`.
This branch is stacked on `momo/playable-v2-core`; its PR targets that branch so core sources are not duplicated in the integration diff. Current main `5d69aacad292156de563f8c737e169a38687cb4c` adds the reviewed design document to the API branch's earlier base; no core/web files are edited here. Retarget to main only after the dependency lands or after a reviewed dependency update.

## Superseding user direction

The user removed the separate eight-unit cap in favor of available 4×4 space, requested automatic three-copy promotion/chains, character rarity separate from star level, and removal of level/XP/books. Three-star 2×2 occupancy and rarity odds/data are still under discussion. API29/proposal1 is historical input, not the final new-rule API. No manual merge, XP/book policy, eight-unit constant, altered profile, invented rarity schedule or gameplay bot ships in this checkpoint. Earlier proposal1 policy drafts were retained outside this repository for recovery, not published or counted as validation of the new direction.

## What runs

- Existing `run --input` remains schema1 by default; explicit `schemaVersion:1` is accepted. Schema2 requires an explicit rulesId. Replay routing uses header.schemaVersion.
- Replay transport accepts the CLI's expectedFinalHash or native document finalHash, never both. Header fields/hash format/entries container are checked; entry semantics and digest validation belong to the selected core.
- Schema2 dynamically checks for actual engine exports. API-only29 returns CORE_NOT_IMPLEMENTED, exit1, without a partial state. A future engine adapter must be reviewed against its new exact API before real new-rule evaluation.
- Rules-independent EnginePort and publicSnapshot isolate policy callbacks from match state. Inputs are detached/frozen plain JSON and private keys are rejected recursively before callback. This is an API boundary, not a sandbox against malicious policy closures.
- Evaluation plans pair seeds across explicit profile IDs, separate tuning/validation without overlap, and retain stress cohorts separately. No fixed profiles are implicitly chosen. The 500-validation-games-per-profile goal awaits the new reviewed profiles and actual engine.
- The generic runner consumes accepted engine progress only, re-observes after every action, stops on errors/stalls/step limits, and never calls incomplete execution a loss. Multi-action search must choose again from the next observation. Canonical/hash/replay export and validation are the real adapter's responsibility.
- Neutral census measures first2/3-star observation, composition changes/diversity, unchanged-composition streaks, bench saturation and idle gold at starts, plus peak observed pressure. These are proxies, not meaningful-choice or fun scores. Exact action/purchase/sale/role transitions and their definitions await the new API. Aggregation separates policy/profile/partition/cohort and boss-wall denominators count only waves actually reached.

## Policy preparation / remaining work

Ordinary and expert policies will receive only public observation/rules. Ordinary must understand roles, synergy, automatic promotion material and reserve budgets; expert explores a wider current-observation action set. Neither sees seed/RNG/nextID/log/future random offers. Any hypothetical sampling uses a separate RNG and published probabilities; identical evaluation seeds do not imply identical shop histories when rerolls differ.

Growth/role/synergy policy variants, rarity-aware buying, legal spatial placement, automatic promotion/packed-bench purchase boundaries, and economic recycling/duplicate-support stress await the new contract. Removed XP stress/books will not be carried forward. No fake engine success, policy win rate, 500-game run, new-rule browser replay comparison or new-rule gameplay is claimed here.

Tests exercise strict transport, actual schema1 CLI, honest schema2 unavailable error, public input isolation, deterministic matrix construction, neutral metric arithmetic and a rejection-only injected port. Unit data for metrics are synthetic test inputs, not game outcomes. PR #28's separately observed inert layout is not new-rule gameplay evidence.
