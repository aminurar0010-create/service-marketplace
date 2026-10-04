import { useState } from 'react'
import { supabase, logActivity, ShopCustomer } from '../../lib/supabase'
import CustomerPicker from '../../components/CustomerPicker'
import { TYPE_ICON, TYPE_LABEL, TicketType, todayDhaka } from './ticketUtils'

/** নতুন টিকিট অনুরোধ (কাউন্টারে) */
export default function TicketForm({ onSaved }: { onSaved: () => void }) {
  const [customer, setCustomer] = useState<ShopCustomer | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState<TicketType>('bus')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState(todayDhaka())
  const [time, setTime] = useState('')
  const [passengers, setPassengers] = useState('')
  const [count, setCount] = useState('1')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const inp = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  const pick = (c: ShopCustomer | null) => { setCustomer(c); setName(c ? c.name : ''); setPhone(c ? c.phone : '') }

  const save = async () => {
    setMsg('')
    setSaving(true)
    const { data, error } = await supabase.rpc('create_ticket_request', {
      p_customer_id: customer?.id ?? null, p_customer_name: name, p_customer_phone: phone,
      p_type: type, p_from: from, p_to: to, p_date: date, p_time: time,
      p_passengers: passengers, p_passenger_count: Number(count) || 1, p_note: note,
    })
    setSaving(false)
    if (error || !data?.success) {
      if (error) console.error('টিকিট অনুরোধ ত্রুটি:', error)
      return setMsg(data?.message || 'সেভ করা যায়নি (ফেজ J-এর SQL রান করা আছে কি?)')
    }
    logActivity(`টিকিট অনুরোধ (${data.request_no})`, 'ticket', data.request_no, { type, from, to })
    setCustomer(null); setName(''); setPhone(''); setFrom(''); setTo(''); setTime(''); setPassengers(''); setCount('1'); setNote('')
    setMsg(`✅ ${data.request_no} নথিভুক্ত হয়েছে — “বোর্ড”-এ দেখুন`)
    onSaved()
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div><p className="text-sm font-semibold mb-1">কাস্টমার (রিপিট হলে খুঁজুন)</p><CustomerPicker value={customer} onChange={pick} /></div>
      <div className="grid grid-cols-2 gap-3"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="কাস্টমারের নাম *" className={inp} /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="মোবাইল" className={inp} /></div>
      <div className="flex gap-2">
        {(Object.keys(TYPE_LABEL) as TicketType[]).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 rounded-lg border text-sm font-semibold ${type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{TYPE_ICON[t]} {TYPE_LABEL[t]}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3"><input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="কোথা থেকে *" className={inp} /><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="কোথায় *" className={inp} /></div>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-xs text-gray-600">যাত্রার তারিখ *<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></label>
        <label className="text-xs text-gray-600">সময় (ঐচ্ছিক)<input value={time} onChange={(e) => setTime(e.target.value)} placeholder="রাত ১০:৩০" className={inp} /></label>
        <label className="text-xs text-gray-600">যাত্রী সংখ্যা<input type="number" min={1} max={20} value={count} onChange={(e) => setCount(e.target.value)} className={inp} /></label>
      </div>
      <textarea value={passengers} onChange={(e) => setPassengers(e.target.value)} placeholder="যাত্রীর নাম (প্রতি লাইনে একজন) — শুধু নাম, NID/পাসপোর্ট নম্বর লিখবেন না" rows={3} className={inp} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="নোট (সিট পছন্দ, কোচ ইত্যাদি)" className={inp} />
      {msg && <p className={`text-sm ${msg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{msg}</p>}
      <button onClick={save} disabled={saving} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 disabled:opacity-50">{saving ? 'সেভ হচ্ছে...' : 'অনুরোধ নথিভুক্ত করুন'}</button>
    </div>
  )
}
