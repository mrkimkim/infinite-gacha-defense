/** Wall-clock adapter only: gameplay and phase transitions belong to the core. */
export type SchedulerPhase = 'preparation' | 'combat' | 'result';
export type FrameCallback = (timestamp: number) => void;

export interface SchedulerOptions<Match extends object> {
  /** Read the fixed tick duration from the core's public versioned rules. */
  tickMs: number;
  /** Stable per-game container/token, not a core state replaced by immutable updates. */
  getMatch: () => Match;
  getPhase: (match: Match) => SchedulerPhase;
  /** Errors propagate to the caller and permanently dispose this scheduler. */
  advance: (match: Match, ticks: number) => void;
  /** Like requestAnimationFrame, this must queue rather than invoke synchronously. */
  requestFrame: (callback: FrameCallback) => number;
  cancelFrame: (handle: number) => void;
  initiallyHidden?: boolean;
}

export interface SchedulerStatus {
  readonly paused: boolean;
  readonly hidden: boolean;
  readonly running: boolean;
  readonly disposed: boolean;
  readonly phase: SchedulerPhase;
  readonly epoch: number;
  readonly accumulator: number;
  readonly lastTimestamp: number | null;
}

export interface SchedulerController {
  /** Call after dispatching a command or replacing the match instance. */
  sync: () => void;
  setPaused: (paused: boolean) => void;
  setHidden: (hidden: boolean) => void;
  getStatus: () => SchedulerStatus;
  dispose: () => void;
}

const MAX_FRAME_MS = 250;

export function createScheduler<Match extends object>(
  options: SchedulerOptions<Match>,
): SchedulerController {
  const tickMs = options.tickMs;
  if (!Number.isSafeInteger(tickMs) || tickMs <= 0) {
    throw new RangeError('tickMs must be a positive safe integer');
  }
  let match = options.getMatch();
  let phase = options.getPhase(match);
  let paused = false;
  let hidden = options.initiallyHidden ?? false;
  let disposed = false;
  let epoch = 0;
  let accumulator = 0;
  let lastTimestamp: number | null = null;
  let pending: { handle: number | null } | null = null;

  function reset(): void {
    epoch += 1;
    accumulator = 0;
    lastTimestamp = null;
    const old = pending;
    pending = null;
    if (old?.handle !== null && old?.handle !== undefined) {
      options.cancelFrame(old.handle);
    }
  }

  function runnable(): boolean {
    return !disposed && !paused && !hidden && phase === 'combat';
  }

  function schedule(): void {
    if (!runnable() || pending !== null) return;
    const scheduledEpoch = epoch;
    const scheduledMatch = match;
    const ticket: { handle: number | null } = { handle: null };
    pending = ticket;
    ticket.handle = options.requestFrame((timestamp) => {
      // Cancellation is best effort: canceled or duplicated callbacks stay inert.
      if (disposed || scheduledEpoch !== epoch || pending !== ticket) return;
      if (scheduledMatch !== options.getMatch() ||
          options.getPhase(scheduledMatch) !== phase) {
        sync();
        return;
      }
      if (!runnable()) return;
      pending = null;
      if (!Number.isFinite(timestamp)) {
        accumulator = 0;
        lastTimestamp = null;
      } else if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      } else {
        const dt = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        if (dt < 0 || dt > MAX_FRAME_MS) {
          accumulator = 0;
        } else {
          accumulator += dt;
          const ticks = Math.floor(accumulator / tickMs);
          accumulator -= ticks * tickMs;
          if (ticks > 0) {
            try {
              options.advance(scheduledMatch, ticks);
            } catch (error) {
              disposed = true;
              reset();
              throw error;
            }
          }
        }
      }
      // advance may end a wave or a match. Never carry time across that boundary.
      sync();
    });
  }

  function sync(): void {
    if (disposed) return;
    const nextMatch = options.getMatch();
    const nextPhase = options.getPhase(nextMatch);
    if (nextMatch !== match || nextPhase !== phase) {
      reset();
      match = nextMatch;
      phase = nextPhase;
    }
    schedule();
  }

  const controller: SchedulerController = {
    sync,
    setPaused(value) {
      if (disposed || paused === value) return;
      paused = value;
      reset();
      sync();
    },
    setHidden(value) {
      if (disposed || hidden === value) return;
      hidden = value;
      reset();
      sync();
    },
    getStatus() {
      return { paused, hidden, running: runnable(), disposed, phase, epoch,
        accumulator, lastTimestamp };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
    },
  };
  sync();
  return controller;
}
