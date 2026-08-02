import { useState } from 'react'
import { supabase, PortfolioProject, logActivity } from '../lib/supabase'
import { X, Image as ImageIcon, Loader2 } from 'lucide-react'

export default function PortfolioFormModal({
  project,
  onClose,
  onSaved,
}: {
  project: PortfolioProject | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!project
  const [title, setTitle] = useState(project?.title || '')
  const [description, setDescription] = useState(project?.description || '')
  const [category, setCategory] = useState(project?.category || '')
  const [liveUrl, setLiveUrl] = useState(project?.live_url || '')
  const [imageUrl, setImageUrl] = useState(project?.image_url || '')
  const [displayOrder, setDisplayOrder] = useState(project?.display_order ?? 0)
  const [isActive, setIsActive] = useState(project?.is_active ?? true)

  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
        .from('portfolio-images')
        .upload(filePath, file, { upsert: false })
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('portfolio-images')
        .getPublicUrl(filePath)

      setImageUrl(publicUrlData.publicUrl)
    } catch (err) {
      console.error('স্ক্রিনশট আপলোড ত্রুটি:', err)
      setImageError('ছবি আপলোড করতে সমস্যা হয়েছে')
    } finally {
      setImageUploading(false)
    }
  }

  const handleSave = async () => {
    setError('')
    if (!title.trim()) {
      setError('প্রজেক্টের নাম আবশ্যক')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        live_url: liveUrl.trim() || null,
        image_url: imageUrl || null,
        display_order: displayOrder,
        is_active: isActive,
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('portfolio_projects')
          .update(payload)
          .eq('id', project!.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('portfolio_projects').insert(payload)
        if (insertError) throw insertError
      }

      logActivity(
        isEditing ? 'পোর্টফোলিও প্রজেক্ট আপডেট করা হয়েছে' : 'নতুন পোর্টফোলিও প্রজেক্ট যোগ করা হয়েছে',
        'portfolio_project',
        title
      )
      onSaved()
      onClose()
    } catch (err) {
      console.error('পোর্টফোলিও সংরক্ষণ ত্রুটি:', err)
      setError('সংরক্ষণ করতে সমস্যা হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">
            {isEditing ? 'প্রজেক্ট এডিট করুন' : 'নতুন প্রজেক্ট যোগ করুন'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">স্ক্রিনশট</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-16 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                {imageUploading ? (
                  <Loader2 className="animate-spin text-gray-400" size={20} />
                ) : imageUrl ? (
                  <img src={imageUrl} alt="প্রিভিউ" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="text-gray-300" size={24} />
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
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                />
                {imageError && <p className="text-red-600 text-xs mt-1">{imageError}</p>}
                <p className="text-gray-400 text-xs mt-1">সর্বোচ্চ ৫MB, JPG/PNG — ওয়েবসাইটের স্ক্রিনশট</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">প্রজেক্টের নাম *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="যেমনঃ M/S AR Traders — হোলসেল অর্ডারিং সিস্টেম"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">বিস্তারিত</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="প্রজেক্টটি সম্পর্কে সংক্ষিপ্ত বিবরণ লিখুন"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">ক্যাটাগরি</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="যেমনঃ ই-কমার্স ওয়েবসাইট, ISP ওয়েবসাইট"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">লাইভ লিংক</label>
            <input
              type="url"
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              placeholder="https://example.vercel.app"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">ক্রম (Order)</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-gray-400 text-xs mt-1">ছোট সংখ্যা আগে দেখানো হবে</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            সক্রিয় (ওয়েবসাইটে দেখানো হবে)
          </label>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
          >
            বাতিল
          </button>
          <button
            onClick={handleSave}
            disabled={saving || imageUploading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            সংরক্ষণ করুন
          </button>
        </div>
      </div>
    </div>
  )
}
