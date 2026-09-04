import { useEffect, useState } from 'react'
import { supabase, Service, ServiceCustomField, ServiceRequiredDocument, ProductVariant, CouponValidationResult, CreateOrderResult } from '../lib/supabase'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Upload, CheckCircle, Tag, X, Zap, Copy, Check } from 'lucide-react'
import DeliveryEstimate from '../components/DeliveryEstimate'

export default function OrderForm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [trackingId, setTrackingId] = useState('')
  const [finalAmountPaid, setFinalAmountPaid] = useState(0)

  const [formData, setFormData] = useState({
    service_id: searchParams.get('service') || '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    payment_method: 'bkash',
    documents: [] as File[],
  })

  // কুপন সংক্রান্ত স্টেট
  const [couponInput, setCouponInput] = useState('')
  const [couponChecking, setCouponChecking] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discount_amount: number
    final_amount: number
  } | null>(null)
  const [couponMessage, setCouponMessage] = useState<{ text: string; ok: boolean } | null>(null)

  // জরুরি (urgent) ডেলিভারি সংক্রান্ত স্টেট
  const [isUrgent, setIsUrgent] = useState(false)

  // বিকাশ ট্রানজেকশন আইডি সংক্রান্ত স্টেট (শুধু যেসব সার্ভিসে বিকাশ-অনলি পেমেন্ট সেট করা আছে)
  const [transactionId, setTransactionId] = useState('')
  const [numberCopied, setNumberCopied] = useState(false)

  // কাস্টম রিকোয়ারমেন্ট ফিল্ড সংক্রান্ত স্টেট
  const [customFields, setCustomFields] = useState<ServiceCustomField[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false)

  // প্রয়োজনীয় ডকুমেন্ট সংক্রান্ত স্টেট — প্রতিটার জন্য আলাদা আপলোড স্লট
  const [requiredDocs, setRequiredDocs] = useState<ServiceRequiredDocument[]>([])
  const [requiredDocFiles, setRequiredDocFiles] = useState<Record<string, File | null>>({})
  const [requiredDocsLoading, setRequiredDocsLoading] = useState(false)

  // প্রোডাক্ট ভ্যারিয়েন্ট (সাইজ/কালার) সংক্রান্ত স্টেট
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [selectedVariantByGroup, setSelectedVariantByGroup] = useState<Record<string, ProductVariant>>({})
  const [variantsLoading, setVariantsLoading] = useState(false)

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('সার্ভিস লোড ত্রুটি:', error)
    }
  }

  const selectedService = services.find((s) => s.id === formData.service_id)

  // নির্বাচিত ভ্যারিয়েন্টগুলোর দামের পার্থক্য যোগ করে সাবটোটাল হিসাব
  const variantsDelta = Object.values(selectedVariantByGroup).reduce(
    (sum, v) => sum + (v.price_delta || 0),
    0
  )
  const totalAmount = (selectedService?.price || 0) + variantsDelta

  // ভ্যারিয়েন্টগুলোকে গ্রুপ অনুযায়ী সাজানো (যেমন: 'সাইজ' গ্রুপে XL, L, M)
  const variantGroups = variants.reduce((acc: Record<string, ProductVariant[]>, v) => {
    if (!acc[v.variant_group]) acc[v.variant_group] = []
    acc[v.variant_group].push(v)
    return acc
  }, {})

  // কোনো ভ্যারিয়েন্ট সিলেক্ট থাকলে তার ছবি, নাহলে সার্ভিসের ডিফল্ট ছবি
  const previewImageUrl =
    Object.values(selectedVariantByGroup).find((v) => v.image_url)?.image_url || selectedService?.image_url

  // এই সার্ভিসের জন্য urgent fee এর হিসাব (দেখানোর জন্য, চূড়ান্ত হিসাব সার্ভারে হবে)
  const estimatedUrgentFee = (() => {
    if (!isUrgent || !selectedService?.urgent_fee_type || !selectedService?.urgent_fee_value) return 0
    if (selectedService.urgent_fee_type === 'percentage') {
      return Math.round((totalAmount * selectedService.urgent_fee_value) / 100)
    }
    return selectedService.urgent_fee_value
  })()

  // সার্ভিস বদলালে সেই সার্ভিসের custom fields লোড করুন
  useEffect(() => {
    setIsUrgent(false)
    setCustomFieldValues({})
    setSelectedVariantByGroup({})
    setTransactionId('')
    setRequiredDocFiles({})
    if (!formData.service_id) {
      setCustomFields([])
      setVariants([])
      setRequiredDocs([])
      return
    }
    fetchCustomFields(formData.service_id)
    fetchVariants(formData.service_id)
    fetchRequiredDocs(formData.service_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.service_id])

  // এই সার্ভিসে বিকাশ-অনলি পেমেন্ট বাধ্যতামূলক থাকলে পেমেন্ট মেথড স্বয়ংক্রিয়ভাবে 'bkash' এ লক করে দিন
  useEffect(() => {
    if (selectedService?.payment_bkash_number && formData.payment_method !== 'bkash') {
      setFormData((prev) => ({ ...prev, payment_method: 'bkash' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService?.payment_bkash_number])

  const fetchVariants = async (serviceId: string) => {
    setVariantsLoading(true)
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('service_id', serviceId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) throw error
      setVariants(data || [])
    } catch (error) {
      console.error('ভ্যারিয়েন্ট লোড ত্রুটি:', error)
      setVariants([])
    } finally {
      setVariantsLoading(false)
    }
  }

  const fetchCustomFields = async (serviceId: string) => {
    setCustomFieldsLoading(true)
    try {
      const { data, error } = await supabase
        .from('service_custom_fields')
        .select('*')
        .eq('service_id', serviceId)
        .order('display_order', { ascending: true })

      if (error) throw error
      setCustomFields(data || [])
    } catch (error) {
      console.error('কাস্টম ফিল্ড লোড ত্রুটি:', error)
      setCustomFields([])
    } finally {
      setCustomFieldsLoading(false)
    }
  }

  const fetchRequiredDocs = async (serviceId: string) => {
    setRequiredDocsLoading(true)
    try {
      const { data, error } = await supabase
        .from('service_required_documents')
        .select('*')
        .eq('service_id', serviceId)
        .order('display_order', { ascending: true })

      if (error) throw error
      setRequiredDocs(data || [])
    } catch (error) {
      console.error('প্রয়োজনীয় ডকুমেন্ট লোড ত্রুটি:', error)
      setRequiredDocs([])
    } finally {
      setRequiredDocsLoading(false)
    }
  }

  // সার্ভিস বা ফোন নম্বর বদলালে আগের প্রয়োগ করা কুপন বাতিল হয়ে যাবে
  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null)
      setCouponMessage(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.service_id, formData.customer_phone])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, ...files],
    }))
  }

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }))
  }

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return

    if (!formData.service_id) {
      setCouponMessage({ text: 'প্রথমে একটি সেবা নির্বাচন করুন', ok: false })
      return
    }
    if (!formData.customer_phone) {
      setCouponMessage({ text: 'কুপন যাচাই করতে ফোন নম্বর দিন', ok: false })
      return
    }

    setCouponChecking(true)
    setCouponMessage(null)

    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: couponInput.trim(),
        p_service_id: formData.service_id,
        p_order_amount: totalAmount,
        p_customer_phone: formData.customer_phone,
      })

      if (error) throw error

      const result = data as CouponValidationResult

      if (result.valid) {
        setAppliedCoupon({
          code: couponInput.trim().toUpperCase(),
          discount_amount: result.discount_amount || 0,
          final_amount: result.final_amount ?? totalAmount,
        })
        setCouponMessage({ text: result.message, ok: true })
      } else {
        setAppliedCoupon(null)
        setCouponMessage({ text: result.message, ok: false })
      }
    } catch (error) {
      console.error('কুপন যাচাই ত্রুটি:', error)
      setCouponMessage({ text: 'কুপন যাচাই করতে ব্যর্থ। আবার চেষ্টা করুন।', ok: false })
    } finally {
      setCouponChecking(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.service_id || !formData.customer_name || !formData.customer_phone) {
      alert('সকল প্রয়োজনীয় ক্ষেত্র পূরণ করুন')
      return
    }

    // আবশ্যিক (required) কাস্টম ফিল্ড পূরণ হয়েছে কিনা যাচাই করুন
    for (const field of customFields) {
      if (field.is_required && !customFieldValues[field.id]?.trim()) {
        alert(`দয়া করে "${field.field_label}" পূরণ করুন`)
        return
      }
    }

    // বিকাশ-অনলি সার্ভিসে ট্রানজেকশন আইডি বাধ্যতামূলক
    if (selectedService?.payment_bkash_number && !transactionId.trim()) {
      alert('দয়া করে বিকাশ ট্রানজেকশন আইডি দিন')
      return
    }

    // প্রয়োজনীয় ডকুমেন্ট সবগুলো আপলোড হয়েছে কিনা যাচাই করুন
    for (const doc of requiredDocs) {
      if (!requiredDocFiles[doc.id]) {
        alert(`দয়া করে "${doc.label}" আপলোড করুন`)
        return
      }
    }

    setLoading(true)

    try {
      // ডকুমেন্ট আপলোড করুন
      const uploadedDocs = []
      for (const file of formData.documents) {
        const fileName = `${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('order-documents')
          .upload(`${formData.customer_phone}/${fileName}`, file)

        if (!uploadError) {
          uploadedDocs.push({
            name: file.name,
            path: `${formData.customer_phone}/${fileName}`,
            size: file.size,
          })
        }
      }

      // নির্দিষ্ট প্রয়োজনীয় ডকুমেন্টগুলো (label ট্যাগ সহ) আপলোড করুন
      for (const doc of requiredDocs) {
        const file = requiredDocFiles[doc.id]
        if (!file) continue
        const fileName = `${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('order-documents')
          .upload(`${formData.customer_phone}/${fileName}`, file)

        if (!uploadError) {
          uploadedDocs.push({
            name: file.name,
            path: `${formData.customer_phone}/${fileName}`,
            size: file.size,
            label: doc.label,
          })
        }
      }

      // কাস্টম ফিল্ডের উত্তরগুলো গুছিয়ে নিন
      const customFieldResponses = customFields
        .filter((field) => customFieldValues[field.id]?.trim())
        .map((field) => ({
          field_id: field.id,
          label: field.field_label,
          value: customFieldValues[field.id],
        }))

      // অর্ডার তৈরি করুন (RLS bypass করা SECURITY DEFINER ফাংশন দিয়ে)
      const { data, error } = await supabase.rpc('create_order', {
        p_service_id: formData.service_id,
        p_customer_name: formData.customer_name,
        p_customer_phone: formData.customer_phone,
        p_customer_email: formData.customer_email || null,
        p_payment_method: formData.payment_method,
        p_documents: uploadedDocs,
        p_total_amount: totalAmount,
        p_coupon_code: appliedCoupon?.code || null,
        p_is_urgent: isUrgent,
        p_custom_field_responses: customFieldResponses,
      })

      if (error) throw error

      const result = data as CreateOrderResult

      if (!result.success) {
        alert(result.message || 'কুপন প্রয়োগ করা যায়নি। দয়া করে কুপন ছাড়া আবার চেষ্টা করুন।')
        setLoading(false)
        return
      }

      if (result.tracking_id) {
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session?.user) {
          await supabase.rpc('link_order_to_customer', { p_tracking_id: result.tracking_id })
        }

        // নির্বাচিত ভ্যারিয়েন্ট থাকলে অর্ডারের সাথে সেভ করুন
        const selectedVariantsList = Object.values(selectedVariantByGroup).map((v) => ({
          group: v.variant_group,
          value: v.variant_value,
          price_delta: v.price_delta,
        }))
        if (selectedVariantsList.length > 0) {
          await supabase.rpc('save_order_variants', {
            p_tracking_id: result.tracking_id,
            p_selected_variants: selectedVariantsList,
          })
        }

        // বিকাশ ট্রানজেকশন আইডি থাকলে অর্ডারের সাথে সেভ করুন
        if (transactionId.trim()) {
          await supabase.rpc('set_order_transaction_id', {
            p_tracking_id: result.tracking_id,
            p_transaction_id: transactionId.trim(),
          })
        }
      }

      setTrackingId(result.tracking_id || '')
      setFinalAmountPaid(result.final_amount ?? totalAmount)
      setSubmitted(true)
      setFormData({
        service_id: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        payment_method: 'bkash',
        documents: [],
      })
      setAppliedCoupon(null)
      setCouponInput('')
      setCouponMessage(null)
      setIsUrgent(false)
      setCustomFieldValues({})
      setSelectedVariantByGroup({})
      setTransactionId('')
      setRequiredDocFiles({})
    } catch (error) {
      console.error('অর্ডার সৃষ্টি ত্রুটি:', error)
      alert('অর্ডার তৈরি করতে ব্যর্থ। দয়া করে পরে চেষ্টা করুন।')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">অর্ডার সফল!</h2>
          <p className="text-gray-600 mb-6">
            আপনার অর্ডার সফলভাবে তৈরি হয়েছে।
          </p>
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-500 mb-2">আপনার ট্র্যাকিং নম্বর:</p>
            <p className="text-2xl font-bold text-indigo-600 font-mono">{trackingId}</p>
          </div>
          <p className="text-gray-600 mb-2">
            পরিশোধযোগ্য মোট পরিমাণ:
          </p>
          <p className="text-xl font-bold text-gray-800 mb-6">৳{finalAmountPaid}</p>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/tracking')}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              ট্র্যাকিং চেক করুন
            </button>
            <button
              onClick={() => {
                setSubmitted(false)
                window.scrollTo(0, 0)
              }}
              className="w-full border border-indigo-600 text-indigo-600 py-2 rounded-lg hover:bg-indigo-50 transition"
            >
              নতুন অর্ডার তৈরি করুন
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">নতুন অর্ডার তৈরি করুন</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
        {/* সেবা নির্বাচন */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">সেবা নির্বাচন করুন *</label>
          <select
            value={formData.service_id}
            onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">-- একটি সেবা বেছে নিন --</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} (৳{service.price})
              </option>
            ))}
          </select>
        </div>

        {/* প্রোডাক্ট ছবি প্রিভিউ — ভ্যারিয়েন্ট বদলালে ছবিও বদলাবে */}
        {previewImageUrl && (
          <div className="mb-6">
            <img
              src={previewImageUrl}
              alt={selectedService?.name || ''}
              className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
            />
          </div>
        )}

        {/* প্রোডাক্ট ভ্যারিয়েন্ট নির্বাচন — সাইজ/কালার ইত্যাদি */}
        {!variantsLoading && Object.keys(variantGroups).length > 0 && (
          <div className="mb-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700">অপশন নির্বাচন করুন</p>
            {Object.entries(variantGroups).map(([group, options]) => (
              <div key={group}>
                <label className="block text-sm font-semibold mb-2">{group}</label>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => {
                    const isSelected = selectedVariantByGroup[group]?.id === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setSelectedVariantByGroup((prev) => ({ ...prev, [group]: option }))
                        }
                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {option.variant_value}
                        {option.price_delta !== 0 && (
                          <span className={`ml-1 text-xs ${isSelected ? 'text-indigo-100' : 'text-gray-400'}`}>
                            ({option.price_delta > 0 ? '+' : ''}৳{option.price_delta})
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* নাম */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">সম্পূর্ণ নাম *</label>
          <input
            type="text"
            required
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="আপনার সম্পূর্ণ নাম"
          />
        </div>

        {/* ফোন নম্বর */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">ফোন নম্বর *</label>
          <input
            type="tel"
            required
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="০১X XXXX XXXX"
          />
        </div>

        {/* ইমেইল */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">ইমেইল (ঐচ্ছিক)</label>
          <input
            type="email"
            value={formData.customer_email}
            onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="আপনার ইমেইল"
          />
        </div>

        {/* জরুরি (urgent) ডেলিভারি অপশন — শুধু যেসব সার্ভিসে urgent fee সেট করা আছে সেখানে দেখাবে */}
        {selectedService?.urgent_fee_type && selectedService?.urgent_fee_value ? (
          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="w-4 h-4 mt-1"
              />
              <span>
                <span className="flex items-center gap-1 font-semibold text-orange-700">
                  <Zap className="w-4 h-4" />
                  জরুরি (Urgent) ডেলিভারি
                  {selectedService.urgent_delivery_hours ? ` — ${selectedService.urgent_delivery_hours} ঘণ্টার মধ্যে` : ''}
                </span>
                <span className="block text-sm text-orange-600 mt-1">
                  অতিরিক্ত ফি: {selectedService.urgent_fee_type === 'percentage'
                    ? `${selectedService.urgent_fee_value}%`
                    : `৳${selectedService.urgent_fee_value}`}
                </span>
              </span>
            </label>
          </div>
        ) : null}

        {/* ডেলিভারি টাইম ক্যালকুলেটর — সার্ভিস বাছাই করলে আনুমানিক ডেলিভারি সময় দেখাবে */}
        {selectedService && (
          <DeliveryEstimate
            estimatedHours={selectedService.estimated_hours}
            isUrgent={isUrgent}
            urgentHours={selectedService.urgent_delivery_hours}
          />
        )}

        {/* কাস্টম রিকোয়ারমেন্ট ফিল্ড — সার্ভিস ভিত্তিক ডায়নামিক ফর্ম */}
        {!customFieldsLoading && customFields.length > 0 && (
          <div className="mb-6 space-y-4">
            <p className="text-sm font-semibold text-gray-700">অতিরিক্ত তথ্য</p>
            {customFields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm font-semibold mb-2">
                  {field.field_label} {field.is_required && '*'}
                </label>
                {field.field_type === 'textarea' ? (
                  <textarea
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) =>
                      setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={3}
                  />
                ) : field.field_type === 'select' ? (
                  <select
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) =>
                      setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">-- নির্বাচন করুন --</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.field_type === 'checkbox' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customFieldValues[field.id] === 'true'}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          [field.id]: e.target.checked ? 'true' : '',
                        }))
                      }
                      className="w-4 h-4"
                    />
                    <span>হ্যাঁ</span>
                  </label>
                ) : (
                  <input
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) =>
                      setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* পেমেন্ট পদ্ধতি */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">পেমেন্ট পদ্ধতি *</label>

          {selectedService?.payment_bkash_number ? (
            <div className="bg-pink-50 border border-pink-300 rounded-lg p-4 space-y-3">
              <p className="text-sm text-pink-800">
                এই সেবার জন্য পেমেন্ট শুধুমাত্র <span className="font-semibold">বিকাশ (পার্সোনাল)</span> নম্বরে
                গ্রহণযোগ্য।
              </p>
              <div className="flex items-center justify-between bg-white border border-pink-200 rounded-lg px-4 py-3">
                <div>
                  <p className="text-xs text-gray-500">বিকাশ পার্সোনাল নম্বর</p>
                  <p className="text-lg font-bold text-pink-700 font-mono">
                    {selectedService.payment_bkash_number}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedService.payment_bkash_number || '')
                    setNumberCopied(true)
                    setTimeout(() => setNumberCopied(false), 2000)
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 transition"
                >
                  {numberCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {numberCopied ? 'কপি হয়েছে' : 'কপি করুন'}
                </button>
              </div>
              <p className="text-xs text-pink-700">
                উপরের নম্বরে "Send Money" করে নিচে ট্রানজেকশন আইডি দিন, তারপর অর্ডার সাবমিট করুন।
              </p>

              <div>
                <label className="block text-sm font-semibold mb-2">বিকাশ ট্রানজেকশন আইডি *</label>
                <input
                  type="text"
                  required
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent uppercase"
                  placeholder="যেমনঃ 9G7H8J2K1L"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {['bkash', 'nagad', 'rocket'].map((method) => (
                <label key={method} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value={method}
                    checked={formData.payment_method === method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  />
                  <span className="font-semibold">
                    {method === 'bkash' && 'বিকাশ'}
                    {method === 'nagad' && 'নগদ'}
                    {method === 'rocket' && 'রকেট'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* নির্দিষ্ট প্রয়োজনীয় ডকুমেন্ট — সার্ভিসে টেমপ্লেট সেট করা থাকলে প্রতিটার জন্য আলাদা আপলোড স্লট */}
        {!requiredDocsLoading && requiredDocs.length > 0 && (
          <div className="mb-6 space-y-3">
            <label className="block text-sm font-semibold">প্রয়োজনীয় ডকুমেন্ট *</label>
            {requiredDocs.map((doc) => (
              <div key={doc.id} className="border border-gray-300 rounded-lg p-3">
                <p className="text-sm font-semibold mb-2">{doc.label} *</p>
                <input
                  type="file"
                  required
                  accept="image/*,.pdf"
                  onChange={(e) =>
                    setRequiredDocFiles((prev) => ({
                      ...prev,
                      [doc.id]: e.target.files?.[0] || null,
                    }))
                  }
                  className="text-sm w-full"
                />
                {requiredDocFiles[doc.id] && (
                  <p className="text-xs text-green-600 mt-1">✓ {requiredDocFiles[doc.id]!.name}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ডকুমেন্ট আপলোড */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">ডকুমেন্ট আপলোড করুন</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-indigo-600 font-semibold">ফাইল বাছাই করুন</span> বা ড্র্যাগ করুন
            </label>
            <p className="text-sm text-gray-500 mt-2">
              PDF, JPG, PNG, DOC ফাইল সমর্থিত (সর্বোচ্চ ৫ ফাইল)
            </p>
          </div>

          {formData.documents.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="font-semibold">আপলোড করা ফাইলসমূহ:</p>
              {formData.documents.map((file, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                  <span className="text-sm">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-700 font-semibold"
                  >
                    সরান
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* কুপন কোড */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">কুপন কোড (ঐচ্ছিক)</label>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-300 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-700">{appliedCoupon.code}</span>
                <span className="text-sm text-green-700">
                  (-৳{appliedCoupon.discount_amount} ছাড়)
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-gray-500 hover:text-red-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase"
                placeholder="কুপন কোড লিখুন"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={couponChecking || !couponInput.trim()}
                className="bg-gray-800 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {couponChecking ? 'যাচাই হচ্ছে...' : 'প্রয়োগ করুন'}
              </button>
            </div>
          )}
          {couponMessage && (
            <p className={`text-sm mt-2 ${couponMessage.ok ? 'text-green-600' : 'text-red-600'}`}>
              {couponMessage.text}
            </p>
          )}
        </div>

        {/* মূল্য সারসংক্ষেপ */}
        {selectedService && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">সাবটোটাল:</span>
              <span className="font-semibold">৳{totalAmount}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between items-center text-green-600">
                <span>ছাড় ({appliedCoupon.code}):</span>
                <span className="font-semibold">-৳{appliedCoupon.discount_amount}</span>
              </div>
            )}
            {isUrgent && estimatedUrgentFee > 0 && (
              <div className="flex justify-between items-center text-orange-600">
                <span>জরুরি ফি:</span>
                <span className="font-semibold">+৳{estimatedUrgentFee}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-gray-200 pt-2">
              <span className="font-semibold">মোট পরিমাণ (আনুমানিক):</span>
              <span className="text-2xl font-bold text-indigo-600">
                ৳{(appliedCoupon ? appliedCoupon.final_amount : totalAmount) + (isUrgent ? estimatedUrgentFee : 0)}
              </span>
            </div>
          </div>
        )}

        {/* সাবমিট বাটন */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'অর্ডার তৈরি করছি...' : 'অর্ডার তৈরি করুন'}
        </button>
      </form>
    </div>
  )
}
