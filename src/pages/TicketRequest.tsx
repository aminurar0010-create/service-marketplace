import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plane, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSEO } from '../lib/useSEO'

const TYPES = [
  { id: 'bus', label: '🚌 বাস' },
  { id: 'train', label: '🚆 ট্রেন' },
  { id: 'air', label: '✈️ বিমান' },
] as const

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

/** পাবলিক টিকিট অনুরোধ ফর্ম — টিকিট এখানে কাটা হয় না; আমরা বুক করে আপনাকে জানাব */
export default function TicketRequest() {
  useSEO('টিকিট অনুরোধ | নিউ প্রিন্টার্স', 'বাস, ট্রেন ও বিমানের টিকিটের জন্য অনুরোধ করুন — আমরা বুক করে আপনাকে জানাব।')
  const [type, setType] = useState<'bus' | 'train' | 'air'>('bus')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState(today())
  const [count, setCount] = useState('1')
  const [passengers, setPassengers] = useState('')
  const [note, setNote] = useState('')
  const [trap, setTrap] = useState('') // মানুষ দেখে না — বট ভরলে বাদ
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [doneNo, setDoneNo] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (trap) return setDoneNo('TK-000000') // বটকে সফল দেখিয়ে চুপচাপ বাদ
    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('submit_ticket_request', {
      p_name: name, p_phone: phone, p_type: type, p_from: from, p_to: to, p_date: date,
      p_passengers: passengers, p_passenger_count: Number(count) || 1, p_note: note,
    })
    setBusy(false)
    if (rpcError || !data?.success) {
      if (rpcError) console.error('টিকিট অনুরোধ ত্রুটি:', rpcError)
      return setError(data?.message || 'অনুরোধ পাঠানো যায়নি। কিছুক্ষণ পরে চেষ্টা করুন বা ফোন করুন।')
    }
    setDoneNo(data.request_no)
  }

  const inp = 'w-full border border-ink-100 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-ink-400 outline-none bg-white'

  if (doneNo) {
    return (
      <div className="min-h-screen bg-paper pt-28 pb-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-ink-100 p-8 text-center">
          <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-ink-700 mb-2">অনুরোধ পাঠানো হয়েছে</h1>
          <p className="text-charcoal/70 mb-1">অনুরোধ নং: <b>{doneNo}</b></p>
          <p className="text-sm text-charcoal/60 mb-6">আমরা টিকিটের দাম ও সময় যাচাই করে আপনাকে ফোনে জানাব। এখনো কোনো টাকা দিতে হবে না।</p>
          <Link to="/" className="inline-block bg-ink-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-ink-700 transition">হোমে ফিরুন</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper pt-28 pb-16 px-4">
      <form onSubmit={submit} className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-ink-100 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <Plane className="text-ink-600" />
          <div>
            <h1 className="text-xl font-bold text-ink-700">টিকিটের অনুরোধ</h1>
            <p className="text-sm text-charcoal/60">বাস, ট্রেন বা বিমান — তথ্য দিন, আমরা বুক করে জানাব। এখানে টিকিট কাটা বা টাকা নেওয়া হয় না।</p>
          </div>
        </div>
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button type="button" key={t.id} onClick={() => setType(t.id)} className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition ${type === t.id ? 'bg-ink-600 text-white border-ink-600' : 'border-ink-100 text-charcoal/70 hover:bg-ink-50'}`}>{t.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="কোথা থেকে *" required maxLength={80} className={inp} />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="কোথায় *" required maxLength={80} className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-charcoal/60">যাত্রার তারিখ *<input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} required className={inp} /></label>
          <label className="text-xs text-charcoal/60">যাত্রী সংখ্যা<input type="number" min={1} max={20} value={count} onChange={(e) => setCount(e.target.value)} className={inp} /></label>
        </div>
        <textarea value={passengers} onChange={(e) => setPassengers(e.target.value)} rows={2} maxLength={600} placeholder="যাত্রীর নাম (প্রতি লাইনে একজন) — শুধু নাম, NID/পাসপোর্ট নম্বর লিখবেন না" className={inp} />
        <div className="grid grid-cols-2 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার নাম *" required maxLength={80} className={inp} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="মোবাইল নম্বর *" required inputMode="tel" className={inp} />
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="নোট (সময়ের পছন্দ, কোচ/ক্লাস ইত্যাদি)" className={inp} />
        <input value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="w-full bg-ink-600 text-white py-3 rounded-lg font-semibold hover:bg-ink-700 transition disabled:opacity-50">{busy ? 'পাঠানো হচ্ছে...' : 'অনুরোধ পাঠান'}</button>
      </form>
    </div>
  )
}
