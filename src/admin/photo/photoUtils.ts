/** ফেজ L — পাসপোর্ট/আইডি ফটো টুলের হিসাব (ব্রাউজারেই চলে, ছবি কোথাও যায় না) */

export const DPI = 300
export const MM_PER_INCH = 25.4
export const mmToPx = (mm: number, dpi = DPI) => Math.round((mm / MM_PER_INCH) * dpi)

export type Unit = 'in' | 'mm'
export const toMm = (v: number, unit: Unit) => (unit === 'in' ? v * MM_PER_INCH : v)

export interface SheetPreset { id: string; label: string; w: number; h: number } // মিমি
export const SHEETS: SheetPreset[] = [
  { id: 'a4', label: 'A4 (২১০×২৯৭ মিমি)', w: 210, h: 297 },
  { id: '4x6', label: '৪×৬ ইঞ্চি', w: 4 * MM_PER_INCH, h: 6 * MM_PER_INCH },
  { id: '5x7', label: '৫×৭ ইঞ্চি', w: 5 * MM_PER_INCH, h: 7 * MM_PER_INCH },
]

export interface Layout { cols: number; rows: number; rotated: boolean; count: number }

const fit = (avail: number, size: number, gap: number) =>
  size <= 0 || avail < size ? 0 : Math.floor((avail + gap) / (size + gap) + 1e-9)

/** শিটে সবচেয়ে বেশি কপি কোন দিকে বসে — সোজা নাকি ৯০° ঘুরিয়ে — তা বের করে। সব মাপ মিমিতে। */
export function computeLayout(sheetW: number, sheetH: number, pw: number, ph: number, margin: number, gap: number): Layout {
  const aw = sheetW - 2 * margin
  const ah = sheetH - 2 * margin
  const a = { cols: fit(aw, pw, gap), rows: fit(ah, ph, gap), rotated: false, count: 0 }
  a.count = a.cols * a.rows
  const b = { cols: fit(aw, ph, gap), rows: fit(ah, pw, gap), rotated: true, count: 0 }
  b.count = b.cols * b.rows
  return b.count > a.count ? b : a
}

/** "#RRGGBB" → [r,g,b] */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [135, 206, 235]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * ব্যাকগ্রাউন্ড বদল: চার কোনার গড় রঙ ধরে কিনারা থেকে "বন্যা-ভরাট" (flood fill) — শুধু কিনারার সাথে
 * যুক্ত, ওই রঙের কাছাকাছি অংশ বদলায়। তাই সাদা জামা/শার্ট (মুখের ভেতরে) অক্ষত থাকে।
 * tol = রঙের দূরত্বের সীমা (০–২৫০)। ছবির কিনারার ১ পিক্সেল নরম করা হয়।
 * ডাটা জায়গায় বদলায়; কতটা পিক্সেল বদলাল তা ফেরত দেয়।
 */
export function replaceBackground(img: { data: Uint8ClampedArray; width: number; height: number }, bg: [number, number, number], tol: number): number {
  const { data, width: W, height: H } = img
  if (W < 8 || H < 8) return 0
  const patch = Math.max(2, Math.floor(Math.min(W, H) * 0.03))
  let sr = 0, sg = 0, sb = 0, n = 0
  const corners: [number, number][] = [[0, 0], [W - patch, 0], [0, H - patch], [W - patch, H - patch]]
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + patch; y++) for (let x = cx; x < cx + patch; x++) {
      const i = (y * W + x) * 4
      sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++
    }
  }
  const ref = [sr / n, sg / n, sb / n]
  const tol2 = tol * tol
  const close = (i: number) => {
    const dr = data[i] - ref[0], dg = data[i + 1] - ref[1], db = data[i + 2] - ref[2]
    return dr * dr + dg * dg + db * db <= tol2
  }
  const mask = new Uint8Array(W * H)
  const stack: number[] = []
  const push = (x: number, y: number) => {
    const p = y * W + x
    if (mask[p] || !close(p * 4)) return
    mask[p] = 1
    stack.push(p)
  }
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1) }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y) }
  while (stack.length) {
    const p = stack.pop() as number
    const x = p % W, y = (p / W) | 0
    if (x > 0) push(x - 1, y)
    if (x < W - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < H - 1) push(x, y + 1)
  }
  let changed = 0
  const edge: number[] = []
  for (let p = 0; p < mask.length; p++) {
    if (mask[p]) {
      const i = p * 4
      data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = 255
      changed++
    } else {
      const x = p % W, y = (p / W) | 0
      if ((x > 0 && mask[p - 1]) || (x < W - 1 && mask[p + 1]) || (y > 0 && mask[p - W]) || (y < H - 1 && mask[p + W])) edge.push(p)
    }
  }
  for (const p of edge) {
    const i = p * 4
    data[i] = (data[i] + bg[0]) >> 1; data[i + 1] = (data[i + 1] + bg[1]) >> 1; data[i + 2] = (data[i + 2] + bg[2]) >> 1
  }
  return changed
}
