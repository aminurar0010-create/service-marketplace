import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase, Service, ProductVariant, CouponValidationResult, CreateOrderResult } from '../lib/supabase'
import { isValidPhone, normalizePhone } from '../lib/phone'
import { calcPricing } from './order/pricing'
import { validateAll, validateStep, usesBkash } from './order/validation'
import { clearDraft, readDraft, useOrderDraft, type OrderDraft } from './order/useOrderDraft'
import { useServiceOptions } from './order/useServiceOptions'
import { STEPS, emptyValues, type AppliedCoupon, type FieldErrors, type OrderValues, type StepId } from './order/types'
import { cardCls } from './order/ui'
import StepIndicator from './order/StepIndicator'
import StepNav from './order/StepNav'
import DraftBanner from './order/DraftBanner'
import StepService from './order/StepService'
import StepDetails from './order/StepDetails'
import StepDocuments from './order/StepDocuments'
import StepPayment from './order/StepPayment'
import StepReview from './order/StepReview'
import OrderSuccess from './order/OrderSuccess'

interface UploadedDoc {
  name: string
  path: string
  size: number
  label?: string
}

// ফেজ ৫ — অর্ডার ফর্ম ধাপে ধাপে: সেবা → তথ্য → ডকুমেন্ট → পেমেন্ট → নিশ্চিত।
// এই ফাইলে শুধু অবস্থা ও জমা দেওয়ার লজিক; প্রতিটি ধাপের পর্দা ./order/ ফোল্ডারে।
// সার্ভারের create_order-এর ডাকা ও ফলাফল আগের মতোই।
export default function OrderForm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const urlService = searchParams.get('service') || ''

  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState(false)

  const [values, setValues] = useState<OrderValues>(() => emptyValues(urlService))
  const [step, setStep] = useState<StepId>('service')
  const [maxStepIdx, setMaxStepIdx] = useState(0)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [fileNote, setFileNote] = useState('')

  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
  const [couponMessage, setCouponMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [couponChecking, setCouponChecking] = useState(false)

  const [loading, setLoading] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<{ trackingId: string; amount: number; warnings: string[] } | null>(null)

  // আগের অসমাপ্ত খসড়া (অন্য সেবার লিংক থেকে এলে দেখানো হয় না)
  const [pendingDraft, setPendingDraft] = useState<OrderDraft | null>(() => {
    const d = readDraft()
    if (!d || (urlService && d.serviceId !== urlService)) return null
    return d
  })
  const pendingVariantChoices = useRef<Record<string, string> | null>(null)
  const uploadCache = useRef(new Map<File, UploadedDoc>()) // ব্যর্থ চেষ্টার পর আবার একই ফাইল আপলোড হবে না
  const topRef = useRef<HTMLDivElement>(null)

  const patch = useCallback((p: Partial<OrderValues>) => setValues((v) => ({ ...v, ...p })), [])

  // ---------- সেবার তালিকা ----------
  const fetchServices = useCallback(async () => {
    setServicesLoading(true)
    setServicesError(false)
    try {
      const { data, error } = await supabase.from('services').select('*').eq('is_active', true)
      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('সার্ভিস লোড ত্রুটি:', error)
      setServicesError(true)
    } finally {
      setServicesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  // লিংকের ?service=... এখন আর সক্রিয় নয় (বা ভুল) হলে বাদ দিই — না হলে অদৃশ্য সেবা নিয়ে অর্ডার যেত
  useEffect(() => {
    if (servicesLoading || servicesError || !values.serviceId) return
    if (!services.some((s) => s.id === values.serviceId)) patch({ serviceId: '' })
  }, [servicesLoading, servicesError, services, values.serviceId, patch])

  const selectedService = services.find((s) => s.id === values.serviceId)
  const opts = useServiceOptions(selectedService ? selectedService.id : '')

  const variantGroups = useMemo(
    () =>
      opts.variants.reduce((acc: Record<string, ProductVariant[]>, v) => {
        if (!acc[v.variant_group]) acc[v.variant_group] = []
        acc[v.variant_group].push(v)
        return acc
      }, {}),
    [opts.variants]
  )

  const previewImageUrl = Object.values(values.variantByGroup).find((v) => v.image_url)?.image_url || selectedService?.image_url
  const pricing = calcPricing(selectedService, values.variantByGroup, values.isUrgent, appliedCoupon)

  // সেবা বদলালে তার নিচের সব নির্ভরশীল ঘর পরিষ্কার (আগের ফর্মের মতোই)
  const handleServiceChange = (id: string) => {
    setValues((v) => ({
      ...v,
      serviceId: id,
      isUrgent: false,
      customFieldValues: {},
      variantByGroup: {},
      transactionId: '',
      requiredDocFiles: {},
    }))
    setErrors({})
  }

  // বিকাশ-অনলি সেবায় মেথড 'bkash'-এ লক; অন্য সেবায় গেলে 'bkash' থেকে 'qr'-এ ফেরে
  // (আগে ফিরত না — ফলে মেথড 'bkash' থেকেও ট্রানজেকশন আইডি ছাড়াই অর্ডার যেতে পারত)
  useEffect(() => {
    if (!selectedService) return
    if (usesBkash(selectedService) && values.paymentMethod !== 'bkash') patch({ paymentMethod: 'bkash' })
    else if (!usesBkash(selectedService) && values.paymentMethod === 'bkash') patch({ paymentMethod: 'qr' })
  }, [selectedService, values.paymentMethod, patch])

  // সেবা, ফোন বা সাবটোটাল বদলালে আগের কুপন বাতিল (দাম বদলালে ছাড়ও বদলায়)
  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null)
      setCouponMessage({ text: 'দাম/তথ্য বদলেছে — কুপন আবার প্রয়োগ করুন', ok: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.serviceId, values.phone, pricing.subtotal])

  // খসড়া থেকে ফেরানো ভ্যারিয়েন্ট বাছাই — সেবার ভ্যারিয়েন্ট লোড হলে বসে
  useEffect(() => {
    if (!pendingVariantChoices.current || !opts.ready) return
    const choices = pendingVariantChoices.current
    pendingVariantChoices.current = null
    const next: Record<string, ProductVariant> = {}
    Object.entries(choices).forEach(([group, value]) => {
      const match = opts.variants.find((v) => v.variant_group === group && v.variant_value === value)
      if (match) next[group] = match
    })
    if (Object.keys(next).length) patch({ variantByGroup: next })
  }, [opts.ready, opts.variants, patch])

  // মাঝপথে সেভ (খসড়ার প্রশ্নের উত্তর না দেওয়া পর্যন্ত ও সফল হওয়ার পর বন্ধ)
  useOrderDraft(values, step, !pendingDraft && !result)

  // ---------- নেভিগেশন ----------
  const stepIdx = STEPS.findIndex((s) => s.id === step)

  const scrollToTop = () => requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))

  const goTo = (idx: number) => {
    setStep(STEPS[idx].id)
    setMaxStepIdx((m) => Math.max(m, idx))
    setErrors({})
    setSubmitError('')
    setFileNote('')
    scrollToTop()
  }

  const showErrors = (errs: FieldErrors) => {
    setErrors(errs)
    const firstId = Object.keys(errs)[0]
    requestAnimationFrame(() => {
      const el = document.getElementById(firstId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus?.()
    })
  }

  const ctx = {
    values,
    service: selectedService,
    customFields: opts.customFields,
    requiredDocs: opts.requiredDocs,
    optionsLoading: opts.loading,
    optionsError: opts.error,
  }

  const handleNext = () => {
    const errs = validateStep(step, ctx)
    if (Object.keys(errs).length > 0) return showErrors(errs)
    goTo(stepIdx + 1)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (step !== 'review') return handleNext()
    void submitOrder()
  }

  // ---------- খসড়া ----------
  const resumeDraft = () => {
    const d = pendingDraft
    if (!d) return
    const exists = services.some((s) => s.id === d.serviceId)
    pendingVariantChoices.current = exists ? d.variantChoices : null
    setValues({
      ...emptyValues(exists ? d.serviceId : ''),
      name: d.name,
      phone: d.phone,
      email: d.email,
      paymentMethod: d.paymentMethod,
      isUrgent: exists ? d.isUrgent : false,
      customFieldValues: exists ? d.customFieldValues : {},
      couponInput: d.couponInput,
      transactionId: d.transactionId,
    })
    const idx = exists ? Math.max(0, STEPS.findIndex((s) => s.id === d.step)) : 0
    setStep(STEPS[idx].id)
    setMaxStepIdx(idx)
    setPendingDraft(null)
    scrollToTop()
  }

  const discardDraft = () => {
    clearDraft()
    setPendingDraft(null)
  }

  // ---------- কুপন ----------
  const handleApplyCoupon = async () => {
    const code = values.couponInput.trim()
    if (!code) return
    if (!values.serviceId) return setCouponMessage({ text: 'প্রথমে একটি সেবা নির্বাচন করুন', ok: false })
    if (!isValidPhone(values.phone)) return setCouponMessage({ text: 'কুপন যাচাই করতে সঠিক ফোন নম্বর দিন (তথ্য ধাপে)', ok: false })

    setCouponChecking(true)
    setCouponMessage(null)
    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: code,
        p_service_id: values.serviceId,
        p_order_amount: pricing.subtotal,
        p_customer_phone: normalizePhone(values.phone),
      })
      if (error) throw error
      const r = data as CouponValidationResult
      if (r.valid) {
        setAppliedCoupon({ code: code.toUpperCase(), discount_amount: r.discount_amount || 0, final_amount: r.final_amount ?? pricing.subtotal })
        setCouponMessage({ text: r.message, ok: true })
      } else {
        setAppliedCoupon(null)
        setCouponMessage({ text: r.message, ok: false })
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
    patch({ couponInput: '' })
    setCouponMessage(null)
  }

  // ---------- জমা দেওয়া ----------
  const resetAll = () => {
    setValues(emptyValues())
    setStep('service')
    setMaxStepIdx(0)
    setErrors({})
    setAppliedCoupon(null)
    setCouponMessage(null)
    setSubmitError('')
    setFileNote('')
    uploadCache.current.clear()
  }

  const submitOrder = async () => {
    if (!selectedService) return

    // ধাপ এড়িয়ে (ট্যাপ করে বা খসড়া থেকে) এসে থাকলেও সব ধাপ আবার যাচাই
    const problem = validateAll(ctx)
    if (problem) {
      const idx = STEPS.findIndex((s) => s.id === problem.step)
      setStep(problem.step)
      setMaxStepIdx((m) => Math.max(m, idx))
      setSubmitError('')
      showErrors(problem.errors)
      return
    }

    setLoading(true)
    setSubmitError('')
    const warnings: string[] = []

    try {
      const phone = normalizePhone(values.phone)

      // ১) ডকুমেন্ট আপলোড — আগে (সাধারণ ফাইল) তারপর (নির্দিষ্ট ডকুমেন্ট, লেবেলসহ), আগের ক্রমেই।
      // কোনো ফাইল আপলোড না হলে অর্ডার তৈরি হয় না (আগে ব্যর্থ ফাইল চুপচাপ বাদ পড়ত)।
      const queue: { file: File; label?: string }[] = [
        ...values.extraFiles.map((file) => ({ file })),
        ...opts.requiredDocs.flatMap((doc) => {
          const file = values.requiredDocFiles[doc.id]
          return file ? [{ file, label: doc.label }] : []
        }),
      ]
      const uploadedDocs: UploadedDoc[] = []
      for (let i = 0; i < queue.length; i++) {
        const { file, label } = queue[i]
        setProgressText(`ফাইল আপলোড হচ্ছে (${i + 1}/${queue.length})...`)
        let up = uploadCache.current.get(file)
        if (!up) {
          // স্টোরেজ-কী শুধু ইংরেজি অক্ষর/অঙ্ক (বাংলা নাম বা বিশেষ চিহ্ন থাকলে আপলোড ব্যর্থ হতো); দেখানোর নাম আসল
          const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_')
          const path = `${phone}/${Date.now()}_${i}_${safe}`
          const { error: uploadError } = await supabase.storage.from('order-documents').upload(path, file)
          if (uploadError) {
            console.error('ফাইল আপলোড ত্রুটি:', uploadError)
            setSubmitError(`"${file.name}" আপলোড হয়নি। ইন্টারনেট দেখে আবার "অর্ডার নিশ্চিত করুন" চাপুন — আগে যা আপলোড হয়েছে তা আবার পাঠাতে হবে না।`)
            setLoading(false)
            setProgressText('')
            return
          }
          up = { name: file.name, path, size: file.size }
          uploadCache.current.set(file, up)
        }
        uploadedDocs.push(label ? { ...up, label } : up)
      }

      // ২) কাস্টম ফিল্ডের উত্তর
      const customFieldResponses = opts.customFields
        .filter((f) => values.customFieldValues[f.id]?.trim())
        .map((f) => ({ field_id: f.id, label: f.field_label, value: values.customFieldValues[f.id] }))

      // ৩) অর্ডার তৈরি (SECURITY DEFINER ফাংশন) — প্যারামিটার আগের মতোই
      setProgressText('অর্ডার তৈরি করছি...')
      const { data, error } = await supabase.rpc('create_order', {
        p_service_id: values.serviceId,
        p_customer_name: values.name.trim(),
        p_customer_phone: phone,
        p_customer_email: values.email.trim() || null,
        p_payment_method: values.paymentMethod,
        p_documents: uploadedDocs,
        p_total_amount: pricing.subtotal,
        p_coupon_code: appliedCoupon?.code || null,
        p_is_urgent: values.isUrgent,
        p_custom_field_responses: customFieldResponses,
      })
      if (error) throw error

      const r = data as CreateOrderResult
      if (!r.success) {
        setSubmitError(r.message || 'কুপন প্রয়োগ করা যায়নি। পেমেন্ট ধাপ থেকে কুপন সরিয়ে আবার চেষ্টা করুন।')
        setLoading(false)
        setProgressText('')
        return
      }

      // ৪) অর্ডার হয়ে গেছে; নিচের ধাপগুলো ব্যর্থ হলে অর্ডার বাতিল নয় — ব্যবহারকারীকে জানানো হয়
      if (r.tracking_id) {
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          if (sessionData.session?.user) {
            await supabase.rpc('link_order_to_customer', { p_tracking_id: r.tracking_id })
          }
        } catch (e) {
          console.error('অ্যাকাউন্টে অর্ডার যুক্ত ত্রুটি:', e)
        }

        const variantList = Object.values(values.variantByGroup).map((v) => ({ group: v.variant_group, value: v.variant_value, price_delta: v.price_delta }))
        if (variantList.length > 0) {
          try {
            const { error: vErr } = await supabase.rpc('save_order_variants', { p_tracking_id: r.tracking_id, p_selected_variants: variantList })
            if (vErr) throw vErr
          } catch (e) {
            console.error('ভ্যারিয়েন্ট সেভ ত্রুটি:', e)
            warnings.push('আপনার বাছাই করা অপশন (সাইজ/কালার ইত্যাদি) অর্ডারে সেভ হয়নি।')
          }
        }

        if (values.transactionId.trim()) {
          try {
            const { error: tErr } = await supabase.rpc('set_order_transaction_id', { p_tracking_id: r.tracking_id, p_transaction_id: values.transactionId.trim() })
            if (tErr) throw tErr
          } catch (e) {
            console.error('ট্রানজেকশন আইডি সেভ ত্রুটি:', e)
            warnings.push('পেমেন্টের ট্রানজেকশন আইডি অর্ডারে সেভ হয়নি।')
          }
        }
      }

      clearDraft()
      setResult({ trackingId: r.tracking_id || '', amount: r.final_amount ?? pricing.subtotal, warnings })
      resetAll()
    } catch (error) {
      console.error('অর্ডার সৃষ্টি ত্রুটি:', error)
      setSubmitError('অর্ডার তৈরি করতে ব্যর্থ। ইন্টারনেট দেখে আবার চেষ্টা করুন।')
    } finally {
      setLoading(false)
      setProgressText('')
    }
  }

  // ---------- পর্দা ----------
  if (result) {
    return (
      <OrderSuccess
        trackingId={result.trackingId}
        amount={result.amount}
        warnings={result.warnings}
        onTrack={() => navigate('/tracking')}
        onNew={() => {
          setResult(null)
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  const draftServiceName = pendingDraft ? services.find((s) => s.id === pendingDraft.serviceId)?.name : undefined

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4">
      <div ref={topRef} className="scroll-mt-24" />
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">নতুন অর্ডার তৈরি করুন</h1>

      {pendingDraft && (
        <DraftBanner
          serviceName={draftServiceName}
          savedAt={pendingDraft.savedAt}
          canResume={!servicesLoading}
          onResume={resumeDraft}
          onDiscard={discardDraft}
        />
      )}

      <StepIndicator current={stepIdx} maxReached={maxStepIdx} onGo={goTo} />

      <form onSubmit={onSubmit} noValidate className={cardCls}>
        {step === 'service' && (
          <StepService
            services={services}
            servicesLoading={servicesLoading}
            servicesError={servicesError}
            onRetryServices={fetchServices}
            values={values}
            errors={errors}
            selectedService={selectedService}
            variantGroups={variantGroups}
            previewImageUrl={previewImageUrl}
            optionsLoading={opts.loading}
            optionsError={opts.error}
            onRetryOptions={opts.retry}
            onServiceChange={handleServiceChange}
            onPatch={patch}
          />
        )}
        {step === 'details' && (
          <StepDetails values={values} errors={errors} customFields={opts.customFields} optionsLoading={opts.loading} onPatch={patch} />
        )}
        {step === 'documents' && (
          <StepDocuments values={values} errors={errors} requiredDocs={opts.requiredDocs} fileNote={fileNote} onPatch={patch} onFileNote={setFileNote} />
        )}
        {step === 'payment' && (
          <StepPayment
            values={values}
            errors={errors}
            service={selectedService}
            coupon={appliedCoupon}
            couponMessage={couponMessage}
            couponChecking={couponChecking}
            pricing={pricing}
            onPatch={patch}
            onApplyCoupon={handleApplyCoupon}
            onRemoveCoupon={handleRemoveCoupon}
          />
        )}
        {step === 'review' && (
          <StepReview
            values={values}
            service={selectedService}
            requiredDocs={opts.requiredDocs}
            coupon={appliedCoupon}
            pricing={pricing}
            submitError={submitError}
            onEdit={(s) => goTo(STEPS.findIndex((x) => x.id === s))}
          />
        )}

        <StepNav
          isFirst={stepIdx === 0}
          isLast={step === 'review'}
          loading={loading}
          loadingText={progressText || 'অপেক্ষা করুন...'}
          onBack={() => goTo(stepIdx - 1)}
        />
      </form>
    </div>
  )
}
