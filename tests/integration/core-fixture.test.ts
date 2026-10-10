import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { CoreApi, MatchState } from "../../src/core/index.ts";

test("real core: independent preparation fixture, replay and Node/portable hash", async (context) => {
  if (!existsSync(new URL("../../src/core/index.ts", import.meta.url))) {
    context.skip("BLOCKED: core module not present on this branch"); return;
  }
  const core: CoreApi = await import("../../src/core/index.ts");
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/preparation-contract.json", import.meta.url), "utf8"));
  let created;
  try { created = core.createMatch(fixture.seed); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("CORE_NOT_IMPLEMENTED")) {
      context.skip("BLOCKED: API-only core checkpoint, no gameplay tested"); return;
    }
    throw error;
  }
  if (!created.ok) assert.fail(created.error.code);
  let state = created.state;
  const hash = (value: MatchState) => createHash("sha256").update(core.canonicalState(value), "utf8").digest("hex");
  for (const [key, value] of Object.entries(fixture.initialExpected)) {
    assert.deepEqual(state[key as keyof MatchState], value, `initial ${key}`);
  }
  for (const [index, step] of fixture.steps.entries()) {
    const before = structuredClone(state);
    const result = "command" in step ? core.dispatch(state, step.command) : core.advance(state, step.advance);
    assert.deepEqual(state, before, `input immutability step ${index}`);
    if (typeof step.expect === "string") {
      assert.equal(result.ok, false, `expected rejection step ${index}`);
      assert.strictEqual(result.state, state);
      assert.deepEqual(result.state, before);
    } else {
      assert.equal(result.ok, true, `expected acceptance step ${index}`);
      state = result.state;
      for (const [key, expected] of Object.entries(step.expect)) {
        if (key === "unitId") assert.ok(state.units.some((unit) => unit.id === expected));
        else if (key === "unit1Location" || key === "unit2Location") {
          assert.deepEqual(state.units.find((unit) => unit.id === (key === "unit1Location" ? 1 : 2))?.location, expected);
        } else assert.deepEqual(state[key as keyof MatchState], expected, `step ${index} ${key}`);
      }
    }
    assert.equal(core.stateHash(state), hash(state), `Node/portable step ${index}`);
  }
  const header = {schemaVersion:state.schemaVersion,rulesId:state.rulesId,rulesDigest:state.rulesDigest,seed:state.seed};
  const replay = core.replay(header, state.acceptedLog, hash(state));
  assert.equal(replay.ok, true);
  if (replay.ok) {
    assert.equal(core.canonicalState(replay.state), core.canonicalState(state));
    assert.deepEqual(replay.state.acceptedLog, state.acceptedLog);
  }
  const corrupt = core.replay({...header,rulesDigest:"0".repeat(64)}, state.acceptedLog);
  assert.deepEqual(corrupt, {ok:false,error:{code:"RULES_DIGEST_MISMATCH",entryIndex:null}});
  const mismatch = core.replay(header,state.acceptedLog,"0".repeat(64));
  assert.deepEqual(mismatch, {ok:false,error:{code:"FINAL_HASH_MISMATCH",entryIndex:null}});
});
