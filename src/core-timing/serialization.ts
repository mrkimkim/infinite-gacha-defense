/**
 * Canonical JSON for the core's data-only, safe-integer schema. Object keys use
 * ordinal (UTF-16 code-unit) order, which is ASCII order for all schema keys.
 * Arrays keep their input order; callers apply any domain-specific ID ordering.
 * Unlike JSON.stringify, unsupported or hidden values are never silently lost.
 */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();

  function encode(current: unknown): string {
    if (current === null) return 'null';
    if (typeof current === 'string') return JSON.stringify(current);
    if (typeof current === 'boolean') return current ? 'true' : 'false';
    if (typeof current === 'number') {
      if (!Number.isSafeInteger(current)) {
        throw new TypeError('Canonical JSON numbers must be safe integers');
      }
      // JSON represents both positive and negative zero as 0.
      return String(current);
    }
    if (typeof current !== 'object') {
      throw new TypeError('Canonical JSON accepts only JSON data');
    }
    if (ancestors.has(current)) {
      throw new TypeError('Canonical JSON cannot contain cycles');
    }
    ancestors.add(current);
    try {
      const keys = Reflect.ownKeys(current);
      if (keys.some((key) => typeof key !== 'string')) {
        throw new TypeError('Canonical JSON cannot contain symbol keys');
      }
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype ||
            keys.length !== current.length + 1) {
          throw new TypeError('Canonical JSON requires dense, plain arrays');
        }
        const items: string[] = [];
        for (let index = 0; index < current.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
            throw new TypeError('Canonical JSON requires dense data-only arrays');
          }
          items.push(encode(descriptor.value));
        }
        return `[${items.join(',')}]`;
      }
      const prototype: unknown = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('Canonical JSON requires plain objects');
      }
      const members: string[] = [];
      for (const key of (keys as string[]).sort()) {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new TypeError('Canonical JSON requires enumerable data properties');
        }
        members.push(`${JSON.stringify(key)}:${encode(descriptor.value)}`);
      }
      return `{${members.join(',')}}`;
    } finally {
      ancestors.delete(current);
    }
  }

  return encode(value);
}

const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

/** UTF-8 with replacement for unpaired UTF-16 surrogates, without host APIs. */
function utf8(text: string): Uint8Array {
  // One UTF-16 code unit needs at most three bytes; a valid pair needs four.
  const bytes = new Uint8Array(text.length * 3);
  let length = 0;
  for (let index = 0; index < text.length; index += 1) {
    let codePoint = text.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + next - 0xdc00;
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }
    if (codePoint < 0x80) {
      bytes[length++] = codePoint;
    } else if (codePoint < 0x800) {
      bytes[length++] = 0xc0 | (codePoint >>> 6);
      bytes[length++] = 0x80 | (codePoint & 0x3f);
    } else if (codePoint < 0x10000) {
      bytes[length++] = 0xe0 | (codePoint >>> 12);
      bytes[length++] = 0x80 | ((codePoint >>> 6) & 0x3f);
      bytes[length++] = 0x80 | (codePoint & 0x3f);
    } else {
      bytes[length++] = 0xf0 | (codePoint >>> 18);
      bytes[length++] = 0x80 | ((codePoint >>> 12) & 0x3f);
      bytes[length++] = 0x80 | ((codePoint >>> 6) & 0x3f);
      bytes[length++] = 0x80 | (codePoint & 0x3f);
    }
  }
  return bytes.subarray(0, length);
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/** Pure, synchronous SHA-256 of UTF-8 text; lowercase 64-character hex. */
export function sha256(text: string): string {
  const input = utf8(text);
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  // Write the 64-bit bit count as two words without losing integer precision.
  const highLength = Math.floor(input.length / 0x20000000);
  const lowLength = (input.length * 8) >>> 0;
  for (let index = 0; index < 4; index += 1) {
    bytes[paddedLength - 8 + index] = highLength >>> (24 - index * 8);
    bytes[paddedLength - 4 + index] = lowLength >>> (24 - index * 8);
  }
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      words[index] = (bytes[position] << 24) | (bytes[position + 1] << 16) |
        (bytes[position + 2] << 8) | bytes[position + 3];
    }
    for (let index = 16; index < 64; index += 1) {
      const previous = words[index - 15];
      const recent = words[index - 2];
      const sigma0 = rotateRight(previous, 7) ^ rotateRight(previous, 18) ^
        (previous >>> 3);
      const sigma1 = rotateRight(recent, 17) ^ rotateRight(recent, 19) ^
        (recent >>> 10);
      words[index] = words[index - 16] + sigma0 + words[index - 7] + sigma1;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 = (h + sigma1 + choose + ROUND_CONSTANTS[index] +
        words[index]) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] += a;
    hash[1] += b;
    hash[2] += c;
    hash[3] += d;
    hash[4] += e;
    hash[5] += f;
    hash[6] += g;
    hash[7] += h;
  }
  let result = '';
  for (const word of hash) result += word.toString(16).padStart(8, '0');
  return result;
}
