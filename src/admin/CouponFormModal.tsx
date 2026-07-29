import { useState } from 'react'
import { supabase, Coupon, Service } from '../lib/supabase'
import { X } from 'lucide-react'

export default function CouponFormModal({
  coupon,
  services,
  onClose,
  onSaved,
}: {
  coupon: Coupon | null
  services: Service[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!coupon
  const categories = Array.from(new Set(services.map((s) => s.category).filter(Boolean)))

  const [code, setCode] = useState(coupon?.code || '')
  const [description, setDescription] = useState(coupon?.description || '')
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
    coupon?.discount_type || 'percentage'
  )
  const [discountValue, setDiscountValue] = useState(coupon?.discount_value ?? 10)
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(
    coupon?.max_discount_amount != null ? String(coupon.max_discount_amount) : ''
  )
  const [minOrderAmount, setMinOrderAmount] = useState(coupon?.min_order_amount ?? 0)
  const [usageLimit, setUsageLimit] = useState(
    coupon?.usage_limit != null ? String(coupon.usage_limit) : ''
  )
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState(
    coupon?.usage_limit_per_customer ?? 1
  )
  const [applicableCategories, setApplicableCategories] = useState<string[]>(
    coupon?.applicable_categories || []
  )
  const [validUntil, setValidUntil] = useState(
    coupon?.valid_until ? coupon.valid_until.slice(0, 10) : ''
  )
  const [isActive, setIsActive] = useState(coupon?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleCategory = (cat: string) => {
    setApplicableCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleSave = async () => {
    setError('')
    if (!code.trim()) {
      setError('কুপন কোড আবশ্যক')
      return
    }
    if (discountValue <= 0) {
      setError('ছাড়ের পরিমাণ ০ এর বেশি হতে হবে')
      return
    }

    setSaving(true)
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        discount_type: discountType,
        discount_value: discountValue,
        max_discount_amount:
          discountType === 'percentage' && maxDiscountAmount ? Number(maxDiscountAmount) : null,
        min_order_amount: minOrderAmount,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        usage_limit_per_customer: usageLimitPerCustomer,
        applicable_categories: applicableCategories.length > 0 ? applicableCategories : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        is_active: isActive,
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', coupon!.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('coupons').insert(payload)
        if (insertError) throw insertError
      }

      onSaved()
      onClose()
    } catch (err: any) {
      console.error('কুপন সেভ ত্রুটি:', err)
      if (err?.code === '23505') {
        setError('এই কোডের একটি কুপন ইতিমধ্যে আছে')
      } else {
        setError('সেভ করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full my-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{isEditing ? 'কুপন এডিট করুন' : 'নতুন কুপন তৈরি করুন'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">কুপন কোড</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="যেমন: EID20"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">বিবরণ (ঐচ্ছিক)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="যেমন: ঈদ স্পেশাল ২০% ছাড়"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">ছাড়ের ধরন</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="percentage">শতাংশ (%)</option>
              <option value="fixed">নির্দিষ্ট টাকা (৳)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              ছাড়ের পরিমাণ {discountType === 'percentage' ? '(%)' : '(৳)'}
            </label>
            <input
              type="number"
              min={0}
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {discountType === 'percentage' && (
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-2">সর্বোচ্চ ছাড় (৳, ঐচ্ছিক)</label>
              <input
                type="number"
                min={0}
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                placeholder="সীমাহীন রাখতে খালি রাখুন"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2">সর্বনিম্ন অর্ডার (৳)</label>
            <input
              type="number"
              min={0}
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">মেয়াদ শেষ (ঐচ্ছিক)</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">মোট ব্যবহারের সীমা (ঐচ্ছিক)</label>
            <input
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="সীমাহীন রাখতে খালি রাখুন"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">প্রতি গ্রাহক ব্যবহারের সীমা</label>
            <input
              type="number"
              min={1}
              value={usageLimitPerCustomer}
              onChange={(e) => setUsageLimitPerCustomer(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {categories.length > 0 && (
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-2">
                প্রযোজ্য ক্যাটাগরি (কিছু না বাছলে সব সেবায় প্রযোজ্য হবে)
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${
                      applicableCategories.includes(cat)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-semibold">কুপনটি সক্রিয় রাখুন</span>
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

