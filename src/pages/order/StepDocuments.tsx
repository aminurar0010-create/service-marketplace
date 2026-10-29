import { X, FileText } from 'lucide-react'
import type { ServiceRequiredDocument } from '../../lib/supabase'
import FilePick from './FilePick'
import { formatSize } from './ui'
import { MAX_EXTRA_FILES, type FieldErrors, type OrderValues } from './types'

interface StepDocumentsProps {
  values: OrderValues
  errors: FieldErrors
  requiredDocs: ServiceRequiredDocument[]
  fileNote: string
  onPatch: (p: Partial<OrderValues>) => void
  onFileNote: (msg: string) => void
}

export default function StepDocuments({ values, errors, requiredDocs, fileNote, onPatch, onFileNote }: StepDocumentsProps) {
  const addExtra = (files: File[]) => {
    const room = MAX_EXTRA_FILES - values.extraFiles.length
    if (files.length > room) {
      onFileNote(`সর্বোচ্চ ${MAX_EXTRA_FILES}টি ফাইল দেওয়া যায়${room > 0 ? ` — প্রথম ${room}টি যোগ হয়েছে` : ''}।`)
    } else {
      onFileNote('')
    }
    if (room > 0) onPatch({ extraFiles: [...values.extraFiles, ...files.slice(0, room)] })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-ink-700 mb-1">ডকুমেন্ট</h2>
      <p className="text-sm text-gray-500 mb-5">
        {requiredDocs.length > 0 ? 'নিচের ডকুমেন্টগুলো আবশ্যিক। চাইলে আরও ফাইল যোগ করতে পারেন।' : 'এই সেবায় আবশ্যিক ডকুমেন্ট নেই। কাজের ফাইল থাকলে এখানে দিন।'}
      </p>

      {requiredDocs.length > 0 && (
        <div className="mb-6 space-y-3">
          {requiredDocs.map((doc) => {
            const id = `order-doc-${doc.id}`
            const err = errors[id]
            return (
              <div key={doc.id} className={`border rounded-lg p-4 ${err ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}>
                <p className="text-sm font-semibold mb-2">{doc.label} *</p>
                <FilePick
                  id={id}
                  accept="image/*,.pdf"
                  file={values.requiredDocFiles[doc.id]}
                  onPick={(files) => onPatch({ requiredDocFiles: { ...values.requiredDocFiles, [doc.id]: files[0] } })}
                />
                {err && (
                  <p role="alert" className="text-sm text-red-600 mt-2">
                    {err}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div>
        <p className="text-sm font-semibold mb-2">{requiredDocs.length > 0 ? 'অতিরিক্ত ডকুমেন্ট (ঐচ্ছিক)' : 'ডকুমেন্ট আপলোড (ঐচ্ছিক)'}</p>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center">
          <FilePick
            id="order-extra-files"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            multiple
            disabled={values.extraFiles.length >= MAX_EXTRA_FILES}
            label="ফাইল বাছাই করুন"
            onPick={addExtra}
          />
          <p className="text-xs text-gray-500 mt-3">PDF, JPG, PNG, DOC ফাইল সমর্থিত (সর্বোচ্চ {MAX_EXTRA_FILES}টি ফাইল)</p>
        </div>
        {fileNote && (
          <p role="status" className="text-sm text-orange-700 mt-2">
            {fileNote}
          </p>
        )}

        {values.extraFiles.length > 0 && (
          <ul className="mt-4 space-y-2">
            {values.extraFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex justify-between items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <span className="flex items-start gap-2 text-sm min-w-0 break-all">
                  <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>
                    {file.name} <span className="text-gray-500">({formatSize(file.size)})</span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onFileNote('')
                    onPatch({ extraFiles: values.extraFiles.filter((_, i) => i !== index) })
                  }}
                  aria-label={`${file.name} সরান`}
                  className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
