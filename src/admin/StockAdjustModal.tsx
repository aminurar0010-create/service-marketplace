import { useState } from 'react'
import { supabase, InventoryItem, logActivity } from '../lib/supabase'
import { X } from 'lucide-react'

export default function StockAdjustModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem
  onClose: () => void
  onSaved: () => void
}) {
  const [movementType, setMovementType] = useState<'in' | 'out' | 'adjustment'>('in')
  const [quantity, setQuantity] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (quantity < 0 || (movementType !== 'adjustment' && quantity <= 0)) {
      setError('সঠিক পরিমাণ দিন')
      return
    }

    setSaving(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('adjust_stock', {
        p_item_id: item.id,
        p_movement_type: movementType,
        p_quantity: quantity,
        p_reason: reason.trim() || null,
      })

      if (rpcError) throw rpcError
      if (data && data.success === false) {
        setError(data.message || 'স্টক সমন্বয় করতে সমস্যা হয়েছে')
        setSaving(false)
        return
      }

      logActivity(
        `স্টক ${movementType === 'in' ? 'যোগ' : movementType === 'out' ? 'বিয়োগ' : 'সমন্বয়'} করা হয়েছে`,
        'inventory_item',
        item.name,
        { quantity, movement_type: movementType, reason }
      )
      onSaved()
      onClose()
    } catch (err) {
      console.error('স্টক সমন্বয় ত্রুটি:', err)
      setError('স্টক সমন্বয় করতে সমস্যা হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full my-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">স্টক সমন্বয় — {item.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          বর্তমান স্টক: <span className="font-semibold text-gray-800">{item.quantity} {item.unit}</span>
        </p>

        {error && <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => setMovementType('in')}
            className={`py-2 rounded-lg text-sm font-semibold border ${
              movementType === 'in' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600'
            }`}
          >
            স্টক ইন (+)
          </button>
          <button
            onClick={() => setMovementType('out')}
            className={`py-2 rounded-lg text-sm font-semibold border ${
              movementType === 'out' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600'
            }`}
          >
            স্টক আউট (-)
          </button>
          <button
            onClick={() => setMovementType('adjustment')}
            className={`py-2 rounded-lg text-sm font-semibold border ${
              movementType === 'adjustment' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'
            }`}
          >
            সংশোধন
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">
            {movementType === 'adjustment' ? 'নতুন সম্পূর্ণ স্টক পরিমাণ' : 'পরিমাণ'}
          </label>
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">কারণ (ঐচ্ছিক)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="যেমন: নতুন ক্রয়, নষ্ট হয়ে গেছে, গণনায় ভুল ছিল"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'সেভ হচ্ছে...' : 'নিশ্চিত করুন'}
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
