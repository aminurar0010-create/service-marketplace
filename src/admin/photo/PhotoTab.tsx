import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Download, Printer, Upload, ShoppingCart } from 'lucide-react'
import { canViewTab } from '../../lib/permissions'
import { computeLayout, DPI, hexToRgb, mmToPx, replaceBackground, SHEETS, toMm, Unit } from './photoUtils'

const SKY_BLUE = '#87CEEB'

// AI মডেল (MODNet, Apache-2.0) — একবার লোড হলে ব্রাউজার ক্যাশে থাকে; ছবি কোথাও আপলোড হয় না
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let segmenterPromise: Promise<any> | null = null
let aiReady = false
const PREVIEW_W = 300

/** পাসপোর্ট/আইডি ফটো টুল — ছবি আপলোড/তোলা → ক্রপ → স্কাই ব্লু ব্যাকগ্রাউন্ড → শিটে অনেক কপি → প্রিন্ট। সবই ব্রাউজারে, ছবি সার্ভারে যায় না। */
export default function PhotoTab({ role, onGo }: { role?: string; onGo?: (tab: string) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  // মাপ (ডিফল্ট ১.৫ × ১.৯ ইঞ্চি)
  const [wVal, setWVal] = useState(1.5)
  const [hVal, setHVal] = useState(1.9)
  const [unit, setUnit] = useState<Unit>('in')
  // ক্রপ
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 }) // কপির আকারের ভগ্নাংশ
  // ব্যাকগ্রাউন্ড
  const [bgOn, setBgOn] = useState(true)
  const [bgColor, setBgColor] = useState(SKY_BLUE)
  const [tol, setTol] = useState(45)
  // শিট
  const [sheetId, setSheetId] = useState('a4')
  const [margin, setMargin] = useState(5)
  const [gap, setGap] = useState(2)
  const [fillMax, setFillMax] = useState(true)
  const [copies, setCopies] = useState(8)
  const [cutLines, setCutLines] = useState(true)

  // হাতে ঠিক করার ব্রাশ
  const [mode, setMode] = useState<'move' | 'restore' | 'paint'>('move')
  const [brush, setBrush] = useState(22) // কপির পিক্সেলে ব্যাসার্ধ
  const [ovVer, setOvVer] = useState(0)
  const baseRef = useRef<{ orig: Uint8ClampedArray; rep: Uint8ClampedArray } | null>(null)
  const ovRef = useRef<Uint8Array>(new Uint8Array(0)) // ০ = স্বয়ংক্রিয়, ১ = আসল ছবি, ২ = ব্যাকগ্রাউন্ড রঙ
  const ovKey = useRef('')
  const stroke = useRef<{ x: number; y: number } | null>(null)

  // স্মার্ট (AI) ব্যাকগ্রাউন্ড
  const [aiOn, setAiOn] = useState(true)
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'running' | 'error'>('idle')
  const [aiMsg, setAiMsg] = useState('')
  const [aiVer, setAiVer] = useState(0)
  const [edge, setEdge] = useState(0) // -25 … +25 : কিনারা পাতলা/ঘন
  const matteRef = useRef<{ img: HTMLImageElement; canvas: HTMLCanvasElement } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  imgRef.current = img
  const hasMatte = !!img && matteRef.current?.img === img
  const aiBusy = aiStatus === 'loading' || aiStatus === 'running'

  const photoCanvas = useRef<HTMLCanvasElement>(null)
  const sheetCanvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)

  const pwMm = toMm(wVal, unit), phMm = toMm(hVal, unit)
  const validSize = pwMm >= 10 && phMm >= 10 && pwMm <= 150 && phMm <= 200
  const cw = validSize ? mmToPx(pwMm) : 450
  const ch = validSize ? mmToPx(phMm) : 570

  const sheet = SHEETS.find((s) => s.id === sheetId) || SHEETS[0]
  const layout = useMemo(() => (validSize ? computeLayout(sheet.w, sheet.h, pwMm, phMm, margin, gap) : { cols: 0, rows: 0, rotated: false, count: 0 }), [sheet, pwMm, phMm, margin, gap, validSize])
  const printCount = fillMax ? layout.count : Math.min(Math.max(1, copies), layout.count)

  const coverScale = img ? Math.max(cw / img.naturalWidth, ch / img.naturalHeight) : 1

  const clampOff = useCallback((o: { x: number; y: number }, z: number) => {
    if (!img) return o
    const s = coverScale * z
    const mx = Math.max(0, (img.naturalWidth * s - cw) / 2) / cw
    const my = Math.max(0, (img.naturalHeight * s - ch) / 2) / ch
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) }
  }, [img, coverScale, cw, ch])

  // স্বয়ংক্রিয় ফলাফলের উপর ব্রাশের দাগ বসিয়ে ক্যানভাসে আঁকা
  const compose = useCallback(() => {
    const c = photoCanvas.current, base = baseRef.current
    if (!c || !base) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const n = c.width * c.height
    const ov = ovRef.current
    const bg = hexToRgb(bgColor)
    const out = ctx.createImageData(c.width, c.height)
    for (let p = 0; p < n; p++) {
      const i = p * 4
      const o = ov.length === n ? ov[p] : 0
      if (o === 2) { out.data[i] = bg[0]; out.data[i + 1] = bg[1]; out.data[i + 2] = bg[2] }
      else { const src = o === 1 ? base.orig : base.rep; out.data[i] = src[i]; out.data[i + 1] = src[i + 1]; out.data[i + 2] = src[i + 2] }
      out.data[i + 3] = 255
    }
    ctx.putImageData(out, 0, 0)
  }, [bgColor])

  // একটি ছবি আঁকা (চূড়ান্ত রেজোলিউশনে)
  useEffect(() => {
    const c = photoCanvas.current
    if (!c) return
    c.width = cw; c.height = ch
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, cw, ch)
    if (!img) { baseRef.current = null; return }
    const s = coverScale * zoom
    const o = clampOff(off, zoom)
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s
    const dx = cw / 2 + o.x * cw - dw / 2, dy = ch / 2 + o.y * ch - dh / 2
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, dx, dy, dw, dh)
    // ক্রপ/জুম/ছবি/মাপ বদলালে ব্রাশের দাগ আর মেলে না — মুছে যায়
    const key = `${img.src}|${zoom}|${off.x.toFixed(4)}|${off.y.toFixed(4)}|${cw}|${ch}`
    if (key !== ovKey.current || ovRef.current.length !== cw * ch) { ovRef.current = new Uint8Array(cw * ch); ovKey.current = key }
    const orig = ctx.getImageData(0, 0, cw, ch)
    const rep = new Uint8ClampedArray(orig.data)
    const bg = hexToRgb(bgColor)
    const m = matteRef.current
    if (bgOn) {
      if (aiOn && m && m.img === img) {
        // AI মাস্ক: ছবির মতোই একই জায়গায়/মাপে বসিয়ে অ্যালফা পড়া → অগ্রভাগ ও ব্যাকগ্রাউন্ড মেশানো
        const t = document.createElement('canvas')
        t.width = cw; t.height = ch
        const tctx = t.getContext('2d', { willReadFrequently: true })
        if (tctx) {
          tctx.imageSmoothingQuality = 'high'
          tctx.drawImage(m.canvas, dx, dy, dw, dh)
          const alpha = tctx.getImageData(0, 0, cw, ch).data
          const lo = 0.1 + edge / 100, hi = 0.9 + edge / 100
          for (let p = 0; p < cw * ch; p++) {
            const i = p * 4
            const a = Math.min(1, Math.max(0, (alpha[i + 3] / 255 - lo) / (hi - lo)))
            rep[i] = orig.data[i] * a + bg[0] * (1 - a)
            rep[i + 1] = orig.data[i + 1] * a + bg[1] * (1 - a)
            rep[i + 2] = orig.data[i + 2] * a + bg[2] * (1 - a)
          }
        }
      } else {
        replaceBackground({ data: rep, width: cw, height: ch }, bg, tol)
      }
    }
    baseRef.current = { orig: orig.data, rep }
    compose()
  }, [img, zoom, off, bgOn, bgColor, tol, cw, ch, coverScale, clampOff, compose, aiOn, aiVer, edge])

  // স্মার্ট (AI) ব্যাকগ্রাউন্ড চালানো
  const runAI = async (target: HTMLImageElement) => {
    try {
      setAiStatus('loading'); setAiMsg('AI মডেল লোড হচ্ছে… (প্রথমবার একটু সময় লাগে)')
      if (!segmenterPromise) {
        segmenterPromise = (async () => {
          const { pipeline } = await import('@huggingface/transformers')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return pipeline('background-removal', 'Xenova/modnet', { progress_callback: (p: any) => {
            if (p && p.status === 'progress' && typeof p.progress === 'number') setAiMsg(`AI মডেল নামছে… ${Math.round(p.progress)}%`)
          } })
        })()
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seg: any = await segmenterPromise
      aiReady = true
      setAiStatus('running'); setAiMsg('ছবি বিশ্লেষণ হচ্ছে… (কয়েক সেকেন্ড)')
      const k = Math.min(1, 1024 / Math.max(target.naturalWidth, target.naturalHeight))
      const sw = Math.max(1, Math.round(target.naturalWidth * k)), sh = Math.max(1, Math.round(target.naturalHeight * k))
      const src = document.createElement('canvas')
      src.width = sw; src.height = sh
      src.getContext('2d')?.drawImage(target, 0, 0, sw, sh)
      const blob: Blob = await new Promise((res, rej) => src.toBlob((b) => (b ? res(b) : rej(new Error('ছবি পড়া গেল না'))), 'image/png'))
      const url = URL.createObjectURL(blob)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let out: any
      try { out = await seg(url) } finally { URL.revokeObjectURL(url) }
      const { data, width, height, channels } = out as { data: Uint8ClampedArray; width: number; height: number; channels: number }
      const m = document.createElement('canvas')
      m.width = width; m.height = height
      const mctx = m.getContext('2d')
      if (!mctx) throw new Error('canvas নেই')
      const md = mctx.createImageData(width, height)
      for (let p = 0; p < width * height; p++) md.data[p * 4 + 3] = channels === 4 ? data[p * 4 + 3] : 255
      mctx.putImageData(md, 0, 0)
      if (imgRef.current !== target) { setAiStatus('idle'); setAiMsg(''); return } // ইতিমধ্যে অন্য ছবি বাছা হয়েছে
      matteRef.current = { img: target, canvas: m }
      setAiOn(true); setAiVer((v) => v + 1); setAiStatus('idle'); setAiMsg('')
    } catch (e) {
      segmenterPromise = null
      setAiStatus('error')
      setAiMsg('AI চালানো গেল না — ইন্টারনেট দেখে আবার চেষ্টা করুন। (এর মধ্যে নিচের রঙ-ভিত্তিক পদ্ধতি কাজ করছে।) ' + (e instanceof Error ? e.message : ''))
    }
  }

  // শিট আঁকা
  const drawSheet = useCallback((): HTMLCanvasElement | null => {
    const pc = photoCanvas.current
    if (!pc || !validSize || layout.count === 0) return null
    const c = sheetCanvas.current || document.createElement('canvas')
    const SW = mmToPx(sheet.w), SH = mmToPx(sheet.h)
    c.width = SW; c.height = SH
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, SW, SH)
    const pxW = mmToPx(pwMm), pxH = mmToPx(phMm)
    const bw = layout.rotated ? pxH : pxW
    const bh = layout.rotated ? pxW : pxH
    const gx = mmToPx(gap), mg = mmToPx(margin)
    const totalW = layout.cols * bw + (layout.cols - 1) * gx
    const totalH = layout.rows * bh + (layout.rows - 1) * gx
    const x0 = Math.round((SW - totalW) / 2), y0 = Math.max(mg, Math.round((SH - totalH) / 2))
    let n = 0
    for (let r = 0; r < layout.rows && n < printCount; r++) {
      for (let q = 0; q < layout.cols && n < printCount; q++, n++) {
        const x = x0 + q * (bw + gx), y = y0 + r * (bh + gx)
        if (layout.rotated) {
          ctx.save()
          ctx.translate(x + bw, y)
          ctx.rotate(Math.PI / 2)
          ctx.drawImage(pc, 0, 0)
          ctx.restore()
        } else ctx.drawImage(pc, x, y)
        if (cutLines) { ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1) }
      }
    }
    return c
  }, [validSize, layout, sheet, pwMm, phMm, gap, margin, printCount, cutLines])

  useEffect(() => { drawSheet() }, [drawSheet, img, zoom, off, bgOn, bgColor, tol, ovVer])

  const onFile = (f: File | null | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return alert('শুধু ছবি ফাইল দিন (JPG/PNG)')
    if (f.size > 25 * 1024 * 1024) return alert('ছবিটা অনেক বড় (২৫ MB-এর বেশি)')
    const url = URL.createObjectURL(f)
    const im = new Image()
    im.onload = () => { setImg(im); setFileName(f.name); setZoom(1); setOff({ x: 0, y: 0.05 }); if (aiReady) void runAI(im) }
    im.onerror = () => { URL.revokeObjectURL(url); alert('ছবিটা খোলা গেল না') }
    im.src = url
  }

  const toCanvasXY = (e: React.PointerEvent) => {
    const rect = (photoCanvas.current as HTMLCanvasElement).getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * cw, y: ((e.clientY - rect.top) / rect.height) * ch }
  }
  const stamp = (cx: number, cy: number) => {
    const val = mode === 'restore' ? 1 : 2
    const r = brush, ov = ovRef.current
    if (ov.length !== cw * ch) return
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(cw - 1, Math.ceil(cx + r))
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(ch - 1, Math.ceil(cy + r))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) ov[y * cw + x] = val
    }
  }
  const onDown = (e: React.PointerEvent) => {
    if (!img) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    if (mode === 'move') { drag.current = { x: e.clientX, y: e.clientY }; return }
    const p = toCanvasXY(e)
    stroke.current = p
    stamp(p.x, p.y)
    compose()
  }
  const onMove = (e: React.PointerEvent) => {
    if (mode !== 'move') {
      const last = stroke.current
      if (!last) return
      const p = toCanvasXY(e)
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, brush / 3)))
      for (let i = 1; i <= steps; i++) stamp(last.x + ((p.x - last.x) * i) / steps, last.y + ((p.y - last.y) * i) / steps)
      stroke.current = p
      compose()
      return
    }
    if (!drag.current || !photoCanvas.current) return
    const rect = photoCanvas.current.getBoundingClientRect()
    const dx = (e.clientX - drag.current.x) / rect.width, dy = (e.clientY - drag.current.y) / rect.height
    drag.current = { x: e.clientX, y: e.clientY }
    setOff((o) => clampOff({ x: o.x + dx, y: o.y + dy }, zoom))
  }
  const onUp = () => {
    drag.current = null
    if (stroke.current) { stroke.current = null; setOvVer((v) => v + 1) } // শিটের প্রিভিউ নতুন করে আঁকতে
  }
  const resetBrush = () => { ovRef.current = new Uint8Array(cw * ch); compose(); setOvVer((v) => v + 1) }

  // ব্রাশের মাপের গোল কার্সার
  const cursorCss = useMemo(() => {
    if (mode === 'move') return 'grab'
    const d = Math.min(120, Math.max(10, Math.round(brush * 2 * (PREVIEW_W / cw))))
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 1}" fill="none" stroke="black" stroke-width="2"/><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 2.5}" fill="none" stroke="white" stroke-width="1.5"/></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${d / 2} ${d / 2}, crosshair`
  }, [mode, brush, cw])

  const download = (which: 'photo' | 'sheet') => {
    const c = which === 'photo' ? photoCanvas.current : drawSheet()
    if (!c) return
    const a = document.createElement('a')
    a.href = c.toDataURL('image/jpeg', 0.95)
    a.download = which === 'photo' ? 'photo.jpg' : `photo-sheet-${sheet.id}.jpg`
    a.click()
  }

  const print = () => {
    const c = drawSheet()
    if (!c) return alert('শিটে একটাও কপি বসছে না — মাপ বা মার্জিন ঠিক করুন')
    const w = window.open('', '_blank')
    if (!w) return alert('পপ-আপ বন্ধ আছে — ব্রাউজারে এই সাইটের পপ-আপ অনুমতি দিন')
    const src = c.toDataURL('image/jpeg', 0.95)
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ফটো শিট</title><style>@page{size:${sheet.w.toFixed(1)}mm ${sheet.h.toFixed(1)}mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:${sheet.w.toFixed(1)}mm;height:${sheet.h.toFixed(1)}mm}</style></head><body><img src="${src}" onload="setTimeout(function(){window.print()},300)"></body></html>`)
    w.document.close()
  }

  const canPos = onGo && canViewTab(role, 'pos')
  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Camera className="w-6 h-6" /> পাসপোর্ট/আইডি ফটো</h2>
        <p className="text-sm text-gray-600 mt-1">ছবি এই ডিভাইসের ব্রাউজারেই প্রসেস হয় — কোথাও আপলোড হয় না।</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* বাঁ: ছবি ও ক্রপ */}
        <div className="bg-white rounded-xl shadow p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-indigo-700">
              <Upload className="w-4 h-4" /> ছবি বাছুন
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-50">
              <Camera className="w-4 h-4" /> ক্যামেরা (ফোনে)
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
          {fileName && <p className="text-xs text-gray-500 truncate">{fileName}</p>}

          <div className="flex flex-col items-center gap-3">
            <canvas ref={photoCanvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              style={{ width: PREVIEW_W, maxWidth: '100%', aspectRatio: `${cw} / ${ch}`, touchAction: 'none', cursor: img ? cursorCss : 'default' }}
              className="border-2 border-dashed border-gray-300 rounded bg-gray-50" />
            <p className="text-xs text-gray-500">{!img ? 'আগে একটা ছবি বাছুন' : mode === 'move' ? 'ছবির উপর আঙুল/মাউস টেনে মুখ ঠিক জায়গায় আনুন' : mode === 'restore' ? 'যেখানে ভুলে নীল হয়েছে সেখানে ঘষুন — আসল ছবি ফিরবে' : 'যেখানে দেয়াল রয়ে গেছে সেখানে ঘষুন — নীল হবে'}</p>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-gray-700">জুম ({zoom.toFixed(2)}×)</span>
            <input type="range" min={1} max={4} step={0.01} value={zoom} disabled={!img}
              onChange={(e) => { const z = Number(e.target.value); setZoom(z); setOff((o) => clampOff(o, z)) }} className="w-full" />
          </label>

          <div className="border-t pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <input type="checkbox" checked={bgOn} onChange={(e) => setBgOn(e.target.checked)} /> ব্যাকগ্রাউন্ড বদলান
            </label>
            <div className="rounded-lg border-2 border-indigo-200 bg-indigo-50 p-3 space-y-2">
              <button type="button" disabled={!img || aiBusy} onClick={() => img && void runAI(img)}
                className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                {aiBusy ? '⏳ ' + (aiMsg || 'চলছে…') : hasMatte ? '✨ স্মার্ট AI আবার চালান' : '✨ স্মার্ট ব্যাকগ্রাউন্ড (AI) — ১ ক্লিকে'}
              </button>
              {aiStatus === 'error' && <p className="text-xs text-red-600">{aiMsg}</p>}
              {hasMatte && (
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={aiOn} onChange={(e) => setAiOn(e.target.checked)} /> AI ফলাফল ব্যবহার করুন</label>
                  {aiOn && (
                    <label className="block text-sm"><span className="text-gray-700">কিনারা ({edge > 0 ? 'ভেতরে ঢোকানো' : edge < 0 ? 'বাইরে ছড়ানো' : 'স্বাভাবিক'})</span>
                      <input type="range" min={-25} max={25} step={1} value={edge} onChange={(e) => setEdge(Number(e.target.value))} className="w-full" />
                    </label>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-600">ছবি এই ডিভাইসেই প্রসেস হয়, কোথাও যায় না। প্রথমবার AI মডেল (~২৫ MB) ইন্টারনেট থেকে নামে, তারপর ব্রাউজারে জমা থাকে; পরের ছবিতে নিজে থেকেই চলবে। পুরনো ফোনে ৫–১৫ সেকেন্ড লাগতে পারে।</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm"><span className="text-gray-700">ব্যাকগ্রাউন্ড রঙ</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 border rounded" />
                  <button type="button" onClick={() => setBgColor(SKY_BLUE)} className="text-xs px-2 py-1 rounded border text-gray-700 hover:bg-gray-50">স্কাই ব্লু</button>
                  <button type="button" onClick={() => setBgColor('#FFFFFF')} className="text-xs px-2 py-1 rounded border text-gray-700 hover:bg-gray-50">সাদা</button>
                </div>
              </label>
              <label className="text-sm"><span className="text-gray-700">রঙ-ভিত্তিক সংবেদনশীলতা ({tol}){bgOn && aiOn && hasMatte ? ' — AI চালু, লাগে না' : ''}</span>
                <input type="range" min={10} max={160} step={1} value={tol} disabled={!bgOn || (aiOn && hasMatte)} onChange={(e) => setTol(Number(e.target.value))} className="w-full mt-2" />
              </label>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">সাদা/হালকা সমান ব্যাকগ্রাউন্ডের ছবিতে ভালো কাজ করে। চুলের কিনারা বা ছায়ায় অসমান হতে পারে — প্রিন্টের আগে প্রিভিউ দেখুন; ঠিক না হলে সংবেদনশীলতা কমান/বাড়ান।</p>
            <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <p className="text-sm font-semibold text-gray-800">হাতে ঠিক করুন (ব্রাশ)</p>
              <div className="flex flex-wrap gap-2">
                {([['move', 'ছবি সরান'], ['restore', 'আসল ফিরান'], ['paint', 'নীল করুন']] as const).map(([id, label]) => (
                  <button key={id} type="button" disabled={!img} onClick={() => setMode(id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border disabled:opacity-40 ${mode === id ? (id === 'restore' ? 'bg-emerald-600 text-white border-emerald-600' : id === 'paint' ? 'bg-sky-600 text-white border-sky-600' : 'bg-indigo-600 text-white border-indigo-600') : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>{label}</button>
                ))}
                <button type="button" disabled={!img} onClick={resetBrush} className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40">ব্রাশের কাজ মুছুন</button>
              </div>
              <label className="block text-sm"><span className="text-gray-700">ব্রাশের মাপ ({brush})</span>
                <input type="range" min={4} max={80} step={1} value={brush} disabled={mode === 'move'} onChange={(e) => setBrush(Number(e.target.value))} className="w-full" />
              </label>
              <p className="text-xs text-gray-500">আগে জুম/সরানো ঠিক করুন, তারপর ব্রাশ ধরুন — জুম বা ছবি সরালে ব্রাশের কাজ মুছে যায়। ছোট জায়গায় কাজ করতে ব্রাশ ছোট করুন।</p>
            </div>
          </div>
        </div>

        {/* ডান: মাপ ও শিট */}
        <div className="bg-white rounded-xl shadow p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">ছবির মাপ</h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-sm"><span className="text-gray-600">প্রস্থ</span><input type="number" step="0.01" min="0" value={wVal} onChange={(e) => setWVal(Number(e.target.value))} className={input} /></label>
              <label className="text-sm"><span className="text-gray-600">উচ্চতা</span><input type="number" step="0.01" min="0" value={hVal} onChange={(e) => setHVal(Number(e.target.value))} className={input} /></label>
              <label className="text-sm"><span className="text-gray-600">একক</span>
                <select value={unit} onChange={(e) => {
                  const u = e.target.value as Unit
                  if (u !== unit) { const f = u === 'mm' ? 25.4 : 1 / 25.4; setWVal(Number((wVal * f).toFixed(2))); setHVal(Number((hVal * f).toFixed(2))); setUnit(u) }
                }} className={input}><option value="in">ইঞ্চি</option><option value="mm">মিমি</option></select>
              </label>
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => { setUnit('in'); setWVal(1.5); setHVal(1.9) }} className="text-xs px-3 py-1 rounded border text-gray-700 hover:bg-gray-50">১.৫ × ১.৯ ইঞ্চি (ডিফল্ট)</button>
            </div>
            <p className="text-xs text-gray-500 mt-1">= {pwMm.toFixed(1)} × {phMm.toFixed(1)} মিমি · {cw}×{ch} পিক্সেল ({DPI} DPI){!validSize && <span className="text-red-600"> — মাপ ১০–১৫০ × ১০–২০০ মিমির মধ্যে দিন</span>}</p>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-gray-900">প্রিন্ট শিট</h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-sm col-span-3 sm:col-span-1"><span className="text-gray-600">কাগজ</span>
                <select value={sheetId} onChange={(e) => setSheetId(e.target.value)} className={input}>{SHEETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              </label>
              <label className="text-sm"><span className="text-gray-600">মার্জিন (মিমি)</span><input type="number" min="0" max="30" step="0.5" value={margin} onChange={(e) => setMargin(Math.max(0, Number(e.target.value)))} className={input} /></label>
              <label className="text-sm"><span className="text-gray-600">ফাঁক (মিমি)</span><input type="number" min="0" max="20" step="0.5" value={gap} onChange={(e) => setGap(Math.max(0, Number(e.target.value)))} className={input} /></label>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={fillMax} onChange={(e) => setFillMax(e.target.checked)} /> শিট ভরে বসান</label>
              {!fillMax && <label className="flex items-center gap-2">কপি <input type="number" min={1} max={Math.max(1, layout.count)} value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="w-20 px-2 py-1 border rounded" /></label>}
              <label className="flex items-center gap-2"><input type="checkbox" checked={cutLines} onChange={(e) => setCutLines(e.target.checked)} /> কাটার হালকা দাগ</label>
            </div>
            <p className="text-sm text-gray-700">এই শিটে সর্বোচ্চ <b>{layout.count}</b> কপি ধরে{layout.rotated ? ' (ছবি ঘুরিয়ে)' : ''} — ছাপা হবে <b>{printCount}</b>টি।</p>
            <div className="flex justify-center bg-gray-100 rounded p-3">
              <canvas ref={sheetCanvas} style={{ width: 220, maxWidth: '100%', aspectRatio: `${sheet.w} / ${sheet.h}` }} className="bg-white shadow" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={print} disabled={!img || layout.count === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-40"><Printer className="w-4 h-4" /> শিট প্রিন্ট</button>
              <button onClick={() => download('sheet')} disabled={!img || layout.count === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-40"><Download className="w-4 h-4" /> শিট JPG</button>
              <button onClick={() => download('photo')} disabled={!img} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-40"><Download className="w-4 h-4" /> একটা ছবি JPG</button>
              {canPos && <button onClick={() => onGo?.('pos')} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100"><ShoppingCart className="w-4 h-4" /> POS-এ বিক্রি করুন</button>}
            </div>
            <p className="text-xs text-gray-500">প্রিন্ট ডায়ালগে "Actual size / 100%" রাখুন, "Fit to page" বন্ধ রাখুন — নইলে মাপ বদলে যাবে।</p>
          </div>
        </div>
      </div>
    </div>
  )
}
