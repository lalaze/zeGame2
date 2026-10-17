import { decodePng } from './pixel-conform.mjs';

export class RasterCanvas {
  constructor() { this.width = 1; this.height = 1; this.context = new RasterContext(this); }
  getContext() { return this.context; }
  get pixels() {
    if (this.buffer?.length !== this.width * this.height * 4) this.buffer = new Uint8ClampedArray(this.width * this.height * 4);
    return this.buffer;
  }
}
function inside(column, row, polygon) {
  let included = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const [left, top] = polygon[current], [right, bottom] = polygon[previous];
    if ((top > row) !== (bottom > row) && column < (right - left) * (row - top) / (bottom - top) + left) included = !included;
  }
  return included;
}
class RasterContext {
  constructor(canvas) { this.canvas = canvas; this.transform = [1, 1, 0, 0]; this.stack = []; this.path = []; this.clipPath = null; this.fillStyle = '#000000'; }
  save() { this.stack.push([this.transform.slice(), this.clipPath, this.fillStyle]); }
  restore() { [this.transform, this.clipPath, this.fillStyle] = this.stack.pop(); }
  translate(left, top) { this.transform[2] += left * this.transform[0]; this.transform[3] += top * this.transform[1]; }
  scale(horizontal, vertical) { this.transform[0] *= horizontal; this.transform[1] *= vertical; }
  setTransform(horizontal, skewY, skewX, vertical, left, top) { if (skewX || skewY) throw Error('Unsupported offline skew'); this.transform = [horizontal, vertical, left, top]; }
  beginPath() { this.path = []; }
  moveTo(left, top) { this.path.push(this.point(left, top)); }
  lineTo(left, top) { this.path.push(this.point(left, top)); }
  closePath() {}
  clip() { this.clipPath = this.path.slice(); }
  point(left, top) { return [left * this.transform[0] + this.transform[2], top * this.transform[1] + this.transform[3]]; }
  getImageData(left, top, width, height) {
    const data = new Uint8ClampedArray(width * height * 4), source = this.canvas.pixels;
    for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
      if (left + column >= 0 && left + column < this.canvas.width && top + row >= 0 && top + row < this.canvas.height)
        data.set(source.subarray(((top + row) * this.canvas.width + left + column) * 4, ((top + row) * this.canvas.width + left + column) * 4 + 4), (row * width + column) * 4);
    }
    return { data, width, height };
  }
  putImageData(image, left, top) {
    const target = this.canvas.pixels;
    for (let row = 0; row < image.height; row++) for (let column = 0; column < image.width; column++) {
      if (left + column >= 0 && left + column < this.canvas.width && top + row >= 0 && top + row < this.canvas.height)
        target.set(image.data.subarray((row * image.width + column) * 4, (row * image.width + column) * 4 + 4), ((top + row) * this.canvas.width + left + column) * 4);
    }
  }
  clearRect(left, top, width, height) { this.rectangle(left, top, width, height, [0, 0, 0, 0]); }
  fillRect(left, top, width, height) { this.rectangle(left, top, width, height, [...[1, 3, 5].map(index => parseInt(this.fillStyle.slice(index, index + 2), 16)), 255]); }
  rectangle(left, top, width, height, color) {
    const [startX, startY] = this.point(left, top), [endX, endY] = this.point(left + width, top + height), target = this.canvas.pixels;
    for (let row = Math.max(0, Math.round(Math.min(startY, endY))); row < Math.min(this.canvas.height, Math.round(Math.max(startY, endY))); row++)
      for (let column = Math.max(0, Math.round(Math.min(startX, endX))); column < Math.min(this.canvas.width, Math.round(Math.max(startX, endX))); column++)
        if (!this.clipPath || inside(column + .5, row + .5, this.clipPath)) target.set(color, (row * this.canvas.width + column) * 4);
  }
  drawImage(image, ...args) {
    let sourceX = 0, sourceY = 0, sourceWidth = image.width, sourceHeight = image.height, left, top, width, height;
    if (args.length === 2) { [left, top] = args; width = sourceWidth; height = sourceHeight; }
    else if (args.length === 4) [left, top, width, height] = args;
    else [sourceX, sourceY, sourceWidth, sourceHeight, left, top, width, height] = args;
    const [startX, startY] = this.point(left, top), [endX, endY] = this.point(left + width, top + height);
    const source = image.pixels, target = this.canvas.pixels;
    for (let row = Math.max(0, Math.ceil(Math.min(startY, endY) - .5)); row < Math.min(this.canvas.height, Math.ceil(Math.max(startY, endY) - .5)); row++) {
      const sampleY = Math.min(image.height - 1, Math.max(0, Math.floor(sourceY + (row + .5 - startY) / (endY - startY) * sourceHeight)));
      for (let column = Math.max(0, Math.ceil(Math.min(startX, endX) - .5)); column < Math.min(this.canvas.width, Math.ceil(Math.max(startX, endX) - .5)); column++) {
        if (this.clipPath && !inside(column + .5, row + .5, this.clipPath)) continue;
        const sampleX = Math.min(image.width - 1, Math.max(0, Math.floor(sourceX + (column + .5 - startX) / (endX - startX) * sourceWidth)));
        const index = (sampleY * image.width + sampleX) * 4, destination = (row * this.canvas.width + column) * 4, alpha = source[index + 3] / 255;
        if (!alpha) continue;
        const combined = alpha + target[destination + 3] / 255 * (1 - alpha);
        for (let channel = 0; channel < 3; channel++) target[destination + channel] = (source[index + channel] * alpha + target[destination + channel] * target[destination + 3] / 255 * (1 - alpha)) / combined;
        target[destination + 3] = combined * 255;
      }
    }
  }
}
export function installOfflineCanvas() {
  globalThis.HTMLCanvasElement = RasterCanvas;
  globalThis.ImageData = class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
  globalThis.Image = globalThis.HTMLImageElement = class {
    async decode() { const decoded = decodePng('public/' + this.src.replace(/^\//, '')); Object.assign(this, decoded, { naturalWidth: decoded.width, naturalHeight: decoded.height }); }
  };
  globalThis.document = { createElement: name => { if (name !== 'canvas') throw Error('Offline canvas only'); return new RasterCanvas(); } };
}
