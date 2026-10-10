# 400-game local baseline

Source SHA: `167cc746eacd1cad3542967e65950e2b0a943db4`
Policy SHA256: `79267edc99e7448af184b184edbb43512a2138725f7e55d35501a5416b71a730`

Completed 400 games; all 400 complete replays verified. Same requested seeds1–100 for each policy/profile, identical12starting gold. No core or repository changes.

|Profile|Policy|Clear|Failures|First2 median (achieved)|First3 median (achieved)|Buy / reroll / sell means|Bench ever full|Combat seconds mean / median|
|---|---|---|---|---|---|---|---|---|
|count40|normal|48/100|{'wave20:finalTimeout': 52}|3.0 (100/100)|10.0 (100/100)|47.53 / 2.74 / 0.01|0/100|272.982 / 271.675|
|count40|expert|2/100|{'wave20:finalTimeout': 98}|3.0 (100/100)|6 (3/100)|39.66 / 8.41 / 0.5|0/100|282.251 / 281.1|
|count80|normal|48/100|{'wave20:finalTimeout': 52}|3.0 (100/100)|10.0 (100/100)|47.53 / 2.74 / 0.01|0/100|272.982 / 271.675|
|count80|expert|2/100|{'wave20:finalTimeout': 98}|3.0 (100/100)|6 (3/100)|39.66 / 8.41 / 0.5|0/100|282.251 / 281.1|

Profile outcome/action comparisons differing: 0/200 matched policy-seed pairs.
Within-profile paired clear outcomes: {'playable-v2-gen2-fixture1-count40': {'normalLoss/expertLoss': 51, 'normalWin/expertLoss': 47, 'normalWin/expertWin': 1, 'normalLoss/expertWin': 1}, 'playable-v2-gen2-fixture1-count80': {'normalLoss/expertLoss': 51, 'normalWin/expertLoss': 47, 'normalWin/expertWin': 1, 'normalLoss/expertWin': 1}}

Policy assumptions, limitations and frozen decision rules: POLICY.md. Complete wave distributions, ranges and Wilson95 intervals are in summary.json; individual games are in results.json; replay documents are in replays/. Wilson intervals describe variation under the assumed seed sampling, not uncertainty about human players or policies. Seeds are consecutive/prespecified, not a random human sample.

Tick time excludes preparation and thinking time. Shared gameplay RNG means policy-specific rerolls produce different later shops despite equal initial seeds. Role weights and two-purchase planning are approximations and not calibrated human expertise. Earlier work had already exposed seeds1/3/7; current policy was frozen before this400 run, with functional smoke only on101/102. No after-results tuning. Neither policy is a random novice.

## Interpretation and next experiments

**The expert candidate failed its competence validation.** It cleared2% versus48% for normal and reached star3 in only3/100 games versus100/100. Its marginal inventory valuation plus reserve produced fewer purchases(39.66 vs47.53) and more rerolls(8.41 vs2.74). This supports rejecting this candidate as representative of a skilled player. It does not prove skilled play is worse. The requested human-skill interpretation remains blocked pending policy calibration; this is a completed400-game candidate baseline, not a validated ordinary-versus-expert comparison. No outcome-conditioned policy rewrite was performed.

**Strongest observed game-design concern:** every failure occurred at wave20 finalTimeout; all400 games reachedwave20 and no matched profile outcomes/actions differed. Both policies therefore encounter a final ordinary-enemy cleanup wall rather than the count40/80 pressure distinction. This limits what the proposed threshold comparison measures. It is conditional on these policies and fixtures.

Use the observed failure-wall and matched-profile results as hypotheses, not final balance approval. The two policies differ jointly in buying horizon, inventory valuation and reserve, so the comparison cannot causally isolate any one choice. In particular, if expert underperforms, its heuristic/reserve may be worse rather than expertise being unhelpful.

1. Freeze the game and perform a policy ablation on a new seed set: shared valuation, toggle two-purchase lookahead and reserve independently. Include a human-reviewed action trace before labelling either policy representative of ordinary/expert players.
2. Inspect the final-wave cleanup wall and pressure trajectory using those same validated policies. Compare one separately versioned deadline/ordinary-enemy-pressure hypothesis at a time only after an explicit tuning decision. Current run does not change any core parameter.

Additional design check from public fixture: three equal deployed units combine from3×base damage to2.2×base damage, a26.7% aggregate nominal DPS drop if coverage/cooldown/synergy are equal. Capacity relief/concentration can compensate, but this may make forced early upgrades temporarily harmful before the board fills. This is a rule arithmetic hypothesis, not a measured causal explanation of failures.

Three-star2x2 remains undecided, all parameters/roster/art remain fixtures, physical devices and human fun remain unverified. No remote push/comment/main merge/deployment occurred.
