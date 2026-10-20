// Cuts the Fusion Pixel CJK font (~600 KB) down to only the characters the
// Chinese translation uses. Runs automatically before `dev` and `build`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import subsetFont from 'subset-font';
import { buildPixelDigits } from './pixel-digits.mjs';

const SOURCE =
  'node_modules/@fontsource/fusion-pixel-12px-proportional-sc/files/fusion-pixel-12px-proportional-sc-latin-400-normal.woff2';
const OUT = 'src/assets/pixel-zh.woff2';

const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
let ascii = '';
for (let c = 0x20; c < 0x7f; c++) ascii += String.fromCharCode(c);
// Anything that can show up in dynamic text: numbers, money, units, punctuation.
const extra = '¥$×·…—–“”‘’、，。：；！？（）《》【】％＋';
// The workbench owns a compact bilingual phrase map; include its dynamic labels.
const signatureUI = readFileSync('src/ui/signature-drinks.ts', 'utf8');
const partnerText = ['src/ui/partners.ts','src/game/partners.ts','src/game/partner-stories.ts'].map(path => readFileSync(path,'utf8')).join('');
const text = Object.values(zh).join('') + signatureUI + partnerText + ascii + extra;

const out = await subsetFont(readFileSync(SOURCE), text, { targetFormat: 'woff2' });
mkdirSync('src/assets', { recursive: true });
writeFileSync(OUT, out);
console.log(`${OUT}: ${new Set(text).size} glyphs, ${(out.length / 1024).toFixed(1)} KB`);

// English text takes its digits from Fusion Pixel too (Pixelify's 5 reads as S).
const DIGITS_OUT = 'src/assets/pixel-digits.woff2';
const digits = await buildPixelDigits(readFileSync(SOURCE));
writeFileSync(DIGITS_OUT, digits);
console.log(`${DIGITS_OUT}: 10 digits, ${digits.length} bytes`);
