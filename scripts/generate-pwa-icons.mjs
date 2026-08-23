import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, bgColor = [37, 99, 235]) {
  // Simple uncompressed/deflated raw RGBA PNG writer
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10); // Deflate compression
  ihdrData.writeUInt8(0, 11); // Filter method
  ihdrData.writeUInt8(0, 12); // Interlace method

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    // CRC calculation
    let c = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(c >>> 0, 8 + len);
    return buf;
  }

  // CRC32 table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const ihdr = makeChunk('IHDR', ihdrData);

  // Raw image scanlines with filter byte 0
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Draw rounded rect background
      const rx = width * 0.22;
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      let isInside = true;

      if (dx < rx && dy < rx) {
        const dist = Math.hypot(rx - dx, rx - dy);
        if (dist > rx) {
          isInside = false;
        }
      }

      if (!isInside) {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // Draw stylized 'R' in the center
      const nx = x / width;
      const ny = y / height;

      let isWhiteLetter = false;

      // Left vertical stem: nx between 0.28 and 0.40, ny between 0.25 and 0.75
      if (nx >= 0.28 && nx <= 0.38 && ny >= 0.25 && ny <= 0.75) {
        isWhiteLetter = true;
      }
      // Top horizontal bar: nx between 0.28 and 0.65, ny between 0.25 and 0.35
      else if (nx >= 0.28 && nx <= 0.65 && ny >= 0.25 && ny <= 0.35) {
        isWhiteLetter = true;
      }
      // Middle horizontal bar: nx between 0.28 and 0.65, ny between 0.45 and 0.55
      else if (nx >= 0.28 && nx <= 0.65 && ny >= 0.45 && ny <= 0.55) {
        isWhiteLetter = true;
      }
      // Top-right vertical loop bar: nx between 0.58 and 0.68, ny between 0.25 and 0.55
      else if (nx >= 0.58 && nx <= 0.68 && ny >= 0.25 && ny <= 0.55) {
        isWhiteLetter = true;
      }
      // Diagonal leg: nx between 0.45 and 0.72, ny between 0.50 and 0.75
      else if (ny >= 0.50 && ny <= 0.75) {
        const expectedNx = 0.38 + (ny - 0.50) * 1.3;
        if (nx >= expectedNx - 0.06 && nx <= expectedNx + 0.06 && nx <= 0.72) {
          isWhiteLetter = true;
        }
      }

      if (isWhiteLetter) {
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 255;
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = bgColor[0];
        rawData[pxOffset + 1] = bgColor[1];
        rawData[pxOffset + 2] = bgColor[2];
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressedData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const publicDir = path.resolve(process.cwd(), 'public');
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPng(192, 192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPng(512, 512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180));
console.log('✅ Generated icon-192.png, icon-512.png, and apple-touch-icon.png in public/');
