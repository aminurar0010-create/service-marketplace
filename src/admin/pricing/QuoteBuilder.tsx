import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase, logActivity, ShopCustomer } from '../../lib/supabase'
import CustomerPicker from '../../components/CustomerPicker'
import { DraftLine, PriceRule, UNIT_LABEL, calcLine, money } from './pricingUtils'

/** ক্যালকুলেটর + কোটেশন বানানো */
export default function QuoteBuilder({ rules, onSaved }: { rules: PriceRule[]; onSaved: () => void }) {
  const active = useMemo(() => rules.filter((r) => r.is_active), [rules])
  const [ruleId, setRuleId] = useState('')
  const [qty, setQty] = useState('1')
  const [w, setW] = useState('')
  const [h, setH] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [customer, setCustomer] = useState<ShopCustomer | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [discount, setDiscount] = useState('0')
  const [days, setDays] = useState('7')
  const [note, setNote] = useState('')
  const [cName, setCName] = useState('')
  const [cPrice, setCPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const rule = active.find((r) => r.id === ruleId)
  const calc = rule ? calcLine(rule, { qty: Number(qty), width: Number(w), height: Number(h) }) : null
  const subtotal = lines.reduce((a, l) => a + Math.round(l.quantity * l.unit_price * 100) / 100, 0)
  const disc = Math.max(Number(discount) || 0, 0)
  const total = subtotal - disc
  const inp = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  const addCalc = () => {
    if (!rule || !calc) return
    setLines([...lines, { key: crypto.randomUUID(), description: calc.description, detail: calc.detail, quantity: calc.quantity, unit_price: calc.unit_price, rule_id: rule.id }])
    setQty('1'); setW(''); setH('')
  }
  const addCustom = () => {
    if (!cName.trim() || !Number(cPrice) || Number(cPrice) < 0) return alert('নাম ও সঠিক দাম দিন')
    setLines([...lines, { key: crypto.randomUUID(), description: cName.trim(), detail: '', quantity: 1, unit_price: Number(cPrice), rule_id: null }])
    setCName(''); setCPrice('')
  }
  const pick = (c: ShopCustomer | null) => { setCustomer(c); setName(c ? c.name : ''); setPhone(c ? c.phone : '') }

  const save = async () => {
    setMsg('')
    if (lines.length === 0) return setMsg('আগে অন্তত একটি আইটেম যোগ করুন')
    if (disc > subtotal) return setMsg('ছাড় মোটের বেশি হতে পারে না')
    setSaving(true)
    const { data, error } = await supabase.rpc('create_quote', {
      p_customer_id: customer?.id ?? null,
      p_customer_name: name,
      p_customer_phone: phone,
      p_note: note,
      p_discount: disc,
      p_valid_days: Number(days) || 7,
      p_items: lines.map((l) => ({ description: l.description, detail: l.detail, quantity: l.quantity, unit_price: l.unit_price, rule_id: l.rule_id || '' })),
    })
    setSaving(false)
    if (error || !data?.success) {
      if (error) console.error('কোটেশন সেভ ত্রুটি:', error)
      return setMsg(data?.message || 'সেভ করা যায়নি (ফেজ I-এর SQL রান করা আছে কি?)')
    }
    logActivity(`কোটেশন তৈরি (${data.quote_no})`, 'quote', data.quote_no, { total: data.total })
    setLines([]); setCustomer(null); setName(''); setPhone(''); setDiscount('0'); setNote('')
    setMsg(`✅ ${data.quote_no} সেভ হয়েছে — “কোটেশন তালিকা” থেকে প্রিন্ট করুন`)
    onSaved()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="font-semibold text-sm">১. দাম হিসাব করুন</p>
          <select value={ruleId} onChange={(e) => setRuleId(e.target.value)} className={inp}>
            <option value="">সার্ভিস বাছুন</option>
            {active.map((r) => <option key={r.id} value={r.id}>{r.name} ({money(r.rate)}/{UNIT_LABEL[r.unit]})</option>)}
          </select>
          {rule && (
            <div className="grid grid-cols-3 gap-2">
              {rule.unit === 'sqft' && (<>
                <label className="text-xs text-gray-600">চওড়া (ফুট)<input type="number" step="0.1" value={w} onChange={(e) => setW(e.target.value)} className={inp} /></label>
                <label className="text-xs text-gray-600">লম্বা (ফুট)<input type="number" step="0.1" value={h} onChange={(e) => setH(e.target.value)} className={inp} /></label>
              </>)}
              <label className="text-xs text-gray-600">{rule.unit === 'sqft' ? 'কপি' : `পরিমাণ (${UNIT_LABEL[rule.unit]})`}<input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className={inp} /></label>
            </div>
          )}
          {rule && (
            <div className="bg-indigo-50 rounded p-3 text-sm">
              {calc ? (<><p className="font-bold text-indigo-700">{money(calc.line_total)}</p><p className="text-xs text-gray-600">{calc.detail}{calc.quantity > 1 ? ` • ${calc.quantity} × ${money(calc.unit_price)}` : ''}</p></>) : <p className="text-xs text-gray-500">মাপ/পরিমাণ দিন</p>}
            </div>
          )}
          <button onClick={addCalc} disabled={!calc} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded disabled:opacity-40"><Plus size={16} /> কোটেশনে যোগ করুন</button>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 space-y-2">
          <p className="font-semibold text-sm">অন্য আইটেম (তালিকায় নেই)</p>
          <div className="flex gap-2"><input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="বিবরণ" className={inp} /><input type="number" value={cPrice} onChange={(e) => setCPrice(e.target.value)} placeholder="দাম" className={`${inp} max-w-[110px]`} /><button onClick={addCustom} className="px-3 bg-gray-100 rounded hover:bg-gray-200"><Plus size={16} /></button></div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="font-semibold text-sm">২. কোটেশন</p>
        <CustomerPicker value={customer} onChange={pick} />
        <div className="grid grid-cols-2 gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="প্রাপকের নাম" className={inp} /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="মোবাইল" className={inp} /></div>
        <div className="divide-y divide-gray-100 border border-gray-100 rounded">
          {lines.length === 0 && <p className="text-center text-xs text-gray-400 py-6">এখনো কোনো আইটেম নেই</p>}
          {lines.map((l) => (
            <div key={l.key} className="p-2 flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{l.description}</p><p className="text-xs text-gray-500">{l.detail}</p></div>
              <p className="whitespace-nowrap font-semibold">{money(l.quantity * l.unit_price)}</p>
              <button onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-600">ছাড় (৳)<input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inp} /></label>
          <label className="text-xs text-gray-600">মেয়াদ (দিন)<input type="number" value={days} onChange={(e) => setDays(e.target.value)} className={inp} /></label>
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="নোট (ঐচ্ছিক)" className={inp} />
        <div className="flex justify-between text-sm"><span>উপমোট {money(subtotal)}</span><b className="text-base">সর্বমোট {money(Math.max(total, 0))}</b></div>
        {msg && <p className={`text-sm ${msg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{msg}</p>}
        <button onClick={save} disabled={saving || lines.length === 0} className="w-full py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 disabled:opacity-50">{saving ? 'সেভ হচ্ছে...' : 'কোটেশন সেভ করুন'}</button>
      </div>
    </div>
  )
}
