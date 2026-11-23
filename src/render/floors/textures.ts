// Small drawn props for the cross-section style: cups, speech bubbles, oven glow, bread, sparkles
// and steam, made on canvases so they need no art files.
import Phaser from 'phaser';

function canvasTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (c: CanvasRenderingContext2D) => void): void {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  scene.textures.addCanvas(key, canvas);
}

const LINE = '#7a5a44', PAPER = '#fffaf0';

function drawCup(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.lineWidth = 3 * s; c.strokeStyle = LINE; c.lineJoin = 'round';
  c.fillStyle = PAPER; c.beginPath(); c.ellipse(x, y + 13 * s, 17 * s, 5 * s, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x - 12 * s, y - 8 * s); c.lineTo(x + 12 * s, y - 8 * s); c.lineTo(x + 9 * s, y + 10 * s); c.lineTo(x - 9 * s, y + 10 * s); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.arc(x + 13 * s, y - 1 * s, 5 * s, -Math.PI / 2, Math.PI / 2); c.stroke();
  c.fillStyle = '#9b6b4b'; c.beginPath(); c.ellipse(x, y - 8 * s, 11 * s, 3 * s, 0, 0, Math.PI * 2); c.fill();
}

function drawBubble(c: CanvasRenderingContext2D, width: number, height: number, fill = PAPER): void {
  const r = 22, bottom = height - 18;
  c.lineWidth = 4; c.strokeStyle = LINE; c.fillStyle = fill;
  c.beginPath();
  c.moveTo(4 + r, 4); c.arcTo(width - 4, 4, width - 4, bottom, r); c.arcTo(width - 4, bottom, 4, bottom, r);
  c.lineTo(width / 2 + 10, bottom); c.lineTo(width / 2, height - 4); c.lineTo(width / 2 - 10, bottom);
  c.arcTo(4, bottom, 4, 4, r); c.arcTo(4, 4, width - 4, 4, r); c.closePath();
  c.fill(); c.stroke();
}

export function makeTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'cup', 44, 40, c => drawCup(c, 20, 20, 1));
  canvasTexture(scene, 'bubble-coffee', 104, 96, c => { drawBubble(c, 104, 96); drawCup(c, 50, 38, 1.35); });
  canvasTexture(scene, 'bubble-heart', 104, 96, c => {
    drawBubble(c, 104, 96);
    c.fillStyle = '#e58f9a'; c.strokeStyle = LINE; c.lineWidth = 3;
    c.beginPath(); c.moveTo(52, 62); c.bezierCurveTo(20, 40, 30, 14, 52, 30); c.bezierCurveTo(74, 14, 84, 40, 52, 62); c.fill(); c.stroke();
  });
  canvasTexture(scene, 'glow', 260, 170, c => {
    const g = c.createRadialGradient(130, 85, 6, 130, 85, 84);
    g.addColorStop(0, 'rgba(255,190,90,.95)'); g.addColorStop(.5, 'rgba(255,150,60,.45)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, 260, 170);
  });
  canvasTexture(scene, 'bread', 56, 40, c => {
    c.fillStyle = '#e3a650'; c.strokeStyle = LINE; c.lineWidth = 3;
    c.beginPath(); c.ellipse(28, 22, 24, 15, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#a9672f'; c.lineWidth = 2.5;
    for (const x of [18, 28, 38]) { c.beginPath(); c.moveTo(x - 4, 14); c.lineTo(x + 3, 26); c.stroke(); }
  });
  canvasTexture(scene, 'bubble-bread', 104, 96, c => {
    drawBubble(c, 104, 96);
    c.fillStyle = '#e3a650'; c.strokeStyle = LINE; c.lineWidth = 3;
    c.beginPath(); c.ellipse(52, 40, 30, 19, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#a9672f'; c.lineWidth = 3;
    for (const x of [40, 52, 64]) { c.beginPath(); c.moveTo(x - 5, 30); c.lineTo(x + 4, 46); c.stroke(); }
  });
  canvasTexture(scene, 'bubble-moment', 104, 96, c => {
    drawBubble(c, 104, 96, '#ffe9a8');
    c.fillStyle = '#b3641f'; c.font = 'bold 60px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('!', 52, 42);
  });
  canvasTexture(scene, 'bubble-sad', 104, 96, c => {
    drawBubble(c, 104, 96);
    c.strokeStyle = LINE; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.arc(52, 52, 16, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.fillStyle = '#7fa7c9'; c.beginPath(); c.moveTo(72, 18); c.quadraticCurveTo(82, 34, 72, 38); c.quadraticCurveTo(62, 34, 72, 18); c.fill();
  });
  canvasTexture(scene, 'sparkle', 40, 40, c => {
    c.fillStyle = '#fff6d8'; c.strokeStyle = '#e6b649'; c.lineWidth = 2;
    c.beginPath();
    for (let k = 0; k < 8; k++) { const r = k % 2 ? 6 : 18, a = k * Math.PI / 4 - Math.PI / 2; c.lineTo(20 + r * Math.cos(a), 20 + r * Math.sin(a)); }
    c.closePath(); c.fill(); c.stroke();
  });
  canvasTexture(scene, 'puff', 40, 40, c => {
    const g = c.createRadialGradient(20, 20, 2, 20, 20, 19);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 40, 40);
  });
}
