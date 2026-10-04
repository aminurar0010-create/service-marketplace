import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { MessageCircle, Printer, X } from 'lucide-react'
import { supabase, logActivity } from '../../lib/supabase'
import { PAY_METHODS, PayMethod } from '../pos/posTypes'
import { TicketRow, TYPE_ICON, TYPE_LABEL, STATUS_LABEL, TicketStatus, money, profitOf, printTicketSlip, ticketMessage, todayDhaka, whatsappLink } from './ticketUtils'

const COLS: TicketStatus[] = ['requested', 'booked', 'delivered', 'cancelled']
const addDay = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

/** বোর্ড: অনুরোধ → বুক হয়েছে → ডেলিভারি; বুকিং নিশ্চিত/বাতিল শুধু অ্যাডমিন */
export default function TicketBoard({ tickets, isAdmin, reload }: { tickets: TicketRow[]; isAdmin: boolean; reload: () => void }) {
  const [col, setCol] = useState<TicketStatus>('requested')
  const [confirmT, setConfirmT] = useState<TicketRow | null>(null)
  const [cancelT, setCancelT] = useState<TicketRow | null>(null)
  const [f, setF] = useState({ platform: '', ref: '', fare: '', sc: '', cost: '', costMethod: 'cash' as PayMethod, paid: '', payMethod: 'cash' as PayMethod })
  const [c, setC] = useState({ refund: '', method: 'cash' as PayMethod, reason: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inp = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'
  const today = todayDhaka(), tomorrow = addDay(today, 1)

  const platforms = useMemo(() => [...new Set(tickets.map((t) => t.platform).filter(Boolean) as string[])], [tickets])
  const list = useMemo(() => tickets.filter((t) => t.status === col).sort((a, b) => (col === 'delivered' || col === 'cancelled' ? b.created_at.localeCompare(a.created_at) : a.travel_date.localeCompare(b.travel_date))), [tickets, col])
  const count = (s: TicketStatus) => tickets.filter((t) => t.status === s).length
  const total = (Number(f.fare) || 0) + (Number(f.sc) || 0)
  const profit = total - (Number(f.cost) || 0)

  const openConfirm = (t: TicketRow) => { setConfirmT(t); setErr(''); setF({ platform: '', ref: '', fare: '', sc: '', cost: '', costMethod: 'cash', paid: '', payMethod: 'cash' }) }
  const submitConfirm = async () => {
    if (!confirmT) return
    const paid = f.paid === '' ? total : Number(f.paid)
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('confirm_ticket_booking', {
      p_request_id: confirmT.id, p_platform: f.platform, p_ticket_ref: f.ref,
      p_fare: Number(f.fare) || 0, p_service_charge: Number(f.sc) || 0, p_cost: Number(f.cost) || 0, p_cost_method: f.costMethod,
      p_payments: paid > 0 ? [{ method: f.payMethod, amount: paid }] : [],
    })
    setBusy(false)
    if (error || !data?.success) { if (error) console.error('বুকিং নিশ্চিত ত্রুটি:', error); return setErr(data?.message || 'নিশ্চিত করা যায়নি') }
    logActivity(`টিকিট বুকিং নিশ্চিত (${confirmT.request_no})`, 'ticket', confirmT.request_no, { sell: data.sell_price, profit: data.profit })
    setConfirmT(null); setCol('booked'); reload()
  }
  const delivered = async (t: TicketRow) => {
    const { data, error } = await supabase.rpc('mark_ticket_delivered', { p_request_id: t.id })
    if (error || !data?.success) return alert(data?.message || 'বদলানো যায়নি')
    logActivity(`টিকিট ডেলিভারি (${t.request_no})`, 'ticket', t.request_no)
    reload()
  }
  const submitCancel = async () => {
    if (!cancelT) return
    if (!window.confirm(`${cancelT.request_no} বাতিল করবেন? ${cancelT.sale_id ? 'কাস্টমারের দেওয়া টাকা ফেরত-ব্যয় হিসেবে ক্যাশ-বুকে যাবে।' : ''}`)) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('cancel_ticket', { p_request_id: cancelT.id, p_platform_refund: Number(c.refund) || 0, p_refund_method: c.method, p_reason: c.reason })
    setBusy(false)
    if (error || !data?.success) { if (error) console.error('টিকিট বাতিল ত্রুটি:', error); return setErr(data?.message || 'বাতিল করা যায়নি') }
    logActivity(`টিকিট বাতিল (${cancelT.request_no})`, 'ticket', cancelT.request_no, { reason: c.reason })
    setCancelT(null); reload()
  }

  const methodSel = (v: PayMethod, on: (m: PayMethod) => void) => (
    <select value={v} onChange={(e) => on(e.target.value as PayMethod)} className={inp}>{PAY_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {COLS.map((s) => <button key={s} onClick={() => setCol(s)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${col === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{STATUS_LABEL[s]} ({count(s).toLocaleString('bn-BD')})</button>)}
      </div>
      {list.length === 0 ? <p className="text-center text-gray-500 py-10 text-sm">এখানে কিছু নেই</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {list.map((t) => {
            const soon = (t.status === 'requested' || t.status === 'booked') && t.travel_date <= tomorrow
            const wa = whatsappLink(t.customer_phone, ticketMessage(t))
            return (
              <div key={t.id} className={`border rounded-lg p-4 space-y-2 ${soon ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{TYPE_ICON[t.ticket_type]} {t.from_place} → {t.to_place}</p>
                    <p className="text-xs text-gray-600">{format(new Date(t.travel_date), 'dd/MM/yyyy')}{t.travel_time ? ` • ${t.travel_time}` : ''} • {t.passenger_count} জন • {TYPE_LABEL[t.ticket_type]}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500"><p className="font-semibold text-gray-700">{t.request_no}</p>{t.source === 'web' && <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">ওয়েবসাইট</span>}</div>
                </div>
                {soon && <p className="text-xs font-semibold text-amber-700">⚠️ {t.travel_date === today ? 'আজ' : t.travel_date < today ? 'যাত্রার তারিখ পেরিয়ে গেছে' : 'কাল'} যাত্রা</p>}
                <p className="text-sm">{t.customer_name}{t.customer_phone ? ` • ${t.customer_phone}` : ''}</p>
                {t.passengers && <p className="text-xs text-gray-600 whitespace-pre-line">যাত্রী: {t.passengers}</p>}
                {t.note && <p className="text-xs text-gray-500">নোট: {t.note}</p>}
                {t.status !== 'requested' && t.status !== 'cancelled' && (
                  <p className="text-xs text-gray-600">{t.platform || '—'} • নং {t.ticket_ref} • বিক্রি {money(t.sell_price)} • কেনা {money(t.cost_price)} • <b className={profitOf(t) >= 0 ? 'text-green-700' : 'text-red-600'}>লাভ {money(profitOf(t))}</b></p>
                )}
                {t.status === 'cancelled' && <p className="text-xs text-gray-500">{t.cancel_reason || 'কারণ নেই'}{t.cost_price ? ` • নিট ${money(profitOf(t))}` : ''}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {t.status === 'requested' && isAdmin && <button onClick={() => openConfirm(t)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700">বুকিং নিশ্চিত করুন</button>}
                  {t.status === 'requested' && !isAdmin && <span className="text-xs text-gray-500">বুকিং নিশ্চিত করবেন অ্যাডমিন</span>}
                  {t.status === 'booked' && <button onClick={() => delivered(t)} className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700">ডেলিভারি হয়েছে</button>}
                  {(t.status === 'booked' || t.status === 'delivered') && <button onClick={() => printTicketSlip(t)} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50"><Printer size={14} /> স্লিপ</button>}
                  {(t.status === 'booked' || t.status === 'delivered') && wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 border border-green-300 text-green-700 text-xs rounded hover:bg-green-50"><MessageCircle size={14} /> WhatsApp</a>}
                  {t.status !== 'cancelled' && isAdmin && <button onClick={() => { setCancelT(t); setErr(''); setC({ refund: '', method: 'cash', reason: '' }) }} className="px-2.5 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50">বাতিল</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmT && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-3">
            <div className="flex items-start justify-between"><div><h3 className="font-bold">বুকিং নিশ্চিত — {confirmT.request_no}</h3><p className="text-xs text-gray-500">{confirmT.from_place} → {confirmT.to_place} • {confirmT.customer_name}</p></div><button onClick={() => setConfirmT(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><X size={18} /></button></div>
            <input list="plat" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} placeholder="কোন প্ল্যাটফর্ম/কাউন্টার থেকে কাটলেন" className={inp} /><datalist id="plat">{platforms.map((p) => <option key={p} value={p} />)}</datalist>
            <input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} placeholder="টিকিট / PNR নম্বর *" className={inp} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">কাস্টমারের ভাড়া (৳)<input type="number" value={f.fare} onChange={(e) => setF({ ...f, fare: e.target.value })} className={inp} /></label>
              <label className="text-xs text-gray-600">সার্ভিস চার্জ (৳)<input type="number" value={f.sc} onChange={(e) => setF({ ...f, sc: e.target.value })} className={inp} /></label>
              <label className="text-xs text-gray-600">কেনা দাম — প্ল্যাটফর্মকে দিলেন (৳)<input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} className={inp} /></label>
              <label className="text-xs text-gray-600">কেনার মাধ্যম{methodSel(f.costMethod, (m) => setF({ ...f, costMethod: m }))}</label>
            </div>
            <div className="bg-indigo-50 rounded p-3 text-sm flex justify-between"><span>কাস্টমারের মোট {money(total)}</span><b className={profit >= 0 ? 'text-green-700' : 'text-red-600'}>লাভ {money(profit)}</b></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">কাস্টমার এখন দিল (৳) — কম হলে বাকি<input type="number" value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} placeholder={String(total)} className={inp} /></label>
              <label className="text-xs text-gray-600">নেওয়ার মাধ্যম{methodSel(f.payMethod, (m) => setF({ ...f, payMethod: m }))}</label>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button onClick={submitConfirm} disabled={busy} className="w-full py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 disabled:opacity-50">{busy ? 'হচ্ছে...' : 'নিশ্চিত করুন (বিক্রি ও ব্যয় এন্ট্রি হবে)'}</button>
          </div>
        </div>
      )}

      {cancelT && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-3">
            <div className="flex items-start justify-between"><div><h3 className="font-bold">বাতিল — {cancelT.request_no}</h3><p className="text-xs text-gray-500">{cancelT.sale_id ? `কেনা ${money(cancelT.cost_price)} • কাস্টমারের বিল ${money(cancelT.sell_price)} (ফেরত হবে)` : 'বুকিং হয়নি — শুধু অনুরোধ বাতিল'}</p></div><button onClick={() => setCancelT(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><X size={18} /></button></div>
            {cancelT.sale_id && <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">প্ল্যাটফর্ম থেকে ফেরত পেলেন (৳)<input type="number" value={c.refund} onChange={(e) => setC({ ...c, refund: e.target.value })} placeholder="০" className={inp} /></label>
              <label className="text-xs text-gray-600">ফেরত পাওয়ার মাধ্যম{methodSel(c.method, (m) => setC({ ...c, method: m }))}</label>
            </div>}
            <input value={c.reason} onChange={(e) => setC({ ...c, reason: e.target.value })} placeholder="কারণ" className={inp} />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button onClick={submitCancel} disabled={busy} className="w-full py-2 bg-red-600 text-white font-semibold rounded hover:bg-red-700 disabled:opacity-50">{busy ? 'হচ্ছে...' : 'বাতিল নিশ্চিত করুন'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
