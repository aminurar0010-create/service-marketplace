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
 * ব্যাকগ্রাউন্ড বদল: কিনারা থেকে "বন্যা-ভরাট" (flood fill)। শুধু কিনারার সাথে যুক্ত অংশ বদলায়, তাই মুখের
 * ভেতরের সাদা জামা/শার্ট অক্ষত থাকে।
 * - রেফারেন্স রঙ একটা নয়, কয়েকটা: উপরের তিন জায়গা + বাঁ/ডান কিনারার উপরের অর্ধেক (+ নিচের দুই কোনা, যদি দেয়ালের মতো
 *   ফিকে রঙ হয়) — তাই আলো-ছায়ার গ্রেডিয়েন্ট (বাঁয়ে হালকা, ডানে ধূসর) ধরা পড়ে।
 * - পিক্সেল বদলায় যদি (ক) কোনো রেফারেন্সের tol-এর মধ্যে, অথবা (খ) পাশের (যেখান থেকে ভরাট এসেছে) পিক্সেলের
 *   প্রায় একই রঙ এবং রেফারেন্স থেকে ২.২×tol-এর মধ্যে — এভাবে ধীরে বদলানো ছায়া অনুসরণ করা যায়, কিন্তু মুখ/জামার
 *   হঠাৎ-বদলানো কিনারা পেরোয় না।
 * tol = রঙের দূরত্বের সীমা। ছবির কিনারার ১ পিক্সেল নরম করা হয়। ডাটা জায়গায় বদলায়; কতটা পিক্সেল বদলাল তা ফেরত দেয়।
 */
export function replaceBackground(img: { data: Uint8ClampedArray; width: number; height: number }, bg: [number, number, number], tol: number): number {
  const { data, width: W, height: H } = img
  if (W < 8 || H < 8) return 0
  const patch = Math.max(2, Math.floor(Math.min(W, H) * 0.03))
  const sample = (cx: number, cy: number): [number, number, number] => {
    const x0 = Math.min(W - patch, Math.max(0, cx)), y0 = Math.min(H - patch, Math.max(0, cy))
    let r = 0, g = 0, b = 0, n = 0
    for (let y = y0; y < y0 + patch; y++) for (let x = x0; x < x0 + patch; x++) {
      const i = (y * W + x) * 4
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
    }
    return [r / n, g / n, b / n]
  }
  const sat = (c: number[]) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])
  const refs: [number, number, number][] = [
    sample(0, 0), sample((W - patch) >> 1, 0), sample(W - patch, 0),
    sample(0, Math.floor(H * 0.25)), sample(W - patch, Math.floor(H * 0.25)),
    sample(0, Math.floor(H * 0.5)), sample(W - patch, Math.floor(H * 0.5)),
  ]
  const maxSat = Math.max(...refs.map(sat))
  for (const c of [sample(0, H - patch), sample(W - patch, H - patch)]) {
    if (sat(c) <= maxSat + 40) refs.push(c) // নিচের কোনায় জামা থাকলে (গাঢ় রঙ) সেটা রেফারেন্স হবে না
  }
  const tol2 = tol * tol
  const far2 = (tol * 2.2) * (tol * 2.2)
  const stepTol = 14 + tol * 0.2
  const step2 = stepTol * stepTol
  const refDist2 = (i: number) => {
    let best = Infinity
    for (const c of refs) {
      const dr = data[i] - c[0], dg = data[i + 1] - c[1], db = data[i + 2] - c[2]
      const d = dr * dr + dg * dg + db * db
      if (d < best) best = d
    }
    return best
  }
  const mask = new Uint8Array(W * H)
  const stack: number[] = []
  const tryAdd = (p: number, from: number) => {
    if (mask[p]) return
    const i = p * 4
    const rd = refDist2(i)
    let ok = rd <= tol2
    if (!ok && from >= 0 && rd <= far2) {
      const j = from * 4
      const dr = data[i] - data[j], dg = data[i + 1] - data[j + 1], db = data[i + 2] - data[j + 2]
      ok = dr * dr + dg * dg + db * db <= step2
    }
    if (!ok) return
    mask[p] = 1
    stack.push(p)
  }
  for (let x = 0; x < W; x++) { tryAdd(x, -1); tryAdd((H - 1) * W + x, -1) }
  for (let y = 0; y < H; y++) { tryAdd(y * W, -1); tryAdd(y * W + W - 1, -1) }
  while (stack.length) {
    const p = stack.pop() as number
    const x = p % W, y = (p / W) | 0
    if (x > 0) tryAdd(p - 1, p)
    if (x < W - 1) tryAdd(p + 1, p)
    if (y > 0) tryAdd(p - W, p)
    if (y < H - 1) tryAdd(p + W, p)
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
