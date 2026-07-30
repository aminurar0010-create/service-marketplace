import { useState } from 'react'
import { supabase, Profile, logActivity } from '../lib/supabase'
import { X } from 'lucide-react'

export default function StaffProfileEditModal({
  profile,
  onClose,
  onUpdated,
}: {
  profile: Profile
  onClose: () => void
  onUpdated: () => void
}) {
  const [specialization, setSpecialization] = useState(
    (profile.specialization || []).join(', ')
  )
  const [maxOrders, setMaxOrders] = useState(profile.max_concurrent_orders ?? 10)
  const [isAvailable, setIsAvailable] = useState(profile.is_available ?? true)
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>(
    profile.commission_type || 'percentage'
  )
  const [commissionRate, setCommissionRate] = useState(profile.commission_rate ?? 0)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const specArray = specialization
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      const { error } = await supabase
        .from('profiles')
        .update({
          specialization: specArray,
          max_concurrent_orders: maxOrders,
          is_available: isAvailable,
          commission_type: commissionType,
          commission_rate: commissionRate,
        })
        .eq('id', profile.id)

      if (error) throw error

      logActivity('স্টাফ প্রোফাইল আপডেট করা হয়েছে', 'profile', profile.full_name)
      onUpdated()
      onClose()
    } catch (error) {
      console.error('প্রোফাইল আপডেট ত্রুটি:', error)
      alert('আপডেট করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">
            {profile.full_name || 'স্টাফ'} — প্রোফাইল এডিট
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">
            স্পেশালাইজেশন (কমা দিয়ে আলাদা করুন, ক্যাটাগরি অনুযায়ী)
          </label>
          <input
            type="text"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="যেমন: ভিসা, আইটি"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            services টেবিলের category কলামের মান অনুযায়ী লিখুন। খালি রাখলে এই স্টাফ সব ধরনের কাজের জন্য বিবেচিত হবে।
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2">
            সর্বোচ্চ একসাথে কতগুলো অর্ডার নিতে পারবে
          </label>
          <input
            type="number"
            min={1}
            value={maxOrders}
            onChange={(e) => setMaxOrders(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">কমিশন</label>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={commissionType}
              onChange={(e) => setCommissionType(e.target.value as 'percentage' | 'fixed')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="percentage">শতাংশ (%)</option>
              <option value="fixed">প্রতি অর্ডার নির্দিষ্ট (৳)</option>
            </select>
            <input
              type="number"
              min={0}
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            অর্ডার সম্পন্ন (completed) হলে এই হার অনুযায়ী কমিশন হিসাব হবে
          </p>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-semibold">এই স্টাফ এখন কাজ নিতে পারবে (Available)</span>
          </label>
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

