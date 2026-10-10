/** Presentation work only. Never schedules or changes authoritative game state. */
export function createLatestTaskGate<Owner extends object>(getOwner: () => Owner) {
  let generation = 0;
  let disposed = false;
  return {
    invalidate() { generation += 1; },
    dispose() { disposed = true; generation += 1; },
    async run<T>(work: () => T | Promise<T>, accept: (value: T) => void,
      reject: (error: unknown) => void): Promise<boolean> {
      if (disposed) return false;
      const ticket = ++generation;
      const owner = getOwner();
      const current = () => !disposed && ticket === generation && owner === getOwner();
      let value: T;
      try { value = await work(); }
      catch (error) {
        if (!current()) return false;
        reject(error);
        return true;
      }
      if (!current()) return false;
      // Consumer exceptions are programming errors, not failed async work.
      accept(value);
      return true;
    },
  };
}
