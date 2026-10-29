import type { ReactNode } from 'react'

interface FieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

// লেবেল + ইনপুট + ত্রুটি-বার্তা (ইনপুটের ঠিক নিচে, লাল)
export default function Field({ id, label, required, error, hint, children }: FieldProps) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="block text-sm font-semibold mb-2">
        {label}
        {required && ' *'}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  )
}
