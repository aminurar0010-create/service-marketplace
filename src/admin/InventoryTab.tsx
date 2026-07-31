import { useEffect, useMemo, useState } from 'react'
import { supabase, InventoryItem, StockMovement, logActivity } from '../lib/supabase'
import { Boxes, Plus, Pencil, Trash2, AlertTriangle, History, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import InventoryFormModal from './InventoryFormModal'
import StockAdjustModal from './StockAdjustModal'

export default function InventoryTab() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null)
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      setItems(data || [])
    } catch (error) {
      console.error('ইনভেন্টরি লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMovements = async (item: InventoryItem) => {
    setHistoryItem(item)
    setMovementsLoading(true)
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setMovements(data || [])
    } catch (error) {
      console.error('স্টক হিস্টোরি লোড ত্রুটি:', error)
    } finally {
      setMovementsLoading(false)
    }
  }

  const toggleActive = async (item: InventoryItem) => {
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ is_active: !item.is_active })
        .eq('id', item.id)
      if (error) throw error
      logActivity(item.is_active ? 'পণ্য নিষ্ক্রিয় করা হয়েছে' : 'পণ্য সক্রিয় করা হয়েছে', 'inventory_item', item.name)
      fetchItems()
    } catch (error) {
      console.error('স্ট্যাটাস আপডেট ত্রুটি:', error)
      alert('স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে')
    }
  }

  const deleteItem = async (item: InventoryItem) => {
    const confirmed = window.confirm(`"${item.name}" স্থায়ীভাবে মুছে ফেলতে চান?`)
    if (!confirmed) return
    try {
      const { error } = await supabase.from('inventory_items').delete().eq('id', item.id)
      if (error) throw error
      logActivity('ইনভেন্টরি আইটেম মুছে ফেলা হয়েছে', 'inventory_item', item.name)
      fetchItems()
    } catch (error) {
      console.error('ডিলিট ত্রুটি:', error)
      alert('মুছতে সমস্যা হয়েছে। সম্ভবত এই পণ্যটি ইতিমধ্যে কোনো বিক্রয়ে ব্যবহৃত হয়েছে।')
    }
  }

  const isLowStock = (item: InventoryItem) => item.quantity <= item.low_stock_threshold

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.sku || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(search.toLowerCase())
      const matchesLowStock = !showLowStockOnly || isLowStock(item)
      return matchesSearch && matchesLowStock
    })
  }, [items, search, showLowStockOnly])

  const lowStockCount = items.filter(isLowStock).length
  const totalStockValue = items.reduce((sum, i) => sum + i.quantity * i.cost_price, 0)

  const movementLabel = (type: string) =>
    type === 'in' ? 'স্টক ইন' : type === 'out' ? 'স্টক আউট' : 'সমন্বয়'

  const movementColor = (type: string) =>
    type === 'in' ? 'text-green-600' : type === 'out' ? 'text-red-600' : 'text-indigo-600'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-sm font-semibold">মোট পণ্য</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-orange-500" /> লো-স্টক সতর্কতা
          </p>
          <p className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {lowStockCount}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-sm font-semibold">স্টকের মোট ক্রয়মূল্য</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">৳{totalStockValue.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Boxes className="text-indigo-600" size={22} />
            <h2 className="text-xl font-bold">ইনভেন্টরি / স্টক ম্যানেজমেন্ট</h2>
          </div>
          <button
            onClick={() => {
              setEditingItem(null)
              setShowFormModal(true)
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <Plus size={16} /> নতুন পণ্য
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="নাম, SKU বা ক্যাটাগরি দিয়ে খুঁজুন"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="w-4 h-4"
            />
            শুধু লো-স্টক দেখান
          </label>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">লোড করছি...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-gray-500">কোনো পণ্য পাওয়া যায়নি</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পণ্য</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ক্যাটাগরি</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্টক</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ক্রয়/বিক্রয়মূল্য</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">স্ট্যাটাস</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="px-6 py-3">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{item.category || '-'}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-sm font-bold ${isLowStock(item) ? 'text-orange-600' : 'text-gray-800'}`}
                      >
                        {item.quantity} {item.unit}
                      </span>
                      {isLowStock(item) && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} /> লো-স্টক
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      ৳{item.cost_price} / ৳{item.sell_price}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => toggleActive(item)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {item.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </button>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAdjustingItem(item)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition"
                          title="স্টক সমন্বয়"
                        >
                          <Boxes size={16} />
                        </button>
                        <button
                          onClick={() => fetchMovements(item)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition"
                          title="স্টক হিস্টোরি"
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item)
                            setShowFormModal(true)
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                          title="এডিট"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showFormModal && (
        <InventoryFormModal
          item={editingItem}
          onClose={() => {
            setShowFormModal(false)
            setEditingItem(null)
          }}
          onSaved={fetchItems}
        />
      )}

      {adjustingItem && (
        <StockAdjustModal
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSaved={fetchItems}
        />
      )}

      {historyItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full my-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">স্টক হিস্টোরি — {historyItem.name}</h3>
              <button onClick={() => setHistoryItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {movementsLoading ? (
              <p className="text-center text-gray-500 py-8">লোড হচ্ছে...</p>
            ) : movements.length === 0 ? (
              <p className="text-center text-gray-500 py-8">কোনো স্টক পরিবর্তনের রেকর্ড নেই</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div>
                      <p className={`text-sm font-semibold ${movementColor(m.movement_type)}`}>
                        {movementLabel(m.movement_type)}: {m.quantity}
                      </p>
                      {m.reason && <p className="text-xs text-gray-500">{m.reason}</p>}
                    </div>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(m.created_at), { locale: bn, addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
