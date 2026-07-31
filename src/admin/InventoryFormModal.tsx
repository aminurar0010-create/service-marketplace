import { useState } from 'react'
import { supabase, InventoryItem, logActivity } from '../lib/supabase'
import { X } from 'lucide-react'

export default function InventoryFormModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!item
  const [name, setName] = useState(item?.name || '')
  const [sku, setSku] = useState(item?.sku || '')
  const [category, setCategory] = useState(item?.category || '')
  const [unit, setUnit] = useState(item?.unit || 'পিস')
  const [quantity, setQuantity] = useState(item?.quantity ?? 0)
  const [lowStockThreshold, setLowStockThreshold] = useState(item?.low_stock_threshold ?? 5)
  const [costPrice, setCostPrice] = useState(item?.cost_price ?? 0)
  const [sellPrice, setSellPrice] = useState(item?.sell_price ?? 0)
  const [isActive, setIsActive] = useState(item?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (!name.trim()) {
      setError('পণ্যের নাম আবশ্যক')
      return
    }
    if (sellPrice < 0 || costPrice < 0 || quantity < 0) {
      setError('দাম বা পরিমাণ ঋণাত্মক হতে পারবে না')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        sku: sku.trim() || null,
        category: category.trim() || null,
        unit: unit.trim() || 'পিস',
        quantity,
        low_stock_threshold: lowStockThreshold,
        cost_price: costPrice,
        sell_price: sellPrice,
        is_active: isActive,
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', item!.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('inventory_items').insert(payload)
        if (insertError) throw insertError
      }

      logActivity(isEditing ? 'ইনভেন্টরি আইটেম আপডেট করা হয়েছে' : 'নতুন ইনভেন্টরি আইটেম তৈরি করা হয়েছে', 'inventory_item', name.trim())
      onSaved()
      onClose()
    } catch (err: any) {
      console.error('ইনভেন্টরি সেভ ত্রুটি:', err)
      setError(err?.message?.includes('duplicate') ? 'এই SKU ইতিমধ্যে ব্যবহৃত হয়েছে' : 'সেভ করতে সমস্যা হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full my-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{isEditing ? 'পণ্য এডিট করুন' : 'নতুন পণ্য যোগ করুন'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">পণ্যের নাম</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: A4 কাগজ (রিম)"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">SKU / কোড (ঐচ্ছিক)</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="যেমন: PPR-A4-001"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">ক্যাটাগরি</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="যেমন: স্টেশনারি"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">একক</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="পিস / রিম / প্যাকেট"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">বর্তমান স্টক পরিমাণ</label>
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              disabled={isEditing}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
            />
            {isEditing && (
              <p className="text-xs text-gray-400 mt-1">স্টক পরিমাণ পরিবর্তনের জন্য "স্টক সমন্বয়" বাটন ব্যবহার করুন</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">লো-স্টক সতর্কতা সীমা</label>
            <input
              type="number"
              min={0}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">ক্রয়মূল্য (৳)</label>
            <input
              type="number"
              min={0}
              value={costPrice}
              onChange={(e) => setCostPrice(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">বিক্রয়মূল্য (৳)</label>
            <input
              type="number"
              min={0}
              value={sellPrice}
              onChange={(e) => setSellPrice(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-semibold">পণ্যটি সক্রিয় রাখুন (POS-এ দেখাবে)</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 py-2 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            বাতিল
          </button>
        </div>
      </div>
    </div>
  )
}
