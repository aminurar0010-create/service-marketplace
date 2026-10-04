import { useMemo, useState } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { supabase, ShopCustomer, Service, InventoryItem } from '../../lib/supabase'
import { askAI, AiDraft } from '../../lib/aiClient'
import { CartLine, PAY_METHODS, PayMethod } from './posTypes'
import { CatalogEntry, DraftLine, bestMatches, buildLines } from './draftMatch'

export interface DraftApply {
  lines: CartLine[]
  customer: ShopCustomer | null
  payments: { method: PayMethod; amount: number }[]
}

const taka = (n: number) => '৳' + Number(n || 0).toLocaleString('bn-BD', { maximumFractionDigits: 2 })

/**
 * কাউন্টারে AI খসড়া-সহকারী: স্টাফ লেখে "রহিমের ৫০টা ভিজিটিং কার্ড ২০০ টাকা ১০০ জমা বিকাশে"।
 * AI শুধু লেখাটা ভাগ করে; কাস্টমার/আইটেম মেলায় আমাদের কোড। কার্টে বসানোর পরও "বিক্রি সম্পন্ন" চাপে স্টাফ নিজে।
 */
export default function AiDraftBox({ services, inventory, onApply }: { services: Service[]; inventory: InventoryItem[]; onApply: (d: DraftApply) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lines, setLines] = useState<DraftLine[] | null>(null)
  const [cands, setCands] = useState<ShopCustomer[]>([])
  const [customer, setCustomer] = useState<ShopCustomer | null>(null)
  const [nameHint, setNameHint] = useState<string | null>(null)
  const [paid, setPaid] = useState('')
  const [method, setMethod] = useState<PayMethod>('cash')
  const [paidGiven, setPaidGiven] = useState(false)

  const catalog = useMemo<CatalogEntry[]>(
    () => [
      ...services.map((s) => ({ type: 'service' as const, id: s.id, name: s.name, price: s.price })),
      ...inventory.map((i) => ({ type: 'inventory' as const, id: i.id, name: i.name, price: i.sell_price, stock: i.quantity })),
    ],
    [services, inventory]
  )
  const subtotal = (lines || []).reduce((a, l) => a + l.quantity * l.unit_price, 0)
  const inp = 'px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500'

  const reset = () => { setLines(null); setCands([]); setCustomer(null); setNameHint(null); setPaid(''); setPaidGiven(false); setError('') }

  const makeDraft = async () => {
    reset()
    if (!text.trim()) return
    setBusy(true)
    const r = await askAI<AiDraft>('draft', text.trim())
    if (!r.ok) { setBusy(false); return setError(r.message) }
    const d = r.data
    if (d.items.length === 0) { setBusy(false); return setError('লেখা থেকে কোনো আইটেম বুঝতে পারিনি — আরেকটু স্পষ্ট করে লিখুন (যেমন: "রহিমের ৫০টা ভিজিটিং কার্ড ২০০ টাকা")') }
    setLines(buildLines(d, catalog))
    setNameHint(d.customer_name)
    if (d.method) setMethod(d.method)
    if (d.paid !== null) { setPaid(String(d.paid)); setPaidGiven(true) }

    // কাস্টমার মেলানো — আমাদের ডাটাবেসে নাম দিয়ে (AI কখনো ফোন দেখে না)
    if (d.customer_name) {
      const esc = d.customer_name.replace(/[\\%_,()]/g, ' ').trim()
      const { data } = await supabase.from('shop_customers').select('*').ilike('name', `%${esc}%`).order('created_at', { ascending: false }).limit(5)
      const found = (data as ShopCustomer[]) || []
      setCands(found)
      if (found.length === 1) setCustomer(found[0])
    }
    setBusy(false)
  }

  const setLine = (key: string, patch: Partial<DraftLine>) => setLines((ls) => (ls || []).map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const pickMatch = (l: DraftLine, id: string) => {
    if (id === '') return setLine(l.key, { matchId: null })
    const e = catalog.find((c) => `${c.type}:${c.id}` === id)
    if (e) setLine(l.key, { matchId: id, name: e.name, unit_price: l.priceGiven ? l.unit_price : e.price })
  }

  const bad = (lines || []).find((l) => !(l.unit_price > 0) || !(l.quantity > 0))
  const paidNum = paid === '' ? subtotal : Number(paid)
  const overpaid = paidNum > subtotal + 0.001
  const needCustomer = paidNum < subtotal - 0.001 && !customer

  const apply = () => {
    if (!lines) return
    const cart: CartLine[] = lines.map((l) => {
      const e = l.matchId ? catalog.find((c) => `${c.type}:${c.id}` === l.matchId) : null
      return e
        ? { key: `${e.type}:${e.id}`, item_type: e.type, item_ref_id: e.id, item_name: e.name, quantity: l.quantity, unit_price: l.unit_price, ...(e.type === 'inventory' ? { max_quantity: e.stock } : {}) }
        : { key: `custom:${crypto.randomUUID()}`, item_type: 'custom' as const, item_ref_id: null, item_name: l.name, quantity: l.quantity, unit_price: l.unit_price }
    })
    onApply({ lines: cart, customer, payments: paidNum > 0 ? [{ method, amount: paidNum }] : [] })
    setText('')
    reset()
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-3 mb-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 mb-2"><Sparkles size={15} /> লিখে বিক্রি সাজান (AI খসড়া)</p>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && makeDraft()}
          placeholder='যেমন: রহিমের ৫০টা ভিজিটিং কার্ড ২০০ টাকা, ১০০ জমা বিকাশে'
          maxLength={300}
          className="flex-1 border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button onClick={makeDraft} disabled={busy || !text.trim()} className="px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1">
          {busy ? <Loader2 size={15} className="animate-spin" /> : null} খসড়া
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mt-1">AI শুধু লেখাটা ভাগ করে দেয় — ফোন নম্বর AI-কে পাঠানো হয় না। কার্টে বসানোর পর আপনি দেখে "বিক্রি সম্পন্ন" চাপবেন।</p>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {lines && (
        <div className="mt-3 border border-indigo-100 rounded-lg bg-white p-3 space-y-3">
          <div className="flex items-start justify-between"><p className="text-sm font-semibold">খসড়া — দেখে ঠিক করুন</p><button onClick={reset} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button></div>

          <div className="text-sm">
            <p className="text-xs text-gray-500 mb-1">কাস্টমার{nameHint ? ` (লেখায়: “${nameHint}”)` : ' (লেখায় নাম নেই — ওয়াক-ইন)'}</p>
            {customer ? (
              <p className="flex items-center gap-2"><b>{customer.name}</b> <span className="text-xs text-gray-500">{customer.phone}</span><button onClick={() => setCustomer(null)} className="text-xs text-red-600 underline">বাদ</button></p>
            ) : cands.length > 0 ? (
              <div className="space-y-1">{cands.map((c) => <button key={c.id} onClick={() => setCustomer(c)} className="block w-full text-left px-2 py-1.5 border border-gray-200 rounded hover:bg-indigo-50 text-sm">{c.name} <span className="text-xs text-gray-500">• {c.phone}</span></button>)}<p className="text-xs text-amber-700">একাধিক মিলেছে — সঠিকজনকে বাছুন। না বাছলে ওয়াক-ইন (বাকি দেওয়া যাবে না)।</p></div>
            ) : nameHint ? (
              <p className="text-xs text-amber-700">“{nameHint}” নামে কাস্টমার পাওয়া যায়নি — কার্টে গিয়ে কাস্টমার বাছুন/নতুন যোগ করুন, নাহলে ওয়াক-ইন।</p>
            ) : null}
          </div>

          <div className="space-y-2">
            {lines.map((l) => {
              const opts = bestMatches(l.name, catalog, 4)
              const hasSel = l.matchId && !opts.find((o) => `${o.entry.type}:${o.entry.id}` === l.matchId)
              return (
                <div key={l.key} className="border border-gray-100 rounded p-2 space-y-1.5">
                  <p className="text-sm font-medium">{l.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={l.matchId || ''} onChange={(e) => pickMatch(l, e.target.value)} className={`${inp} max-w-[190px]`}>
                      <option value="">কাস্টম আইটেম</option>
                      {hasSel && <option value={l.matchId!}>{catalog.find((c) => `${c.type}:${c.id}` === l.matchId)?.name}</option>}
                      {opts.map((o) => <option key={`${o.entry.type}:${o.entry.id}`} value={`${o.entry.type}:${o.entry.id}`}>{o.entry.name} ({taka(o.entry.price)})</option>)}
                    </select>
                    <label className="text-xs text-gray-500">পরিমাণ <input type="number" min={0} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Number(e.target.value) })} className={`${inp} w-20`} /></label>
                    <label className="text-xs text-gray-500">দর <input type="number" min={0} step="0.01" value={l.unit_price} onChange={(e) => setLine(l.key, { unit_price: Number(e.target.value), priceGiven: true })} className={`${inp} w-24`} /></label>
                    <span className="text-sm font-semibold ml-auto">{taka(l.quantity * l.unit_price)}</span>
                  </div>
                  {!(l.unit_price > 0) && <p className="text-xs text-red-600">দাম লেখা নেই — দর বসান</p>}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-end gap-3 text-sm">
            <span>মোট <b>{taka(subtotal)}</b></span>
            <label className="text-xs text-gray-500">এখন জমা {paidGiven ? '' : '(না বললে পুরোটা)'}<input type="number" min={0} value={paid} onChange={(e) => { setPaid(e.target.value); setPaidGiven(true) }} placeholder={String(subtotal)} className={`${inp} w-28 block`} /></label>
            <label className="text-xs text-gray-500">মাধ্যম<select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} className={`${inp} block`}>{PAY_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
            {paidNum < subtotal - 0.001 && <span className="text-red-600 text-xs font-semibold">বাকি {taka(subtotal - paidNum)}</span>}
          </div>
          {overpaid && <p className="text-xs text-red-600">জমা মোটের বেশি হতে পারে না</p>}
          {needCustomer && <p className="text-xs text-red-600">বাকি রাখতে হলে কাস্টমার বাছুন</p>}
          <button onClick={apply} disabled={!!bad || overpaid || needCustomer} className="w-full py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">কার্টে বসান</button>
        </div>
      )}
    </div>
  )
}
