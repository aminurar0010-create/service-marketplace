import { useState, useEffect } from 'react'
import { supabase, Service, logActivity } from '../lib/supabase'
import { Plus, Trash2, X, Image as ImageIcon, Loader2 } from 'lucide-react'

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

  // সার্ভিসের ছবি সংক্রান্ত স্টেট
  const [imageUrl, setImageUrl] = useState(service?.image_url || '')
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState('')

  // জরুরি (urgent) ফি সংক্রান্ত স্টেট
  const [estimatedHours, setEstimatedHours] = useState(service?.estimated_hours ?? 24)
  const [urgentEnabled, setUrgentEnabled] = useState(!!service?.urgent_fee_type)
  const [urgentFeeType, setUrgentFeeType] = useState<'fixed' | 'percentage'>(
    service?.urgent_fee_type === 'percentage' ? 'percentage' : 'fixed'
  )
  const [urgentFeeValue, setUrgentFeeValue] = useState(service?.urgent_fee_value ?? 0)
  const [urgentDeliveryHours, setUrgentDeliveryHours] = useState(service?.urgent_delivery_hours ?? 24)

  // বিকাশ-অনলি পেমেন্ট সংক্রান্ত স্টেট — সেট করলে এই সার্ভিসে শুধু বিকাশ (পার্সোনাল) দেখাবে + ট্রানজেকশন আইডি বাধ্যতামূলক হবে
  const [bkashOnlyEnabled, setBkashOnlyEnabled] = useState(!!service?.payment_bkash_number)
  const [bkashNumber, setBkashNumber] = useState(service?.payment_bkash_number || '')

  // কাস্টম রিকোয়ারমেন্ট ফিল্ড সংক্রান্ত স্টেট
  const [customFields, setCustomFields] = useState<
    { id?: string; field_label: string; field_type: string; options: string; is_required: boolean }[]
  >([])
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false)

  // প্রোডাক্ট ভ্যারিয়েন্ট (সাইজ/কালার ইত্যাদি) সংক্রান্ত স্টেট
  const [variants, setVariants] = useState<
    { id?: string; variant_group: string; variant_value: string; price_delta: number; image_url: string }[]
  >([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [variantImageUploadingIndex, setVariantImageUploadingIndex] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEditing && service) {
      fetchExistingCustomFields(service.id)
      fetchExistingVariants(service.id)
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

  const fetchExistingVariants = async (serviceId: string) => {
    setVariantsLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('product_variants')
        .select('*')
        .eq('service_id', serviceId)
        .order('display_order', { ascending: true })

      if (fetchError) throw fetchError

      setVariants(
        (data || []).map((v: any) => ({
          id: v.id,
          variant_group: v.variant_group,
          variant_value: v.variant_value,
          price_delta: v.price_delta,
          image_url: v.image_url || '',
        }))
      )
    } catch (err) {
      console.error('ভ্যারিয়েন্ট লোড ত্রুটি:', err)
    } finally {
      setVariantsLoading(false)
    }
  }

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      { variant_group: '', variant_value: '', price_delta: 0, image_url: '' },
    ])
  }

  const updateVariant = (index: number, patch: Partial<(typeof variants)[number]>) => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  const handleVariantImageUpload = async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    setVariantImageUploadingIndex(index)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `variants/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(filePath, file, { upsert: false })
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('service-images')
        .getPublicUrl(filePath)

      updateVariant(index, { image_url: publicUrlData.publicUrl })
    } catch (err) {
      console.error('ভ্যারিয়েন্ট ছবি আপলোড ত্রুটি:', err)
    } finally {
      setVariantImageUploadingIndex(null)
    }
  }

  const handleImageUpload = async (file: File) => {
    setImageError('')
    if (!file.type.startsWith('image/')) {
      setImageError('শুধু ছবি ফাইল আপলোড করা যাবে')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('ছবির সাইজ ৫MB এর কম হতে হবে')
      return
    }

    setImageUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(filePath, file, { upsert: false })
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('service-images')
        .getPublicUrl(filePath)

      setImageUrl(publicUrlData.publicUrl)
    } catch (err) {
      console.error('ছবি আপলোড ত্রুটি:', err)
      setImageError('ছবি আপলোড করতে সমস্যা হয়েছে')
    } finally {
      setImageUploading(false)
    }
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
    if (bkashOnlyEnabled && !bkashNumber.trim()) {
      setError('বিকাশ পার্সোনাল নম্বরটি দিন')
      return
    }
    for (const field of customFields) {
      if (!field.field_label.trim()) {
        setError('প্রতিটি কাস্টম ফিল্ডের লেবেল আবশ্যক')
        return
      }
    }
    for (const variant of variants) {
      if (!variant.variant_group.trim() || !variant.variant_value.trim()) {
        setError('প্রতিটি ভ্যারিয়েন্টের গ্রুপ ও ভ্যালু আবশ্যক')
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
        image_url: imageUrl || null,
        estimated_hours: estimatedHours > 0 ? estimatedHours : null,
        urgent_fee_type: urgentEnabled ? urgentFeeType : null,
        urgent_fee_value: urgentEnabled ? urgentFeeValue : null,
        urgent_delivery_hours: urgentEnabled ? urgentDeliveryHours : null,
        payment_bkash_number: bkashOnlyEnabled ? bkashNumber.trim() : null,
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

        // ভ্যারিয়েন্ট সিঙ্ক করুন: একই পদ্ধতি — পুরনো সব মুছে নতুন করে ইনসার্ট
        const { error: variantsDeleteError } = await supabase
          .from('product_variants')
          .delete()
          .eq('service_id', serviceId)
        if (variantsDeleteError) throw variantsDeleteError

        if (variants.length > 0) {
          const variantsPayload = variants.map((v, index) => ({
            service_id: serviceId,
            variant_group: v.variant_group.trim(),
            variant_value: v.variant_value.trim(),
            price_delta: v.price_delta,
            image_url: v.image_url || null,
            display_order: index,
          }))

          const { error: variantsInsertError } = await supabase
            .from('product_variants')
            .insert(variantsPayload)
          if (variantsInsertError) throw variantsInsertError
        }
      }

      logActivity(isEditing ? 'সার্ভিস আপডেট করা হয়েছে' : 'নতুন সার্ভিস তৈরি করা হয়েছে', 'service', name.trim())
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

          <div className="col-span-2">
            <label className="block text-sm font-semibold mb-2">সার্ভিসের ছবি (ঐচ্ছিক)</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-lg border border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {imageUploading ? (
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                ) : imageUrl ? (
                  <img src={imageUrl} alt="সার্ভিসের ছবি" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-300" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImageUpload(file)
                  }}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-semibold hover:file:bg-indigo-100"
                />
                <p className="text-xs text-gray-400 mt-1">না দিলে কার্ডে ডিফল্ট আইকন দেখাবে। সর্বোচ্চ ৫MB।</p>
                {imageError && <p className="text-xs text-red-500 mt-1">{imageError}</p>}
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    ছবি সরিয়ে দিন
                  </button>
                )}
              </div>
            </div>
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

          <div>
            <label className="block text-sm font-semibold mb-2">সাধারণ ডেলিভারি সময় (ঘণ্টা)</label>
            <input
              type="number"
              min={0}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
              placeholder="যেমন: ২৪"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-1">গ্রাহককে "আনুমানিক ডেলিভারি" হিসেবে দেখানো হবে</p>
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

        {/* বিকাশ-অনলি পেমেন্ট সেকশন — শুধু এই সার্ভিসের জন্য নির্দিষ্ট পার্সোনাল বিকাশ নম্বরে পেমেন্ট বাধ্যতামূলক করুন */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={bkashOnlyEnabled}
              onChange={(e) => setBkashOnlyEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-semibold">শুধুমাত্র বিকাশ (পার্সোনাল) পেমেন্ট বাধ্যতামূলক করুন</span>
          </label>

          {bkashOnlyEnabled && (
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
              <label className="block text-sm font-semibold mb-2">বিকাশ পার্সোনাল নম্বর</label>
              <input
                type="text"
                value={bkashNumber}
                onChange={(e) => setBkashNumber(e.target.value)}
                placeholder="01968673241"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-pink-700 mt-1">
                চালু করলে অর্ডার ফর্মে নগদ/রকেট অপশন হাইড হয়ে যাবে, শুধু এই নম্বরটি দেখানো হবে এবং গ্রাহককে
                বিকাশ ট্রানজেকশন আইডি দেওয়া বাধ্যতামূলক হবে।
              </p>
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

        {/* প্রোডাক্ট ভ্যারিয়েন্ট (সাইজ/কালার/ম্যাটেরিয়াল) ক্যাটালগ */}
        <div className="border-t border-gray-200 pt-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">প্রোডাক্ট ভ্যারিয়েন্ট (সাইজ, কালার ইত্যাদি)</span>
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition font-semibold"
            >
              <Plus className="w-4 h-4" /> ভ্যারিয়েন্ট যোগ করুন
            </button>
          </div>

          {variantsLoading ? (
            <p className="text-sm text-gray-400">লোড হচ্ছে...</p>
          ) : variants.length === 0 ? (
            <p className="text-sm text-gray-400">
              এই প্রোডাক্টের সাইজ, কালার বা ম্যাটেরিয়ালের মতো ভিন্ন ভিন্ন অপশন থাকলে (প্রতিটার আলাদা দাম ও ছবিসহ) এখানে যোগ করুন। যেমন: T-shirt এর জন্য "সাইজ: XL" (+৳৫০) বা "কালার: লাল"।
            </p>
          ) : (
            <div className="space-y-3">
              {variants.map((variant, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={variant.variant_group}
                      onChange={(e) => updateVariant(index, { variant_group: e.target.value })}
                      placeholder="গ্রুপ (যেমন: সাইজ)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      value={variant.variant_value}
                      onChange={(e) => updateVariant(index, { variant_value: e.target.value })}
                      placeholder="ভ্যালু (যেমন: XL)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">দামের পার্থক্য (৳, বাড়াতে + বা কমাতে −)</label>
                      <input
                        type="number"
                        value={variant.price_delta}
                        onChange={(e) => updateVariant(index, { price_delta: Number(e.target.value) })}
                        placeholder="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">ভ্যারিয়েন্টের ছবি (ঐচ্ছিক)</label>
                      <div className="flex items-center gap-2">
                        {variant.image_url && (
                          <img
                            src={variant.image_url}
                            alt={variant.variant_value}
                            className="w-9 h-9 rounded object-cover border border-gray-200 flex-shrink-0"
                          />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleVariantImageUpload(index, file)
                          }}
                          className="block w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-semibold hover:file:bg-indigo-100"
                        />
                      </div>
                      {variantImageUploadingIndex === index && (
                        <p className="text-xs text-indigo-500 mt-1">আপলোড হচ্ছে...</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || imageUploading || variantImageUploadingIndex !== null}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving
              ? 'সেভ হচ্ছে...'
              : imageUploading || variantImageUploadingIndex !== null
              ? 'ছবি আপলোড হচ্ছে...'
              : 'সেভ করুন'}
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
