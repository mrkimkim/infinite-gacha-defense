import type { CoreApi } from './types.ts';

export type * from './types.ts';

/** Proposed stable identifiers; changing rule data requires a new rules ID. */
export const SCHEMA_VERSION = 1;
export const DEFAULT_RULES_ID = 'technical-v1';

/** API-only checkpoint: every function below deliberately fails until implemented. */
function notImplemented(): never {
  throw new Error('CORE_NOT_IMPLEMENTED: API-only checkpoint');
}

export const createMatch: CoreApi['createMatch'] = notImplemented;
export const dispatch: CoreApi['dispatch'] = notImplemented;
export const advance: CoreApi['advance'] = notImplemented;
export const observe: CoreApi['observe'] = notImplemented;
export const canonicalState: CoreApi['canonicalState'] = notImplemented;
export const stateHash: CoreApi['stateHash'] = notImplemented;
export const replay: CoreApi['replay'] = notImplemented;
export const getRules: CoreApi['getRules'] = notImplemented;
export const pathPosition: CoreApi['pathPosition'] = notImplemented;
export const boardPosition: CoreApi['boardPosition'] = notImplemented;
