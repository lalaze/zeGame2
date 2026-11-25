// Generates 20,000+ random + boundary vectors from Node 22 / V8 for every numeric & JSON primitive
// in `godot/core/` (`JsMath`, `JsJson`, `JsUtil`), written to gitignored `godot/.parity/foundation.*`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'godot/.parity');

const buf = new ArrayBuffer(8);
const f64 = new Float64Array(buf);
const u64 = new BigUint64Array(buf);
const u32 = new Uint32Array(buf);

function toHex(x) {
  if (Number.isNaN(x)) return '7ff8000000000000';
  f64[0] = x;
  return u64[0].toString(16).padStart(16, '0');
}

function fromBits(hi, lo) {
  u32[0] = lo >>> 0;
  u32[1] = hi >>> 0;
  return f64[0];
}

// Deterministic xorshift64* PRNG
let rngState = 0x9e3779b97f4a7c15n;
function nextU64() {
  let x = rngState;
  x ^= x >> 12n;
  x ^= (x << 25n) & 0xffffffffffffffffn;
  x ^= x >> 27n;
  rngState = x;
  return (x * 0x2545f4914f6cdd1dn) & 0xffffffffffffffffn;
}
function nextU32() {
  return Number(nextU64() & 0xffffffffn) >>> 0;
}
function nextFloatBits(allowSubnormal = true) {
  while (true) {
    const bits = nextU64();
    const exp = Number((bits >> 52n) & 0x7ffn);
    if (exp === 0x7ff) continue; // skip NaN/Inf in random stream
    if (!allowSubnormal && exp === 0) continue;
    u64[0] = bits;
    return f64[0];
  }
}
function nextUnit() {
  return nextU32() / 4294967296;
}
function nextPositiveNormal() {
  const x = Math.abs(nextFloatBits(true));
  return x === 0 ? 1.0 : x;
}
function nextModerate(maxExp = 40) {
  const sign = (nextU32() & 1) ? -1 : 1;
  const exp = (nextU32() % (2 * maxExp + 1)) - maxExp;
  const mant = 1 + nextUnit();
  return sign * mant * Math.pow(2, exp);
}

