import { useEffect, useMemo, useState } from 'react'
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase, CashTransaction } from '../lib/supabase'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function CashBookTab() {
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayStr())

  const [form, setForm] = useState({
    entry_date: todayStr(),
    type: 'income' as 'income' | 'expense',
    category: '',
    description: '',
    amount: '',
  })

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cash_transactions')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('ক্যাশ-বুক লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const addEntry = async () => {
    if (!form.category.trim() || !form.amount || Number(form.amount) <= 0) {
      alert('ক্যাটাগরি ও পরিমাণ সঠিকভাবে দিন')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('cash_transactions').insert({
        entry_date: form.entry_date,
        type: form.type,
        category: form.category.trim(),
        description: form.description.trim() || null,
        amount: Number(form.amount),
      })
      if (error) throw error
      setForm({ entry_date: todayStr(), type: 'income', category: '', description: '', amount: '' })
      fetchTransactions()
    } catch (error) {
      console.error('এন্ট্রি যোগ ত্রুটি:', error)
      alert('এন্ট্রি যোগ করতে সমস্যা হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  const deleteEntry = async (tx: CashTransaction) => {
    const confirmed = window.confirm('এই এন্ট্রিটি মুছে ফেলতে চান?')
    if (!confirmed) return
    try {
      const { error } = await supabase.from('cash_transactions').delete().eq('id', tx.id)
      if (error) throw error
      fetchTransactions()
    } catch (error) {
      console.error('এন্ট্রি ডিলিট ত্রুটি:', error)
      alert('এন্ট্রি মুছতে সমস্যা হয়েছে')
    }
  }

  const dayTransactions = useMemo(
    () => transactions.filter((t) => t.entry_date === selectedDate),
    [transactions, selectedDate]
  )

  const dayIncome = dayTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const dayExpense = dayTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const runningBalance = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)
  }, [transactions])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-sm font-semibold">নির্বাচিত দিনের আয়</p>
          <p className="text-2xl font-bold text-green-600 mt-1">৳{dayIncome}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-sm font-semibold">নির্বাচিত দিনের ব্যয়</p>
          <p className="text-2xl font-bold text-red-600 mt-1">৳{dayExpense}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-sm font-semibold">সর্বমোট ব্যালেন্স (সকল সময়)</p>
          <p className={`text-2xl font-bold mt-1 ${runningBalance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
            ৳{runningBalance}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Plus size={18} className="text-indigo-600" /> নতুন এন্ট্রি যোগ করুন
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="date"
            value={form.entry_date}
            onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}
            className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="income">আয় (Income)</option>
            <option value="expense">ব্যয় (Expense)</option>
          </select>
          <input
            type="text"
            placeholder="ক্যাটাগরি (যেমন: ভাড়া, বেতন, নগদ পেমেন্ট)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none md:col-span-2"
          />
          <input
            type="number"
            placeholder="পরিমাণ (৳)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <input
            type="text"
            placeholder="বিস্তারিত (ঐচ্ছিক)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none md:col-span-4"
          />
          <button
            onClick={addEntry}
            disabled={saving}
            className="px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'যোগ হচ্ছে...' : 'এন্ট্রি যোগ করুন'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Wallet className="text-indigo-600" size={22} />
            <h2 className="text-xl font-bold">ডেইলি ক্যাশ-বুক</h2>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">লোড করছি...</p>
          </div>
        ) : dayTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">এই তারিখে কোনো এন্ট্রি নেই</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ধরন</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ক্যাটাগরি</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">বিস্তারিত</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পরিমাণ</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {dayTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-100">
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {tx.type === 'income' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {tx.type === 'income' ? 'আয়' : 'ব্যয়'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium">{tx.category}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{tx.description || '-'}</td>
                    <td
                      className={`px-6 py-3 text-sm font-bold ${
                        tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}৳{tx.amount}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => deleteEntry(tx)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
