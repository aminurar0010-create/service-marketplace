import { useState, useEffect } from 'react'
import { supabase, Service } from '../lib/supabase'
import { Plus, Trash2, X } from 'lucide-react'

export default function ServiceFormModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!service
  const [name, setName] = useState(service?.name || '')
  const [description, setDescription] = useState(service?.description || '')
  const [price, setPrice] = useState(service?.price ?? 0)
  const [category, setCategory] = useState(service?.category || '')
  const [isActive, setIsActive] = useState(service?.is_active ?? true)

  // জরুরি (urgent) ফি সংক্রান্ত স্টেট
  const [urgentEnabled, setUrgentEnabled] = useState(!!service?.urgent_fee_type)
  const [urgentFeeType, setUrgentFeeType] = useState<'fixed' | 'percentage'>(
    service?.urgent_fee_type === 'percentage' ? 'percentage' : 'fixed'
  )
  const [urgentFeeValue, setUrgentFeeValue] = useState(service?.urgent_fee_value ?? 0)
  const [urgentDeliveryHours, setUrgentDeliveryHours] = useState(service?.urgent_delivery_hours ?? 24)

  // কাস্টম রিকোয়ারমেন্ট ফিল্ড সংক্রান্ত স্টেট
  const [customFields, setCustomFields] = useState<
    { id?: string; field_label: string; field_type: string; options: string; is_required: boolean }[]
  >([])
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEditing && service) {
      fetchExistingCustomFields(service.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchExistingCustomFields = async (serviceId: string) => {
    setCustomFieldsLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('service_custom_fields')
        .select('*')
        .eq('service_id', serviceId)
        .order('display_order', { ascending: true })

      if (fetchError) throw fetchError

      setCustomFields(
        (data || []).map((f: any) => ({
          id: f.id,
          field_label: f.field_label,
          field_type: f.field_type,
          options: (f.options || []).join(', '),
          is_required: f.is_required,
        }))
      )
    } catch (err) {
      console.error('কাস্টম ফিল্ড লোড ত্রুটি:', err)
    } finally {
      setCustomFieldsLoading(false)
    }
  }

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      { field_label: '', field_type: 'text', options: '', is_required: false },
    ])
  }

  const updateCustomField = (index: number, patch: Partial<(typeof customFields)[number]>) => {
    setCustomFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setError('')
    if (!name.trim()) {
      setError('সার্ভিসের নাম আবশ্যক')
      return
    }
    if (!category.trim()) {
      setError('ক্যাটাগরি আবশ্যক')
      return
    }
    if (price < 0) {
      setError('দাম ০ বা তার বেশি হতে হবে')
      return
    }
    if (urgentEnabled && urgentFeeValue <= 0) {
      setError('জরুরি ফি ০ এর বেশি হতে হবে')
      return
    }
    for (const field of customFields) {
      if (!field.field_label.trim()) {
        setError('প্রতিটি কাস্টম ফিল্ডের লেবেল আবশ্যক')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price,
        category: category.trim(),
        is_active: isActive,
        urgent_fee_type: urgentEnabled ? urgentFeeType : null,
        urgent_fee_value: urgentEnabled ? urgentFeeValue : null,
        urgent_delivery_hours: urgentEnabled ? urgentDeliveryHours : null,
      }

      let serviceId = service?.id

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('services')
          .update(payload)
          .eq('id', service!.id)
        if (updateError) throw updateError
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('services')
          .insert(payload)
          .select('id')
          .single()
        if (insertError) throw insertError
        serviceId = inserted.id
      }

      // কাস্টম ফিল্ড সিঙ্ক করুন: পুরনো সব মুছে নতুন করে ইনসার্ট করা সবচেয়ে সহজ ও নিরাপদ পদ্ধতি
      if (serviceId) {
        const { error: deleteError } = await supabase
          .from('service_custom_fields')
          .delete()
          .eq('service_id', serviceId)
        if (deleteError) throw deleteError

        if (customFields.length > 0) {
          const fieldsPayload = customFields.map((f, index) => ({
            service_id: serviceId,
            field_label: f.field_label.trim(),
            field_type: f.field_type,
            options:
              f.field_type === 'select'
                ? f.options.split(',').map((o) => o.trim()).filter(Boolean)
                : null,
            is_required: f.is_required,
            display_order: index,
          }))

          const { error: fieldsInsertError } = await supabase
            .from('service_custom_fields')
            .insert(fieldsPayload)
          if (fieldsInsertError) throw fieldsInsertError
        }
      }

      onSaved()
      onClose()
    } catch (err: any) {
      console.error('সার্ভিস সেভ ত্রুটি:', err)
      setError('সার্ভিস সেভ করতে সমস্যা হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full my-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{isEditing ? 'সার্ভিস এডিট করুন' : 'নতুন সার্ভিস তৈরি করুন'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">সার্ভিসের নাম</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: পাসপোর্ট রিনিউ"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">বিবরণ (ঐচ্ছিক)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="সংক্ষিপ্ত বিবরণ"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">ক্যাটাগরি</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="যেমন: E-Services & Online Work"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">দাম (৳)</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
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
              <span className="font-semibold">সার্ভিসটি সক্রিয় রাখুন (গ্রাহক দেখতে পাবে)</span>
            </label>
          </div>
        </div>

        {/* জরুরি (Urgent) ফি সেকশন — ডায়নামিক প্রাইসিং */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={urgentEnabled}
              onChange={(e) => setUrgentEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-semibold">জরুরি (Urgent) ডেলিভারি অপশন চালু করুন</span>
          </label>

          {urgentEnabled && (
            <div className="grid grid-cols-2 gap-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div>
                <label className="block text-sm font-semibold mb-2">ফি এর ধরন</label>
                <select
                  value={urgentFeeType}
                  onChange={(e) => setUrgentFeeType(e.target.value as 'fixed' | 'percentage')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="fixed">নির্দিষ্ট টাকা (৳)</option>
                  <option value="percentage">শতকরা (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  ফি এর পরিমাণ {urgentFeeType === 'percentage' ? '(%)' : '(৳)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={urgentFeeValue}
                  onChange={(e) => setUrgentFeeValue(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-2">ডেলিভারির সময়সীমা (ঘণ্টা)</label>
                <input
                  type="number"
                  min={1}
                  value={urgentDeliveryHours}
                  onChange={(e) => setUrgentDeliveryHours(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-orange-600 mt-1">
                  গ্রাহক "জরুরি" বেছে নিলে এই সময়ের মধ্যে ডেলিভারি ডেডলাইন সেট হবে
                </p>
              </div>
            </div>
          )}
        </div>

        {/* কাস্টম রিকোয়ারমেন্ট বিল্ডার */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">কাস্টম রিকোয়ারমেন্ট ফিল্ড</span>
            <button
              type="button"
              onClick={addCustomField}
              className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition font-semibold"
            >
              <Plus className="w-4 h-4" /> ফিল্ড যোগ করুন
            </button>
          </div>

          {customFieldsLoading ? (
            <p className="text-sm text-gray-400">লোড হচ্ছে...</p>
          ) : customFields.length === 0 ? (
            <p className="text-sm text-gray-400">
              এই সার্ভিসের জন্য কোনো অতিরিক্ত তথ্য ফিল্ড নেই। অর্ডার ফর্মে গ্রাহকের কাছ থেকে বাড়তি তথ্য নিতে চাইলে ফিল্ড যোগ করুন।
            </p>
          ) : (
            <div className="space-y-3">
              {customFields.map((field, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={field.field_label}
                      onChange={(e) => updateCustomField(index, { field_label: e.target.value })}
                      placeholder="ফিল্ডের নাম (যেমন: বাবার নাম)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <select
                      value={field.field_type}
                      onChange={(e) => updateCustomField(index, { field_type: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="text">ছোট টেক্সট</option>
                      <option value="textarea">বড় টেক্সট</option>
                      <option value="number">সংখ্যা</option>
                      <option value="select">ড্রপডাউন</option>
                      <option value="checkbox">চেকবক্স</option>
                    </select>
                    <label className="flex items-center gap-1 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.is_required}
                        onChange={(e) => updateCustomField(index, { is_required: e.target.checked })}
                        className="w-4 h-4"
                      />
                      আবশ্যক
                    </label>
                  </div>
                  {field.field_type === 'select' && (
                    <input
                      type="text"
                      value={field.options}
                      onChange={(e) => updateCustomField(index, { options: e.target.value })}
                      placeholder="অপশনগুলো কমা দিয়ে লিখুন (যেমন: পুরুষ, মহিলা)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
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
