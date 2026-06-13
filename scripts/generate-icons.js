
const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  CRC_TABLE[i] = c
}
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcBuf])
}

function solidPNG(size, r, g, b) {
  
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2 

  const row = size * 3 + 1
  const raw = Buffer.alloc(size * row)
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0
    for (let x = 0; x < size; x++) {
      const i = y * row + 1 + x * 3
      raw[i] = r; raw[i+1] = g; raw[i+2] = b
    }
  }

  const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function iconPNG(size) {
  
  const BG = [22, 163, 74]
  const FG = [255, 255, 255]

  const row = size * 3 + 1
  const raw = Buffer.alloc(size * row)

  const margin = Math.floor(size * 0.25)
  const thick  = Math.max(2, Math.floor(size * 0.12))

  for (let y = 0; y < size; y++) {
    raw[y * row] = 0
    for (let x = 0; x < size; x++) {
      const i = y * row + 1 + x * 3

      const isVbar = x >= margin && x < margin + thick && y >= margin && y < size - margin
      const isHbar = y >= size - margin - thick && y < size - margin && x >= margin && x < size - margin

      const [r, g, b] = (isVbar || isHbar) ? FG : BG
      raw[i] = r; raw[i+1] = g; raw[i+2] = b
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2

  const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const dir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(dir, { recursive: true })

for (const size of [192, 512]) {
  const file = path.join(dir, `icon-${size}.png`)
  fs.writeFileSync(file, iconPNG(size))
  console.log(`✓ icon-${size}.png (${fs.statSync(file).size} bytes)`)
}
