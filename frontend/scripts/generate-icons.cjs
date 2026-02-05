const fs = require('fs');
const path = require('path');

// Simple PNG generator for solid color icons
// PNG format: signature + IHDR + IDAT + IEND

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = createIHDRChunk(width, height);

  // IDAT chunk (image data)
  const idat = createIDATChunk(width, height, r, g, b);

  // IEND chunk
  const iend = createIENDChunk();

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createIHDRChunk(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(8, 8);  // bit depth
  data.writeUInt8(2, 9);  // color type (RGB)
  data.writeUInt8(0, 10); // compression
  data.writeUInt8(0, 11); // filter
  data.writeUInt8(0, 12); // interlace

  return createChunk('IHDR', data);
}

function createIDATChunk(width, height, r, g, b) {
  const zlib = require('zlib');

  // Create raw image data (filter byte + RGB for each pixel)
  const rowSize = 1 + width * 3; // filter byte + RGB
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // No filter

    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      raw[pixelStart] = r;
      raw[pixelStart + 1] = g;
      raw[pixelStart + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(raw);
  return createChunk('IDAT', compressed);
}

function createIENDChunk() {
  return createChunk('IEND', Buffer.alloc(0));
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return crc ^ 0xFFFFFFFF;
}

function makeCRCTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

// Generate icons with theme color #10b981 (RGB: 16, 185, 129)
const publicDir = path.join(__dirname, '..', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate 192x192 icon
const png192 = createPNG(192, 192, 16, 185, 129);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
console.log('Created pwa-192x192.png');

// Generate 512x512 icon
const png512 = createPNG(512, 512, 16, 185, 129);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
console.log('Created pwa-512x512.png');

// Generate apple-touch-icon (180x180)
const png180 = createPNG(180, 180, 16, 185, 129);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);
console.log('Created apple-touch-icon.png');

console.log('All PWA icons generated successfully!');
