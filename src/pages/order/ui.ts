// অর্ডার ফর্মের সব ধাপে এক রকম ইনপুট/বোতামের ক্লাস (থিমের ink রঙ — সাইটের বাকি অংশের মতো)
export const inputCls =
  'w-full border border-gray-300 rounded-lg px-4 py-3 text-base bg-white outline-none focus:ring-2 focus:ring-ink-400 focus:border-transparent'
export const inputErrCls = 'border-red-400 focus:ring-red-300'
export const cardCls = 'bg-white rounded-2xl shadow-sm border border-ink-100 p-5 sm:p-8'

export const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
