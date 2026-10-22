const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const sizes = [16, 24, 32, 48, 64, 128, 256];
const sourcePath = path.join(__dirname, '..', 'assets', 'smiling-orange-pocket-coin-mark.png');
const outputPath = path.join(__dirname, '..', 'build', 'icon.ico');

function makeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(16 * images.length);
  let offset = 6 + entries.length;
  const parts = [header, entries];
  images.forEach((image, index) => {
    const at = index * 16;
    const stored = image.size >= 256 ? 0 : image.size;
    entries[at] = stored;
    entries[at + 1] = stored;
    entries.writeUInt16LE(1, at + 4);
    entries.writeUInt16LE(32, at + 6);
    entries.writeUInt32LE(image.png.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += image.png.length;
    parts.push(image.png);
  });
  return Buffer.concat(parts);
}

app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const source = nativeImage.createFromPath(sourcePath);
  if (source.isEmpty()) {
    console.error(`Could not read the icon source at ${sourcePath}`);
    app.exit(1);
    return;
  }
  const { width, height } = source.getSize();
  if (width !== height) {
    console.error('The icon source must stay square so the mark is not stretched.');
    app.exit(1);
    return;
  }
  const images = sizes.map((size) => {
    const png = source.resize({ width: size, height: size, quality: 'best' }).toPNG();
    if (png.length < 8 || png[0] !== 0x89) {
      throw new Error(`The ${size} pixel icon was not a PNG.`);
    }
    return { size, png };
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, makeIco(images));
  app.exit(0);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
