import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { execute, failure, validateInput } from "../../src/cli/adapter.ts";
import type { CoreApi } from "../../src/core/index.ts";

test("CLI reports usage, invalid JSON, IO and envelope errors without a partial state", () => {
  for (const [args, input, code] of [
    [[], "", "USAGE"],
    [["run", "--input", "-"], "{", "INVALID_JSON"],
    [["run", "--input", "-"], '{"seed":1,"steps":[],"extra":0}', "BAD_INPUT"],
    [["replay", "--input", "-"], '{"header":{},"entries":[],"expectedFinalHash":"bad"}', "BAD_INPUT"],
    [["run", "--input", "tests/integration/does-not-exist.json"], "", "INPUT_IO"],
  ] as const) {
    const result = spawnSync(process.execPath, ["src/cli/main.ts", ...args], { input, encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { ok: false, error: { code, entryIndex: null } });
  }
});

test("adapter validates transport only and delegates game command validation", () => {
  assert.doesNotThrow(() => validateInput("run", {seed: 0, steps: [{command: {type:"unknown"}}]}));
  assert.throws(() => validateInput("run", {seed:1,steps:[{command:{},advance:1}]}));
  // Rejecting fake proves error plumbing only; it does not fabricate a game state.
  const core = new Proxy({} as CoreApi, { get: (_target, key) => {
    if (key === "createMatch") return () => ({ok:false,error:{code:"BAD_SEED"}});
    throw new Error(`Unexpected core call ${String(key)}`);
  }});
  let caught: unknown;
  try { execute(core, "run", {seed:0,steps:[]}); } catch (error) { caught = error; }
  assert.deepEqual(failure(caught), {exitCode:3,output:{ok:false,error:{code:"BAD_SEED",entryIndex:null}}});
  assert.deepEqual(failure(new Error("CORE_NOT_IMPLEMENTED: API-only checkpoint")),
    {exitCode:1,output:{ok:false,error:{code:"CORE_NOT_IMPLEMENTED",entryIndex:null}}});
});
