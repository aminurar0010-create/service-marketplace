import { Loader2 } from 'lucide-react'
import type { ServiceCustomField } from '../../lib/supabase'
import { isValidPhone, normalizePhone } from '../../lib/phone'
import Field from './Field'
import { inputCls, inputErrCls } from './ui'
import type { FieldErrors, OrderValues } from './types'

interface StepDetailsProps {
  values: OrderValues
  errors: FieldErrors
  customFields: ServiceCustomField[]
  optionsLoading: boolean
  onPatch: (p: Partial<OrderValues>) => void
}

export default function StepDetails({ values, errors, customFields, optionsLoading, onPatch }: StepDetailsProps) {
  const cls = (id: string) => `${inputCls} ${errors[id] ? inputErrCls : ''}`
  const setCF = (id: string, value: string) => onPatch({ customFieldValues: { ...values.customFieldValues, [id]: value } })

  return (
    <div>
      <h2 className="text-xl font-bold text-ink-700 mb-1">আপনার তথ্য</h2>
      <p className="text-sm text-gray-500 mb-5">অর্ডারের আপডেট ও ট্র্যাকিংয়ের জন্য নাম ও ফোন নম্বর লাগবে।</p>

      <Field id="order-name" label="সম্পূর্ণ নাম" required error={errors['order-name']}>
        <input
          id="order-name"
          type="text"
          autoComplete="name"
          value={values.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          aria-invalid={!!errors['order-name']}
          className={cls('order-name')}
          placeholder="আপনার সম্পূর্ণ নাম"
        />
      </Field>

      <Field id="order-phone" label="ফোন নম্বর" required error={errors['order-phone']} hint="বাংলা বা ইংরেজি অঙ্কে লিখতে পারেন">
        <input
          id="order-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={(e) => onPatch({ phone: e.target.value })}
          // সঠিক নম্বর হলে ইংরেজি অঙ্কে (01XXXXXXXXX) সাজিয়ে দেয়
          onBlur={() => isValidPhone(values.phone) && onPatch({ phone: normalizePhone(values.phone) })}
          aria-invalid={!!errors['order-phone']}
          className={cls('order-phone')}
          placeholder="01XXXXXXXXX"
        />
      </Field>

      <Field id="order-email" label="ইমেইল (ঐচ্ছিক)" error={errors['order-email']}>
        <input
          id="order-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => onPatch({ email: e.target.value })}
          aria-invalid={!!errors['order-email']}
          className={cls('order-email')}
          placeholder="আপনার ইমেইল"
        />
      </Field>

      {/* সেবা-ভিত্তিক কাস্টম রিকোয়ারমেন্ট ফিল্ড */}
      {optionsLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> অতিরিক্ত তথ্যের ঘর লোড হচ্ছে...
        </div>
      )}
      {!optionsLoading && customFields.length > 0 && (
        <div className="mt-6 pt-5 border-t border-ink-100">
          <p className="text-sm font-semibold text-gray-700 mb-4">অতিরিক্ত তথ্য</p>
          {customFields.map((field) => {
            const id = `order-cf-${field.id}`
            const value = values.customFieldValues[field.id] || ''
            return (
              <Field key={field.id} id={id} label={field.field_label} required={field.is_required} error={errors[id]}>
                {field.field_type === 'textarea' ? (
                  <textarea id={id} value={value} onChange={(e) => setCF(field.id, e.target.value)} className={cls(id)} rows={3} aria-invalid={!!errors[id]} />
                ) : field.field_type === 'select' ? (
                  <select id={id} value={value} onChange={(e) => setCF(field.id, e.target.value)} className={cls(id)} aria-invalid={!!errors[id]}>
                    <option value="">-- নির্বাচন করুন --</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.field_type === 'checkbox' ? (
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      id={id}
                      type="checkbox"
                      checked={value === 'true'}
                      onChange={(e) => setCF(field.id, e.target.checked ? 'true' : '')}
                      className="w-5 h-5"
                    />
                    <span>হ্যাঁ</span>
                  </label>
                ) : (
                  <input
                    id={id}
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    inputMode={field.field_type === 'number' ? 'decimal' : undefined}
                    value={value}
                    onChange={(e) => setCF(field.id, e.target.value)}
                    className={cls(id)}
                    aria-invalid={!!errors[id]}
                  />
                )}
              </Field>
            )
          })}
        </div>
      )}
    </div>
  )
}
