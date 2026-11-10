import { it } from 'vitest'
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { paintWorld } from '../world/worldTexture'
import { GLOBE_STYLES } from '../world/palettes'

function png(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1)
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crcTable = (png as any).t ??= Array.from({ length: 256 }, (_, n) => {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      return c >>> 0
    })
    let c = 0xffffffff
    for (const b of body) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    const crc = Buffer.alloc(4); crc.writeUInt32BE((c ^ 0xffffffff) >>> 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

// Opt-in: PREVIEW_OUT=/path/to.png npx vitest run src/world/__preview
it.skipIf(!process.env.PREVIEW_OUT)('writes a preview of the map imagery', () => {
  const w = 1600, h = 800
  writeFileSync(process.env.PREVIEW_OUT!, png(w, h, paintWorld(GLOBE_STYLES[0].palette, w, h)))
}, 60_000)