export function generateFoundationVectors(count = 20000) {
  mkdirSync(OUT_DIR, { recursive: true });
  const sections = {};

  // 1. parse_float & number_to_string
  const parseLines = [];
  const strLines = [];
  const specialNumbers = [
    0, -0, 1, -1, 0.1, 0.2, 0.3, 0.5, -0.5, 0.15, 0.25, 0.35, 0.65, 0.85, 1.12, 1.75, 1.9,
    0.49999999999999994, -0.49999999999999994, -0.5000000000000001,
    1.005, 1e-6, 1e-7, 9.999999999999999e-7, 1e20, 1e21, 9.999999999999999e20,
    Number.MIN_VALUE, -Number.MIN_VALUE, 2.2250738585072014e-308, 2.225073858507201e-308,
    Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER,
    4503599627370495.5, -4503599627370495.5, 4503599627370496, -4503599627370496,
    Infinity, -Infinity, NaN,
    fromBits(0x3ff00000, 0x00000001), // 1 + eps
    fromBits(0x3fefffff, 0xffffffff), // 1 - eps/2
    fromBits(0x000fffff, 0xffffffff), // largest subnormal
    fromBits(0x00000000, 0x00000002), // 2 * MIN_VALUE
  ];
  const trickyParseStrings = [
    '0', '-0', '+0', '0.0', '-0.0', ' 42 ', '\t1.25\n', '1e309', '-1e309', '1e-325', '-1e-325',
    '5e-324', '2.5e-324', '2.4703282292062327e-324', '2.4703282292062328e-324',
    '2.2250738585072011e-308', '2.2250738585072012e-308', '2.2250738585072014e-308',
    '1.7976931348623157e+308', '1.7976931348623158e+308', '1.7976931348623159e+308',
    '9007199254740991', '9007199254740992', '9007199254740993', '9007199254740994',
    '0.' + '0'.repeat(300) + '12345678901234567890123456789',
    '1.' + '0'.repeat(50) + '5',
    '1.00000000000000011102230246251565404236316680908203125', // exact halfway 1 + 2^-53
    '1.0000000000000001110223024625156540423631668090820312500001',
    '1.00000000000000033306690738754696212708950042724609375', // exact halfway 1 + 3*2^-53
    'Infinity', '-Infinity', '+Infinity', 'NaN', '', '   ',
  ];
  for (const s of trickyParseStrings) {
    parseLines.push(`${JSON.stringify(s)}\t${toHex(Number(s))}`);
  }
  for (const x of specialNumbers) {
    const s = String(x);
    strLines.push(`${toHex(x)}\t${s}`);
    parseLines.push(`${JSON.stringify(s)}\t${toHex(Number(s))}`);
  }
  for (let i = 0; i < count; i++) {
    const x = i % 4 === 0 ? nextFloatBits(true)
      : i % 4 === 1 ? nextModerate(20)
      : i % 4 === 2 ? (nextUnit() - 0.5) * 1e6
      : nextModerate(300);
    const s = String(x);
    strLines.push(`${toHex(x)}\t${s}`);
    parseLines.push(`${JSON.stringify(s)}\t${toHex(Number(s))}`);
  }
  writeFileSync(join(OUT_DIR, 'parse_float.tsv'), parseLines.join('\n') + '\n');
  writeFileSync(join(OUT_DIR, 'number_to_string.tsv'), strLines.join('\n') + '\n');
  sections.parse_float = parseLines.length;
  sections.number_to_string = strLines.length;

  // 2. Math.hypot
  const hypotLines = [];
  const hypotEdges = [
    [0, 0], [-0, -0], [0, -0], [3, 4], [-3, 4], [1e200, 1e200], [1e-200, 1e-200],
    [1e308, 1e308], [Number.MIN_VALUE, Number.MIN_VALUE],
    [Infinity, 0], [-Infinity, NaN], [NaN, Infinity], [NaN, 1], [1, NaN],
  ];
  for (const [a, b] of hypotEdges) hypotLines.push(`${toHex(a)}\t${toHex(b)}\t${toHex(Math.hypot(a, b))}`);
  for (let i = 0; i < count; i++) {
    const a = i % 3 === 0 ? nextFloatBits(true) : nextModerate(50);
    const b = i % 3 === 0 ? nextFloatBits(true) : nextModerate(50);
    hypotLines.push(`${toHex(a)}\t${toHex(b)}\t${toHex(Math.hypot(a, b))}`);
  }
  writeFileSync(join(OUT_DIR, 'hypot.tsv'), hypotLines.join('\n') + '\n');
  sections.hypot = hypotLines.length;

  // 3. Math.log
  const logLines = [];
  const logEdges = [
    0, -0, -1, -Infinity, Infinity, NaN, 1, 2, 0.5, Math.E, 10, 1000,
    Number.MIN_VALUE, 2.2250738585072014e-308, Number.MAX_VALUE,
    1 + 1e-15, 1 - 1e-15, 1 + 1e-10, 1 - 1e-10, 1 + 1e-7, 1 - 1e-7,
    Math.SQRT2, Math.SQRT1_2, 1.5, 0.75, 1.414213562373095,
  ];
  for (const x of logEdges) logLines.push(`${toHex(x)}\t${toHex(Math.log(x))}`);
  for (let i = 0; i < count; i++) {
    let x;
    if (i % 5 === 0) x = nextPositiveNormal();
    else if (i % 5 === 1) x = 1 + (nextUnit() - 0.5) * 1e-6;
    else if (i % 5 === 2) x = 0.5 + nextUnit() * 1.5;
    else if (i % 5 === 3) x = Math.abs(nextModerate(300));
    else x = nextModerate(50); // includes negatives
    logLines.push(`${toHex(x)}\t${toHex(Math.log(x))}`);
  }
  writeFileSync(join(OUT_DIR, 'log.tsv'), logLines.join('\n') + '\n');
  sections.log = logLines.length;

  // 4. Math.log10
  const log10Lines = [];
  for (const x of [...logEdges, 0.001, 0.01, 0.1, 10, 100, 1000, 1e6, 1e9, 1e12, 1e18, 1e36, 1e100, 1e300, 1e-100, 1e-300]) {
    log10Lines.push(`${toHex(x)}\t${toHex(Math.log10(x))}`);
  }
  for (let i = 0; i < count; i++) {
    let x;
    if (i % 5 === 0) x = nextPositiveNormal();
    else if (i % 5 === 1) x = 1 + (nextUnit() - 0.5) * 1e-6;
    else if (i % 5 === 2) x = Math.pow(10, (nextU32() % 600) - 300) * (0.999999 + nextUnit() * 0.000002);
    else if (i % 5 === 3) x = Math.abs(nextModerate(300));
    else x = nextModerate(50);
    log10Lines.push(`${toHex(x)}\t${toHex(Math.log10(x))}`);
  }
  writeFileSync(join(OUT_DIR, 'log10.tsv'), log10Lines.join('\n') + '\n');
  sections.log10 = log10Lines.length;

  // 5. Math.pow
  const powLines = [];
  const powBases = [0, -0, 1, -1, 0.25, 0.3, 0.35, 0.4, 0.45, 0.6, 0.65, 0.7, 0.8, 0.85, 1.12, 1.75, 1.9, 2, -2, 10, 1000, Infinity, -Infinity, NaN, Number.MIN_VALUE, Number.MAX_VALUE, 1 + 1e-12, 1 - 1e-12];
  const powExps = [0, -0, 0.5, -0.5, 1, -1, 2, -2, 3, -3, 10, 25, 100, -100, 0.1, -0.1, 1.5, -1.5, 1e20, -1e20, Infinity, -Infinity, NaN];
  for (const x of powBases) {
    for (const y of powExps) {
      powLines.push(`${toHex(x)}\t${toHex(y)}\t${toHex(Math.pow(x, y))}`);
    }
  }
  for (let i = 0; i < count; i++) {
    let x, y;
    const mode = i % 6;
    if (mode === 0) {
      x = Math.abs(nextModerate(30));
      y = nextModerate(4);
    } else if (mode === 1) {
      x = 1 + (nextUnit() - 0.5) * 1e-4;
      y = nextModerate(12);
    } else if (mode === 2) {
      x = nextModerate(10);
      y = ((nextU32() % 41) - 20); // integer exponents with neg bases
    } else if (mode === 3) {
      x = nextPositiveNormal();
      y = (nextUnit() - 0.5) * 4;
    } else if (mode === 4) {
      x = 0.01 + nextUnit() * 10;
      y = (nextUnit() - 0.5) * 100;
    } else {
      x = nextFloatBits(true);
      y = nextFloatBits(true);
    }
    powLines.push(`${toHex(x)}\t${toHex(y)}\t${toHex(Math.pow(x, y))}`);
  }
  writeFileSync(join(OUT_DIR, 'pow.tsv'), powLines.join('\n') + '\n');
  sections.pow = powLines.length;

  // 6. Math.round
  const roundLines = [];
  for (const x of [
    ...specialNumbers, -2.5, -1.5, -0.5, -0.49999999999999994, -0.5000000000000001,
    0.49999999999999994, 0.5, 0.5000000000000001, 1.5, 2.5, 3.5,
    fromBits(0x3fdfffff, 0xffffffff), // 0.5 - 2^-54
    fromBits(0xbfdfffff, 0xffffffff), // -0.5 + 2^-54
    fromBits(0xbfe00000, 0x00000001), // -0.5 - 2^-53
  ]) {
    roundLines.push(`${toHex(x)}\t${toHex(Math.round(x))}`);
  }
  for (let i = 0; i < count; i++) {
    let x;
    if (i % 4 === 0) x = (nextU32() % 200 - 100) + 0.5;
    else if (i % 4 === 1) x = nextModerate(54);
    else if (i % 4 === 2) x = (nextUnit() - 0.5) * 10;
    else x = nextFloatBits(true);
    roundLines.push(`${toHex(x)}\t${toHex(Math.round(x))}`);
  }
  writeFileSync(join(OUT_DIR, 'round.tsv'), roundLines.join('\n') + '\n');
  sections.round = roundLines.length;

  // 7. toFixed & toExponential
  const fixedLines = [];
  const expLines = [];
  for (const x of specialNumbers) {
    for (const d of [0, 1, 2, 5, 20, 100]) {
      fixedLines.push(`${toHex(x)}\t${d}\t${x.toFixed(d)}`);
      expLines.push(`${toHex(x)}\t${d}\t${x.toExponential(d)}`);
    }
    expLines.push(`${toHex(x)}\t-1\t${x.toExponential()}`);
  }
  for (let i = 0; i < count; i++) {
    const x = i % 3 === 0 ? nextModerate(25)
      : i % 3 === 1 ? (nextUnit() - 0.5) * 1e6
      : nextModerate(65);
    const d = nextU32() % 21;
    fixedLines.push(`${toHex(x)}\t${d}\t${x.toFixed(d)}`);
    const ex = i % 4 === 0 ? nextFloatBits(true) : x;
    const ed = i % 5 === 0 ? -1 : (nextU32() % 21);
    expLines.push(`${toHex(ex)}\t${ed}\t${ed < 0 ? ex.toExponential() : ex.toExponential(ed)}`);
  }
  writeFileSync(join(OUT_DIR, 'to_fixed.tsv'), fixedLines.join('\n') + '\n');
  writeFileSync(join(OUT_DIR, 'to_exponential.tsv'), expLines.join('\n') + '\n');
  sections.to_fixed = fixedLines.length;
  sections.to_exponential = expLines.length;

  // 8. 32-bit int ops
  const int32Lines = [];
  const intEdges = [
    0, -0, 1, -1, 0x7fffffff, -0x80000000, 0xffffffff, 0x9e3779b1, 0x85ebca6b, 0xc2b2ae35,
    4294967296, -4294967296, 9007199254740991, -9007199254740991, 1.9, -1.9, NaN, Infinity, -Infinity,
  ];
  for (const a of intEdges) {
    for (const b of [0, 1, 13, 16, 31, 32, 33, -1, 0x9e3779b1, 0x85ebca6b]) {
      int32Lines.push([
        toHex(a), toHex(b),
        toHex(Math.imul(a, b)),
        toHex(a >>> b),
        toHex(a >> b),
        toHex(a << b),
        toHex(a ^ b),
      ].join('\t'));
    }
  }
  for (let i = 0; i < count; i++) {
    const a = i % 3 === 0 ? (nextU32() - 0x80000000) : nextModerate(45);
    const b = i % 3 === 0 ? (nextU32() - 0x80000000) : nextModerate(35);
    int32Lines.push([
      toHex(a), toHex(b),
      toHex(Math.imul(a, b)),
      toHex(a >>> b),
      toHex(a >> b),
      toHex(a << b),
      toHex(a ^ b),
    ].join('\t'));
  }
  writeFileSync(join(OUT_DIR, 'int32.tsv'), int32Lines.join('\n') + '\n');
  sections.int32 = int32Lines.length;

  // 9. JSON.stringify & JSON.parse structured cases
  const jsonCases = [];
  const sampleObjects = [
    null, true, false, 0, -0, 1, -1, 0.1, 0.3, 1e21, 1e-7, NaN, Infinity, -Infinity,
    '', 'hello', 'quote"slash\\newline\ntab\tctrl\x01\x08\x0c\x1f', '中文☕🍰é',
    [], [1, -0, NaN, Infinity, undefined, null, 'a'],
    {},
    { b: 1, a: 2, '10': 'ten', '2': 'two', '0': 'zero', '01': 'z1', '4294967294': 'max', '4294967295': 'notidx' },
    { keep: 1, drop: undefined, nul: null, negZero: -0, inf: Infinity, nan: NaN },
    { nested: [{ x: 0.1 + 0.2, y: 1 / 3, z: Number.MIN_VALUE }] },
  ];
  for (const val of sampleObjects) {
    const str = JSON.stringify(val);
    jsonCases.push({ input: encodeWire(val), expectedStringify: str });
  }
  for (let i = 0; i < 2000; i++) {
    const obj = {
      a: nextFloatBits(true),
      b: nextModerate(20),
      '2': nextFloatBits(true),
      '0': i,
      '10': nextUnit(),
      arr: [nextFloatBits(true), i % 3 === 0 ? -0 : nextModerate(5), i % 7 === 0 ? undefined : null],
      s: i % 5 === 0 ? `v_${i}_"\n\\☕` : `k${i}`,
    };
    if (i % 4 === 0) obj.undef = undefined;
    jsonCases.push({ input: encodeWire(obj), expectedStringify: JSON.stringify(obj) });
  }
  writeFileSync(join(OUT_DIR, 'json_cases.json'), JSON.stringify(jsonCases));
  sections.json = jsonCases.length;

  return sections;
}

function encodeWire(v) {
  if (v === undefined) return { $t: 'u' };
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
  if (typeof v === 'number') return { $t: 'f', h: toHex(v) };
  if (Array.isArray(v)) return v.map(encodeWire);
  const out = {};
  for (const k of Object.keys(v)) out[k] = encodeWire(v[k]);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const s = generateFoundationVectors(20000);
  console.log('Generated foundation vectors in', Date.now() - t0, 'ms:', s);
}
