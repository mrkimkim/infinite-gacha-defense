import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { canonicalJson, sha256 } from '../../src/core/serialization.ts';

test('canonical JSON recursively sorts keys lexically rather than numerically', () => {
  const value = { z: 0, a: { '2': 2, '10': 10, b: true, A: null }, Z: '한글😀' };
  assert.equal(canonicalJson(value),
    '{"Z":"한글😀","a":{"10":10,"2":2,"A":null,"b":true},"z":0}');
  assert.equal(canonicalJson({ a: value.a, Z: '한글😀', z: 0 }), canonicalJson(value));
});

test('canonical JSON preserves arrays, strings, escapes, and safe-integer boundaries', () => {
  const value = [3, 1, 2, null, false, true, '', '"\\\n\t\u0000',
    Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, -0, '\ud800'];
  assert.equal(canonicalJson(value), JSON.stringify(value));
  assert.equal(canonicalJson('a\r\b\f/\u2028\u2029'),
    JSON.stringify('a\r\b\f/\u2028\u2029'));
  assert.equal(canonicalJson([]), '[]');
  assert.equal(canonicalJson({}), '{}');
});

test('canonical JSON accepts frozen and null-prototype data without mutation', () => {
  const dictionary = Object.create(null) as Record<string, unknown>;
  dictionary.z = 2;
  dictionary.__proto__ = 'literal key';
  dictionary.a = Object.freeze([Object.freeze({ x: 1 })]);
  Object.freeze(dictionary);
  assert.equal(canonicalJson(dictionary), '{"__proto__":"literal key","a":[{"x":1}],"z":2}');
  assert.equal(dictionary.__proto__, 'literal key');
});

test('canonical JSON allows shared acyclic objects but rejects object and array cycles', () => {
  const shared = { x: 1 };
  assert.equal(canonicalJson({ b: shared, a: shared }), '{"a":{"x":1},"b":{"x":1}}');
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), TypeError);
  const array: unknown[] = [];
  array.push({ array });
  assert.throws(() => canonicalJson(array), TypeError);
  assert.equal(canonicalJson({ next: 1 }), '{"next":1}');
});

test('canonical JSON rejects every non-JSON primitive at any depth', () => {
  for (const value of [undefined, () => 0, Symbol('x'), 1n,
    NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1]) {
    assert.throws(() => canonicalJson(value), TypeError);
    assert.throws(() => canonicalJson({ value }), TypeError);
    assert.throws(() => canonicalJson([value]), TypeError);
  }
});

test('canonical JSON rejects class instances, boxed values, and non-plain collections', () => {
  class Example { x = 1; }
  class ExtendedArray extends Array<number> {}
  for (const value of [new Example(), new Date(0), new Map(), new Set(), /x/,
    new Number(1), new String('x'), new Boolean(false), new Uint8Array([1]),
    Object.create({ inherited: true }), new ExtendedArray(1, 2)]) {
    assert.throws(() => canonicalJson(value), TypeError);
  }
});

test('canonical JSON rejects sparse arrays and all extra array properties', () => {
  const sparse = [1, , 3];
  const extra = Object.assign([1], { extra: 2 });
  const oddIndex = Object.assign([1], { '01': 2 });
  const symbol = Object.assign([1], { [Symbol('extra')]: 2 });
  const hidden = Object.defineProperty([1], 'hidden', { value: 2 });
  const hiddenIndex = Object.defineProperty([1], '0', { enumerable: false });
  for (const value of [sparse, new Array(2), extra, oddIndex, symbol, hidden, hiddenIndex]) {
    assert.throws(() => canonicalJson(value), TypeError);
  }
});

test('canonical JSON rejects symbols and hidden/accessor properties without evaluating them', () => {
  let reads = 0;
  const object = { get x() { reads += 1; return 1; } };
  const array = Object.defineProperty([1], '0', {
    enumerable: true, get() { reads += 1; return 1; },
  });
  const toJSON = { toJSON() { reads += 1; return 'replacement'; } };
  for (const value of [object, array, toJSON,
    Object.defineProperty({}, 'hidden', { value: 1 }),
    Object.defineProperty({}, Symbol('hidden'), { value: 1 }),
    { [Symbol('visible')]: 1 }]) {
    assert.throws(() => canonicalJson(value), TypeError);
  }
  assert.equal(reads, 0);
});

test('SHA-256 matches standard short and multiblock known-answer vectors', () => {
  const vectors = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['The quick brown fox jumps over the lazy dog',
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'],
  ];
  for (const [input, expected] of vectors) assert.equal(sha256(input), expected);
});

test('SHA-256 matches the million-a vector', () => {
  assert.equal(sha256('a'.repeat(1_000_000)),
    'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
});

test('SHA-256 padding works before, at, and after every nearby block boundary', () => {
  for (let length = 0; length <= 260; length += 1) {
    const input = 'x'.repeat(length);
    assert.equal(sha256(input), createHash('sha256').update(input, 'utf8').digest('hex'),
      `UTF-8 length ${length}`);
  }
});

test('SHA-256 manual UTF-8 matches Node for all scalar boundaries and lone surrogates', () => {
  const inputs = [
    '한글 모모 😀🚀', '\u0000\u007f\u0080\u07ff\u0800\ud7ff\ue000\uffff',
    '\ud800\udc00\udbff\udfff', '\ud800', '\udfff', '\ud800x\udfff',
    '\ud800\ud800\udc00\udfff', '\udfff\ud800', '\ufffd',
    'a'.repeat(55) + '😀', '가'.repeat(64), '😀'.repeat(65),
    canonicalJson({ message: '안녕😀', missingSurrogate: '\ud800', answer: 42 }),
  ];
  for (const input of inputs) {
    const actual = sha256(input);
    assert.match(actual, /^[0-9a-f]{64}$/);
    assert.equal(actual, createHash('sha256').update(input, 'utf8').digest('hex'));
  }
  assert.equal(sha256('\ud800'), sha256('\ufffd'));
});

test('SHA-256 matches Node for deterministic mixed UTF-16 data and repeat invocations', () => {
  let input = '';
  for (let index = 0; index < 4096; index += 1) {
    input += String.fromCharCode((index * 7919 + 0xd800) & 0xffff);
  }
  const expected = createHash('sha256').update(input, 'utf8').digest('hex');
  assert.equal(sha256(input), expected);
  assert.equal(sha256('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256(input), expected);
});
