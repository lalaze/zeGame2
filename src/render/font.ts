// A tiny 3x5 bitmap font for text drawn inside the pixel scene.
const GLYPHS: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001111', '$': '011110010011110', '+': '000010111010000',
  '.': '000000000000010', '-': '000000111000000', '!': '010010010000010', '?': '111001011000010',
  ' ': '000000000000000', ':': '000010000010000',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
};

// Letters that are unreadable at 3px wide get extra columns.
const WIDE: Record<string, string> = {
  M: '1000111011101011000110001',
  N: '10011101101110011001',
  W: '1000110001101011101110001',
};

/** Every character the font draws (letters in either case). */
export const FONT_CHARS = [...Object.keys(GLYPHS), ...Object.keys(WIDE)];

/** A character's bits, row by row, and its width; glyphs are all 5 rows tall. */
export const glyph = (ch: string) => {
  const c = ch.toUpperCase();
  const bits = WIDE[c] ?? GLYPHS[c] ?? GLYPHS['?'];
  return { bits, w: bits.length / 5 };
};

export const textWidth = (text: string) => Math.max(0, [...text].reduce((sum, ch) => sum + glyph(ch).w + 1, 0) - 1);

function plain(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  for (const ch of text) {
    const { bits, w } = glyph(ch);
    for (let p = 0; p < bits.length; p++) {
      if (bits[p] === '1') ctx.fillRect(x + (p % w), y + Math.floor(p / w), 1, 1);
    }
    x += w + 1;
  }
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  outline?: string,
): void {
  x = Math.round(x);
  y = Math.round(y);
  if (outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      plain(ctx, text, x + dx, y + dy, outline);
    }
  }
  plain(ctx, text, x, y, color);
}
