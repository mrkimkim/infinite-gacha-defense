/** Presentation only: no core state, RNG, commands, or wall clock. Import CSS separately. */
export type ArtStatus = 'production' | 'candidate' | 'synthetic-test';
export type ArtClipName = 'idle' | 'attack' | 'recovery';
export type ArtFrame = Readonly<{ x: number; y: number; width: number; height: number }>;
export type ArtClip = Readonly<{ frames: readonly number[]; durations: readonly number[] }>;
export type ArtSprite = Readonly<{
  id: string; src: string; status: ArtStatus; approvalRef: string | null;
  width: number; height: number; pivot: Readonly<{ x: number; y: number }>;
  frames: readonly ArtFrame[]; clips: Readonly<Record<ArtClipName, ArtClip>>;
}>;
export type ArtManifest = Readonly<{ version: 1; sprites: readonly ArtSprite[] }>;
const CLIPS = ['idle', 'attack', 'recovery'] as const;
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('ART_OBJECT');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some(key => !Object.hasOwn(result, key))) throw new Error('ART_KEYS');
  return result;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error('ART_INTEGER');
  return value;
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max || Object.keys(value).length !== value.length || !Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(Boolean)) throw new Error('ART_ARRAY');
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) throw new Error('ART_TEXT');
  return value;
}
/** Reject malformed metadata before starting any image request; return an immutable owned copy. */
export function validateArtManifest(input: unknown): ArtManifest {
  const root = object(input, ['version', 'sprites']);
  if (root.version !== 1) throw new Error('ART_VERSION');
  const ids = new Set<string>();
  const sources = new Map<string, string>();
  const sprites = array(root.sprites, 512).map(value => {
    const s = object(value, ['id', 'src', 'status', 'approvalRef', 'width', 'height', 'pivot', 'frames', 'clips']);
    const id = text(s.id), src = text(s.src);
    if (!/^[a-z0-9][a-z0-9._/-]*$/.test(id) || ids.has(id)) throw new Error('ART_ID');
    ids.add(id);
    // Local, deployment-relative raster assets only. No remote URLs, traversal or encoded paths.
    if (!/^assets\/mvp\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|webp)$/.test(src)) throw new Error('ART_SRC');
    if (!['production', 'candidate', 'synthetic-test'].includes(s.status as string)) throw new Error('ART_STATUS');
    const status = s.status as ArtStatus;
    const approvalRef = s.approvalRef === null ? null : text(s.approvalRef);
    if (status === 'production' && approvalRef === null) throw new Error('ART_APPROVAL');
    const width = integer(s.width, 1, 8192), height = integer(s.height, 1, 8192);
    const dimensions = `${width}:${height}`;
    if (sources.has(src) && sources.get(src) !== dimensions) throw new Error('ART_SOURCE_DIMENSIONS');
    sources.set(src, dimensions);
    const frames = array(s.frames, 256).map(value => {
      const f = object(value, ['x', 'y', 'width', 'height']);
      const x = integer(f.x, 0, width - 1), y = integer(f.y, 0, height - 1);
      return Object.freeze({ x, y, width: integer(f.width, 1, width - x), height: integer(f.height, 1, height - y) });
    });
    if (!frames.length || frames.some(f => f.width !== frames[0].width || f.height !== frames[0].height)) throw new Error('ART_FRAME_SIZE');
    const p = object(s.pivot, ['x', 'y']);
    const pivot = Object.freeze({ x: integer(p.x, 0, frames[0].width), y: integer(p.y, 0, frames[0].height) });
    const c = object(s.clips, CLIPS);
    const clips = {} as Record<ArtClipName, ArtClip>;
    for (const name of CLIPS) {
      const clip = object(c[name], ['frames', 'durations']);
      const indices = array(clip.frames, 256).map(n => integer(n, 0, frames.length - 1));
      const durations = array(clip.durations, 256).map(n => integer(n, 1, 1200));
      if (!indices.length || indices.length !== durations.length) throw new Error('ART_CLIP');
      clips[name] = Object.freeze({ frames: Object.freeze(indices), durations: Object.freeze(durations) });
    }
    return Object.freeze({ id, src, status, approvalRef, width, height, pivot,
      frames: Object.freeze(frames), clips: Object.freeze(clips) });
  });
  return Object.freeze({ version: 1, sprites: Object.freeze(sprites) });
}
export type ImageDimensions = Readonly<{ width: number; height: number }>;
export type ArtLoader = (src: string) => Promise<ImageDimensions>;
/** Settles even when a broken server never fires load/error. No DOM insertion. */
export function loadArtImage(src: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => finish(new Error('ART_TIMEOUT')), 10000);
    const finish = (error?: Error) => {
      clearTimeout(timer); image.onload = null; image.onerror = null;
      if (error) { image.src = ''; reject(error); }
      else resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onload = () => finish();
    image.onerror = () => finish(new Error('ART_LOAD'));
    image.src = src;
  });
}
export type ArtResolution = Readonly<
  { ok: true; sprite: ArtSprite } |
  { ok: false; reason: 'missing' | 'not-approved' | 'load-failed' | 'disposed'; fallback: 'role-icon' }
