const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 256];

function paint(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const margin = Math.max(1, Math.round(size * 0.2));
  const barWidth = Math.max(1, Math.round(size * 0.12));
  const gap = Math.max(1, Math.round(size * 0.07));
  const heights = [0.42, 0.74, 0.56];
  const chartHeight = size - margin * 2;
  const totalWidth = barWidth * 3 + gap * 2;
  const startX = Math.round((size - totalWidth) / 2);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      pixels[offset] = 0x3c;
      pixels[offset + 1] = 0x4a;
      pixels[offset + 2] = 0x0c;
      pixels[offset + 3] = 0xff;
    }
  }
  heights.forEach((height, index) => {
    const barHeight = Math.max(1, Math.round(chartHeight * height));
    const x0 = startX + index * (barWidth + gap);
    const y0 = size - margin - barHeight;
    for (let y = y0; y < size - margin; y += 1) {
      for (let x = x0; x < x0 + barWidth; x += 1) {
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const offset = (y * size + x) * 4;
        pixels[offset] = 0xf4;
        pixels[offset + 1] = 0xf7;
        pixels[offset + 2] = 0xf5;
        pixels[offset + 3] = 0xff;
      }
    }
  });
  return pixels;
}

function bmpPayload(size, pixels) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const maskRow = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskRow * size);
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const sourceY = size - 1 - y;
    for (let x = 0; x < size; x += 1) {
      const from = (sourceY * size + x) * 4;
      const to = (y * size + x) * 4;
      xor[to] = pixels[from];
      xor[to + 1] = pixels[from + 1];
      xor[to + 2] = pixels[from + 2];
      xor[to + 3] = pixels[from + 3];
    }
  }
  return Buffer.concat([header, xor, mask]);
}

function makeIco() {
  const images = sizes.map((size) => bmpPayload(size, paint(size)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(16 * images.length);
  let offset = 6 + entries.length;
  images.forEach((image, index) => {
    const size = sizes[index];
    const at = index * 16;
    entries[at] = size === 256 ? 0 : size;
    entries[at + 1] = size === 256 ? 0 : size;
    entries.writeUInt16LE(1, at + 4);
    entries.writeUInt16LE(32, at + 6);
    entries.writeUInt32LE(image.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += image.length;
  });
  return Buffer.concat([header, entries, ...images]);
}

const directory = path.join(__dirname, '..', 'build');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'icon.ico'), makeIco());
