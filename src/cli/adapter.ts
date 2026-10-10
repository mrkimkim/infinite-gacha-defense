import { createHash } from "node:crypto";
import type { CoreApi, MatchState } from "../core/index.ts";

export type Mode = "run" | "replay";
export class CliError extends Error {
  code: string;
  exitCode: number;
  entryIndex: number | null;
  constructor(code: string, exitCode: number, entryIndex: number | null = null) {
    super(code);
    this.code = code;
    this.exitCode = exitCode;
    this.entryIndex = entryIndex;
  }
}
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new CliError("BAD_INPUT", 2);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (required.some((key) => !Object.hasOwn(value, key)) ||
      Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new CliError("BAD_INPUT", 2);
  }
}

export function validateInput(mode: Mode, input: unknown): Record<string, unknown> {
  const data = object(input);
  if (mode === "run") {
    keys(data, ["seed", "steps"], ["rulesId"]);
    if ((data.rulesId !== undefined && typeof data.rulesId !== "string") || !Array.isArray(data.steps)) {
      throw new CliError("BAD_INPUT", 2);
    }
    for (const item of data.steps) {
      const step = object(item);
      if (Object.hasOwn(step, "command")) keys(step, ["command"]);
      else keys(step, ["advance"]);
    }
  } else {
    keys(data, ["header", "entries"], ["expectedFinalHash"]);
    if (data.expectedFinalHash !== undefined &&
        (typeof data.expectedFinalHash !== "string" || !/^[a-f0-9]{64}$/.test(data.expectedFinalHash))) {
      throw new CliError("BAD_INPUT", 2);
    }
  }
  return data;
}

export function execute(core: CoreApi, mode: Mode, input: unknown) {
  const data = validateInput(mode, input);
  let state: MatchState;
  if (mode === "run") {
    const created = core.createMatch(data.seed, data.rulesId as string | undefined);
    if (!created.ok) throw new CliError(created.error.code, 3);
    state = created.state;
    const steps = data.steps as Record<string, unknown>[];
    for (const [index, step] of steps.entries()) {
      const result = Object.hasOwn(step, "command")
        ? core.dispatch(state, step.command) : core.advance(state, step.advance);
      if (!result.ok) throw new CliError(result.error.code, 3, index);
      state = result.state;
    }
  } else {
    const result = core.replay(data.header, data.entries, data.expectedFinalHash as string | undefined);
    if (!result.ok) throw new CliError(result.error.code, 3, result.error.entryIndex);
    state = result.state;
  }
  const canonicalState = core.canonicalState(state);
  const stateHash = createHash("sha256").update(canonicalState, "utf8").digest("hex");
  if (stateHash !== core.stateHash(state)) throw new CliError("CORE_HASH_MISMATCH", 1);
  if (mode === "replay" && data.expectedFinalHash !== undefined && stateHash !== data.expectedFinalHash) {
    throw new CliError("FINAL_HASH_MISMATCH", 3);
  }
  return {
    ok: true as const,
    summary: { phase: state.phase, outcome: state.outcome, tick: state.tick, wave: state.wave,
      lives: state.lives, gold: state.gold },
    canonicalState, stateHash,
    header: { schemaVersion: state.schemaVersion, rulesId: state.rulesId,
      rulesDigest: state.rulesDigest, seed: state.seed },
    entries: state.acceptedLog,
  };
}

export function failure(error: unknown) {
  const known = error instanceof CliError ? error : new CliError(
    error instanceof Error && error.message.startsWith("CORE_NOT_IMPLEMENTED")
      ? "CORE_NOT_IMPLEMENTED" : "INTERNAL_ERROR", 1);
  return { exitCode: known.exitCode, output: { ok: false as const,
    error: { code: known.code, entryIndex: known.entryIndex } } };
}
