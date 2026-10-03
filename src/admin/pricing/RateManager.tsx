import { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase, logActivity } from '../../lib/supabase'
import { PriceRule, PriceTier, PriceUnit, UNIT_LABEL, money } from './pricingUtils'

const EMPTY = { name: '', category: '', unit: 'piece' as PriceUnit, rate: '', min_charge: '0', note: '', is_active: true, tiers: [] as { min_qty: string; rate: string }[] }

/** রেট ম্যানেজমেন্ট (শুধু অ্যাডমিন) */
export default function RateManager({ rules, reload }: { rules: PriceRule[]; reload: () => void }) {
  const [editing, setEditing] = useState<PriceRule | 'new' | null>(null)
  const [f, setF] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const inp = 'mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  const open = (r: PriceRule | 'new') => {
    setEditing(r)
    setF(
      r === 'new'
        ? EMPTY
        : { name: r.name, category: r.category || '', unit: r.unit, rate: String(r.rate), min_charge: String(r.min_charge), note: r.note || '', is_active: r.is_active, tiers: (r.tiers || []).map((t) => ({ min_qty: String(t.min_qty), rate: String(t.rate) })) }
    )
  }

  const save = async () => {
    const rate = Number(f.rate), min = Number(f.min_charge || 0)
    const tiers: PriceTier[] = f.tiers.filter((t) => t.min_qty !== '' && t.rate !== '').map((t) => ({ min_qty: Number(t.min_qty), rate: Number(t.rate) }))
    if (!f.name.trim() || isNaN(rate) || rate < 0 || isNaN(min) || min < 0 || tiers.some((t) => isNaN(t.min_qty) || t.min_qty <= 0 || isNaN(t.rate) || t.rate < 0)) {
      alert('নাম, রেট ও ধাপগুলো সঠিকভাবে দিন')
      return
    }
    setSaving(true)
    const row = { name: f.name.trim(), category: f.category.trim() || null, unit: f.unit, rate, min_charge: min, tiers, note: f.note.trim() || null, is_active: f.is_active }
    const { error } = editing === 'new' ? await supabase.from('price_rules').insert({ ...row, sort_order: rules.length + 1 }) : await supabase.from('price_rules').update(row).eq('id', (editing as PriceRule).id)
    setSaving(false)
    if (error) {
      console.error('রেট সেভ ত্রুটি:', error)
      alert('সেভ করা যায়নি (শুধু অ্যাডমিন পারেন)')
      return
    }
    logActivity(editing === 'new' ? 'নতুন রেট যোগ' : 'রেট আপডেট', 'price_rule', row.name)
    setEditing(null)
    reload()
  }

  const remove = async (r: PriceRule) => {
    if (!window.confirm(`“${r.name}” রেটটি মুছবেন? পুরনো কোটেশনে এর কোনো প্রভাব পড়বে না।`)) return
    const { error } = await supabase.from('price_rules').delete().eq('id', r.id)
    if (error) return alert('মুছতে পারিনি')
    logActivity('রেট মোছা হয়েছে', 'price_rule', r.name)
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-600">যে রেটগুলো সক্রিয়, শুধু সেগুলোই ক্যালকুলেটরে আসে। “নমুনা রেট” লেখাগুলো বদলে আপনার আসল রেট বসান।</p>
        <button onClick={() => open('new')} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700"><Plus size={16} /> নতুন রেট</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">সার্ভিস</th><th className="px-3 py-2 text-left">রেট</th><th className="px-3 py-2 text-left">ন্যূনতম</th><th className="px-3 py-2 text-left">পরিমাণ-ছাড়</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className={`border-b border-gray-100 ${r.is_active ? '' : 'opacity-50'}`}>
                <td className="px-3 py-2"><p className="font-semibold">{r.name}</p><p className="text-xs text-gray-500">{r.category || '—'}{r.note ? ` • ${r.note}` : ''}</p></td>
                <td className="px-3 py-2">{money(r.rate)} / {UNIT_LABEL[r.unit]}</td>
                <td className="px-3 py-2">{r.min_charge > 0 ? money(r.min_charge) : '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{(r.tiers || []).length ? r.tiers.map((t) => `${t.min_qty}+ → ${money(t.rate)}`).join(', ') : '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right">
                  <button onClick={() => open(r)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded" title="সম্পাদনা"><Pencil size={15} /></button>
                  <button onClick={() => remove(r)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded" title="মুছুন"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">কোনো রেট নেই — “নতুন রেট” চাপুন</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-3">
            <div className="flex items-center justify-between"><h3 className="font-bold">{editing === 'new' ? 'নতুন রেট' : 'রেট সম্পাদনা'}</h3><button onClick={() => setEditing(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><X size={18} /></button></div>
            <label className="block text-sm font-semibold text-gray-700">সার্ভিসের নাম<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} placeholder="যেমন: ফ্লেক্স ব্যানার" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-gray-700">একক
                <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as PriceUnit })} className={inp}>{(Object.keys(UNIT_LABEL) as PriceUnit[]).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select>
              </label>
              <label className="block text-sm font-semibold text-gray-700">ক্যাটাগরি<input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inp} placeholder="ঐচ্ছিক" /></label>
              <label className="block text-sm font-semibold text-gray-700">রেট (৳ / {UNIT_LABEL[f.unit]})<input type="number" step="0.01" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} className={inp} /></label>
              <label className="block text-sm font-semibold text-gray-700">ন্যূনতম চার্জ (৳)<input type="number" step="0.01" value={f.min_charge} onChange={(e) => setF({ ...f, min_charge: e.target.value })} className={inp} /></label>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">পরিমাণ বাড়লে কম রেট (ঐচ্ছিক)</p>
              {f.tiers.map((t, i) => (
                <div key={i} className="flex gap-2 mt-1 items-center">
                  <input type="number" value={t.min_qty} onChange={(e) => setF({ ...f, tiers: f.tiers.map((x, j) => (j === i ? { ...x, min_qty: e.target.value } : x)) })} placeholder="কমপক্ষে পরিমাণ" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
                  <input type="number" step="0.01" value={t.rate} onChange={(e) => setF({ ...f, tiers: f.tiers.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)) })} placeholder="রেট" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
                  <button onClick={() => setF({ ...f, tiers: f.tiers.filter((_, j) => j !== i) })} className="p-1 text-gray-400 hover:text-red-600"><X size={16} /></button>
                </div>
              ))}
              <button onClick={() => setF({ ...f, tiers: [...f.tiers, { min_qty: '', rate: '' }] })} className="text-sm text-indigo-600 mt-1 hover:underline">+ ধাপ যোগ করুন</button>
              <p className="text-xs text-gray-400 mt-1">বর্গফুটে ধাপ মোট ক্ষেত্রফলের (মাপ × কপি) উপর খাটে।</p>
            </div>
            <label className="block text-sm font-semibold text-gray-700">নোট<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={inp} /></label>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> সক্রিয় (ক্যালকুলেটরে দেখাবে)</label>
            <button onClick={save} disabled={saving} className="w-full py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 disabled:opacity-50">{saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
