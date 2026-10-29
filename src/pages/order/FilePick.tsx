import { Upload, CheckCircle } from 'lucide-react'
import { formatSize } from './ui'

interface FilePickProps {
  id: string
  accept: string
  file?: File | null
  multiple?: boolean
  disabled?: boolean
  label?: string
  onPick: (files: File[]) => void
}

// ব্রাউজারের ডিফল্ট ফাইল-ইনপুট ধাপ বদলালে "No file chosen" দেখাত, যদিও ফাইল রাখা আছে।
// এখানে ইনপুট লুকানো, বোতাম-লেবেল দেখা যায়; বাছা ফাইলের নাম ও সাইজ নিজে দেখানো হয়।
export default function FilePick({ id, accept, file, multiple, disabled, label, onPick }: FilePickProps) {
  return (
    <div>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only peer"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (files.length) onPick(files)
          e.target.value = '' // একই ফাইল আবার বাছা যাবে
        }}
      />
      <label
        htmlFor={id}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold cursor-pointer transition peer-focus-visible:ring-2 peer-focus-visible:ring-ink-400 ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400'
            : 'border-ink-600 text-ink-600 hover:bg-ink-50'
        }`}
      >
        <Upload className="w-4 h-4" />
        {label || (file ? 'বদলান' : 'ফাইল বাছাই করুন')}
      </label>
      {file && (
        <p className="text-sm text-green-700 mt-2 flex items-start gap-1.5 break-all">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {file.name} <span className="text-gray-500">({formatSize(file.size)})</span>
          </span>
        </p>
      )}
    </div>
  )
}