>;
/** Candidates/tests require explicit opt-in; they never become production by loading successfully. */
export function createArtLibrary(input: unknown, options: {
  loader?: ArtLoader; allow?: readonly ArtStatus[];
} = {}) {
  const manifest = validateArtManifest(input);
  const allowed = new Set(options.allow ?? ['production']);
  const loader = options.loader ?? loadArtImage;
  const sprites = new Map(manifest.sprites.map(sprite => [sprite.id, sprite]));
  const cache = new Map<string, { promise: Promise<boolean>; state: 'pending' | 'ready' | 'failed' }>();
  let disposed = false;
  const fallback = (reason: 'missing' | 'not-approved' | 'load-failed' | 'disposed'): ArtResolution =>
    ({ ok: false, reason, fallback: 'role-icon' });
  return {
    manifest,
    async resolve(id: string, options: { retryFailed?: boolean } = {}): Promise<ArtResolution> {
      if (disposed) return fallback('disposed');
      const sprite = sprites.get(id);
      if (!sprite) return fallback('missing');
      if (!allowed.has(sprite.status)) return fallback('not-approved');
      let request = cache.get(sprite.src);
      if (!request || (options.retryFailed && request.state === 'failed')) {
        const entry: { promise: Promise<boolean>; state: 'pending' | 'ready' | 'failed' } = {
          promise: Promise.resolve(false), state: 'pending',
        };
        entry.promise = Promise.resolve().then(() => loader(sprite.src)).then(size =>
          size.width === sprite.width && size.height === sprite.height).catch(() => false)
          .then(ok => { entry.state = ok ? 'ready' : 'failed'; return ok; });
        request = entry;
        cache.set(sprite.src, entry);
      }
      const ok = await request.promise;
      return disposed ? fallback('disposed') : ok ? { ok: true, sprite } : fallback('load-failed');
    },
    dispose() { disposed = true; cache.clear(); },
  };
}
const duration = (clip: ArtClip) => clip.durations.reduce((sum, ticks) => sum + ticks, 0);
function frameAt(clip: ArtClip, tick: number): number {
  for (let i = 0; i < clip.frames.length; i++) {
    if (tick < clip.durations[i]) return clip.frames[i];
    tick -= clip.durations[i];
  }
  return clip.frames[clip.frames.length - 1];
}
export type ArtPose = Readonly<{ clip: ArtClipName; frame: number; rect: ArtFrame }>;
/** One player per match-owner + entity. attackTick is an already committed attack event, not anticipation. */
export function createSpritePlayer(sprite: ArtSprite) {
  let owner: object | null = null, lastTick = 0, elapsed = 0, generation = 0;
  let attackAt: number | null = null, lastAttackTick = -1, pendingAttack = false;
  return {
    reset(nextOwner: object, tick = 0) {
      integer(tick, 0, Number.MAX_SAFE_INTEGER);
      owner = nextOwner; lastTick = tick; elapsed = 0; attackAt = null; lastAttackTick = -1; pendingAttack = false;
      return ++generation;
    },
    sample(input: { owner: object; generation: number; tick: number; paused: boolean; attackTick?: number }): ArtPose | null {
      const { tick, paused, attackTick } = input;
      integer(tick, 0, Number.MAX_SAFE_INTEGER);
      if (owner !== input.owner || generation !== input.generation || tick < lastTick) return null;
      if (attackTick !== undefined) integer(attackTick, 0, tick);
      const previousTick = lastTick;
      if (!paused) elapsed += tick - lastTick;
      lastTick = tick;
      if (!paused && pendingAttack) {
        attackAt = elapsed - (tick - previousTick); pendingAttack = false;
      }
      if (attackTick !== undefined && attackTick >= previousTick && attackTick > lastAttackTick) {
        lastAttackTick = attackTick;
        if (paused) pendingAttack = true;
        else attackAt = elapsed - (tick - attackTick);
      }
      let clip: ArtClipName = 'idle', age = elapsed;
      if (attackAt !== null) {
        age = elapsed - attackAt;
        const attackDuration = duration(sprite.clips.attack), recoveryDuration = duration(sprite.clips.recovery);
        if (age < attackDuration) clip = 'attack';
        else if (age < attackDuration + recoveryDuration) { clip = 'recovery'; age -= attackDuration; }
        else { age -= attackDuration + recoveryDuration; }
      }
      if (clip === 'idle') age %= duration(sprite.clips.idle);
      const frame = frameAt(sprite.clips[clip], age);
      return { clip, frame, rect: sprite.frames[frame] };
    },
  };
}
/** Coordinates are CSS pixels; anchor is the desired foot point, pivot is frame-local source pixels. */
export function spriteLayout(sprite: ArtSprite, frameIndex: number, box: { width: number; height: number }, anchor: { x: number; y: number }) {
  integer(frameIndex, 0, sprite.frames.length - 1);
  if (![box.width, box.height, anchor.x, anchor.y].every(Number.isFinite) || box.width <= 0 || box.height <= 0) throw new Error('ART_LAYOUT');
  const frame = sprite.frames[frameIndex];
  const scale = Math.min(box.width / frame.width, box.height / frame.height);
  return { left: anchor.x - sprite.pivot.x * scale, top: anchor.y - sprite.pivot.y * scale,
    width: frame.width * scale, height: frame.height * scale,
    backgroundSize: `${sprite.width * scale}px ${sprite.height * scale}px`,
    backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px` };
}

/** Named adapter contracts for consumers; all image resolution results require an ok check. */
export type ArtLibrary = ReturnType<typeof createArtLibrary>;
export type SpritePlayer = ReturnType<typeof createSpritePlayer>;
export type SpriteSample = Parameters<SpritePlayer['sample']>[0];
export type SpriteLayout = ReturnType<typeof spriteLayout>;
