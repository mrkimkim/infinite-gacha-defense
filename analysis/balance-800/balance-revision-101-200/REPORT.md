# One policy repair and seed101–200 validation

Source `167cc746eacd1cad3542967e65950e2b0a943db4`; revised policy SHA256 `8a2dbf84cc635ad82b90b8b4d687631a44aae112ec66a86da02270a09437e0e3`.
400 completed games, 400 replay/hash roundtrips passed. Two profiles × two policies × same seeds101–200; identical starting resources. No core changes.

Neither policy is a validated representative of human skill. Old expert2% was treated as a model defect, not evidence of excessive game difficulty. See REVISION.md and traces.json for the three real missed positive-DPS purchases and exact single revision. No weight search or post-validation retuning.

|Profile|Policy|Clear|Failure distribution|First2 median / reached|First3 median / reached|Buy / reroll / sale means|Combat seconds mean|
|---|---|---|---|---|---|---|---|
|count40|normal|49/100|{'wave20:finalTimeout': 51}|3.0 / 100|10.0 / 100|47.35 / 2.53 / 0.01|271.001|
|count40|expert|60/100|{'wave20:finalTimeout': 40}|3.0 / 100|11.0 / 100|47.07 / 2.38 / 0.02|269.632|
|count80|normal|49/100|{'wave20:finalTimeout': 51}|3.0 / 100|10.0 / 100|47.35 / 2.53 / 0.01|271.001|
|count80|expert|60/100|{'wave20:finalTimeout': 40}|3.0 / 100|11.0 / 100|47.07 / 2.38 / 0.02|269.632|

|Profile|Policy|Final star3 mean / median / p10–p90|Nominal DPS mean / median / p10–p90|Wave20 realized damage/sec mean|Full bench games|
|---|---|---|---|---|---|
|count40|normal|2.58 / 3.0 / 2–3|222.767 / 224.611 / 199.587–242.754|236.331|0/100|
|count40|expert|2.46 / 2.0 / 2–3|232.903 / 233.667 / 209.0–252.524|241.006|0/100|
|count80|normal|2.58 / 3.0 / 2–3|222.767 / 224.611 / 199.587–242.754|236.331|0/100|
|count80|expert|2.46 / 2.0 / 2–3|232.903 / 233.667 / 209.0–252.524|241.006|0/100|

|Profile|Policy|Common|Uncommon|Rare|Epic|Legendary|
|---|---|---|---|---|---|---|
|count40|normal|28.09|12.49|5.05|1.54|0.18|
|count40|expert|27.46|13.09|4.37|1.7|0.45|
|count80|normal|28.09|12.49|5.05|1.54|0.18|
|count80|expert|27.46|13.09|4.37|1.7|0.45|

Rarity values are mean paid arrivals per game, including arrivals immediately consumed into upgrades. Full distributions/ranges are in summary.json. Final star3 counts include bench; separate deployed count is also recorded. Nominal DPS is one-hit damage/attack period using final observed synergy/support; it does not model range/downtime, overkill or splash victim multiplicity. Realized final-wave damage/sec uses actual engine hit events and actual final-wave duration.

Paired results: {'playable-v2-gen2-fixture1-count40': {'normalLoss/expertWin': 23, 'normalLoss/expertLoss': 28, 'normalWin/expertLoss': 12, 'normalWin/expertWin': 37}, 'playable-v2-gen2-fixture1-count80': {'normalLoss/expertWin': 23, 'normalLoss/expertLoss': 28, 'normalWin/expertLoss': 12, 'normalWin/expertWin': 37}}
Profiles with different paired outcomes/actions: 0/200.

Same initial seeds do not ensure identical shops: purchases/rerolls change shared gameplay RNG consumption. These new seeds differ from the old400 comparison, so old2% vs new percentage alone is not a paired causal improvement estimate.101/102 appeared in earlier functional smoke; neither current policy was tuned on this evaluation. Combat time excludes preparation/thinking.

Remaining decisions: validate policy choices with actual knowledgeable humans; investigate residual final-wave failures using observed remaining HP and damage throughput before tuning difficulty. No proof of human fun, final economy/rarity balance, three-star2x2 or physical mobile performance. No remote publication, push, merge or deployment.

## Observed interpretation
Normal49/100 versus revised60/100 in each profile. Matched discordant cases: revised-only wins23, normal-only wins12. Both profiles reproduce the same policy/seed outcomes, so they do not supply independent replication of the11-point difference. The old2% is a different seed cohort and cannot be used alone as a causal effect estimate.

All residual losses are wave20 finalTimeout with zero surviving bosses. Failed runs retain mean456.4HP(normal) or280.7HP(revised) of ordinary enemies. Final nominal DPS overlaps: normal winners235.0mean versus losers211.0; revised winners241.5 versus losers220.0. Nominal DPS is associated with success but not sufficient: range, role, placement, carryover enemies and attack timing remain relevant. Revised has fewer final star3 on average(2.46 vs2.58), yet higher nominal and realized final-wave damage throughput. More stars alone is not the explanatory variable. Rarity acquisition differs along with actions/RNG; this is not a causal rarity-strength test.

Next bounded investigation, if separately requested: inspect matched discordant final-wave traces with near-equal nominal DPS to compare coverage/downtime/targeting and carryover HP. Validate action choices with actual ordinary and skilled human players before assigning representative-human labels. This task stops after one revision and one new400-game evaluation; no further tuning performed.
