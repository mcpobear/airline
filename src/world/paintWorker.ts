/**
 * Paints the world off the main thread. At full size this is eight million
 * pixels and a few seconds of array maths; done inline it would freeze the
 * page before the globe ever appeared.
 *
 * The finished bytes are transferred rather than copied, so handing them back
 * costs nothing.
 */
import { GLOBE_STYLES } from './palettes'
import { paintWorld } from './worldTexture'

export interface PaintRequest {
  styleId: string
  width: number
  height: number
}

export interface PaintResponse {
  styleId: string
  width: number
  height: number
  pixels: ArrayBuffer
}

self.onmessage = (event: MessageEvent<PaintRequest>) => {
  const { styleId, width, height } = event.data
  const style = GLOBE_STYLES.find((s) => s.id === styleId) ?? GLOBE_STYLES[0]
  const pixels = paintWorld(style.palette, width, height)
  const message: PaintResponse = { styleId, width, height, pixels: pixels.buffer }
  ;(self as unknown as Worker).postMessage(message, [pixels.buffer])
}
