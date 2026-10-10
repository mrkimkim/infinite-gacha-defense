/** Regenerate six fixed public-policy games; verify every final hash against published results. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as core from '../../src/core-v2/index.ts';
import { publicSnapshot } from '../../src/cli/evaluation.ts';
import { decide as baseline } from './balance-baseline-400/policies.mjs';
import { decide as revised } from './balance-revision-101-200/revised-policy.mjs';
const profile = 'playable-v2-gen2-fixture1-count40';
const cases = [
  ['balance-baseline-400', 'normal', 1],
  ['balance-baseline-400', 'expert', 1],
  ['balance-baseline-400', 'expert', 2],
  ['balance-baseline-400', 'expert', 3],
  ['balance-revision-101-200', 'normal', 101],
  ['balance-revision-101-200', 'expert', 101],
];
for (const [cohort, policy, seed] of cases) {
  const root = new URL(`./${cohort}/`, import.meta.url);
  const published = JSON.parse(gunzipSync(fs.readFileSync(new URL('results.json.gz', root))));
  const expected = published.find(row => row.profile === profile && row.policy === policy && row.seed === seed);
  assert(expected, 'Missing published comparison row');
  const decide = cohort === 'balance-baseline-400' ? baseline : revised;
  const rules = publicSnapshot(core.getRules(profile));
  let state = core.createMatch(seed, profile).state;
  let actions = 0;
  while (state.phase !== 'result') {
    assert(++actions < 3000, 'POLICY_ACTION_LIMIT: not a game loss');
    const result = state.phase === 'combat' ? core.advance(state, 1000)
      : core.dispatch(state, decide(publicSnapshot(core.observe(state)), rules, policy));
    assert(result.ok, JSON.stringify(result.error));
    state = result.state;
  }
  const finalHash = core.stateHash(state);
  assert.equal(finalHash, expected.hash, `${cohort}/${policy}/${seed}`);
  assert.equal(state.tick, expected.tick);
  assert.equal(state.outcome, expected.outcome);
  const record = { header: { schemaVersion: 3, rulesId: profile, rulesDigest: state.rulesDigest, seed },
    entries: state.acceptedLog, finalHash };
  assert(core.replay(record.header, record.entries, finalHash).ok);
  fs.mkdirSync(new URL('replays/', root), { recursive: true });
  const file = new URL(`replays/${policy}-${profile}-${seed}.json`, root);
  // Never silently replace an existing differing replay.
  const bytes = JSON.stringify(record);
  if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, 'utf8'), bytes, 'Existing replay differs');
  else fs.writeFileSync(file, bytes);
  console.log(`${cohort}/${policy}/${seed}: published hash + replay PASS ${finalHash}`);
}
