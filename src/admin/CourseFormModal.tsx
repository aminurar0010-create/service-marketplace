import { useEffect, useState } from 'react'
import { supabase, Course, CourseModule, logActivity } from '../lib/supabase'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'

const slugify = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\u0980-\u09FFa-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || `course-${Date.now()}`

interface ModuleRow {
  id?: string
  title: string
  description: string
}

export default function CourseFormModal({
  course,
  onClose,
  onSaved,
}: {
  course: Course | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!course
  const [title, setTitle] = useState(course?.title || '')
  const [slug, setSlug] = useState(course?.slug || '')
  const [summary, setSummary] = useState(course?.summary || '')
  const [description, setDescription] = useState(course?.description || '')
  const [durationLabel, setDurationLabel] = useState(course?.duration_label || '')
  const [fee, setFee] = useState(course?.fee?.toString() || '')
  const [coverImageUrl, setCoverImageUrl] = useState(course?.cover_image_url || '')
  const [isActive, setIsActive] = useState(course?.is_active ?? true)
  const [displayOrder, setDisplayOrder] = useState(course?.display_order?.toString() || '0')
  const [slugTouched, setSlugTouched] = useState(isEditing)
  const [imageUploading, setImageUploading] = useState(false)
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [modulesLoading, setModulesLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEditing || !course) return
    const fetchModules = async () => {
      const { data } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', course.id)
        .order('display_order', { ascending: true })
      setModules((data || []).map((m: CourseModule) => ({ id: m.id, title: m.title, description: m.description || '' })))
      setModulesLoading(false)
    }
    fetchModules()
  }, [isEditing, course])

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('শুধু ছবি ফাইল আপলোড করা যাবে')
      return
    }
    setImageUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `courses/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('gallery-images').upload(filePath, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('gallery-images').getPublicUrl(filePath)
      setCoverImageUrl(data.publicUrl)
    } catch (err) {
      console.error('কভার ছবি আপলোড ত্রুটি:', err)
      setError('ছবি আপলোড করতে সমস্যা হয়েছে')
    } finally {
      setImageUploading(false)
    }
  }

  const addModuleRow = () => setModules((prev) => [...prev, { title: '', description: '' }])
  const removeModuleRow = (idx: number) => setModules((prev) => prev.filter((_, i) => i !== idx))
  const updateModuleRow = (idx: number, field: 'title' | 'description', value: string) =>
    setModules((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)))

  const handleSave = async () => {
    setError('')
    if (!title.trim() || !fee.trim()) {
      setError('কোর্সের নাম ও ফি আবশ্যক')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        slug: (slug.trim() || slugify(title)).toLowerCase(),
        summary: summary.trim() || null,
        description: description.trim() || null,
        duration_label: durationLabel.trim() || null,
        fee: parseFloat(fee) || 0,
        cover_image_url: coverImageUrl || null,
        is_active: isActive,
        display_order: parseInt(displayOrder) || 0,
        updated_at: new Date().toISOString(),
      }

      let courseId = course?.id
      if (isEditing) {
        const { error: updateError } = await supabase.from('courses').update(payload).eq('id', course!.id)
        if (updateError) throw updateError
      } else {
        const { data: inserted, error: insertError } = await supabase.from('courses').insert(payload).select('id').single()
        if (insertError) throw insertError
        courseId = inserted.id
      }

      // মডিউল সিঙ্ক করা — পুরনো মুছে নতুন করে লেখা হচ্ছে, সহজ ও নির্ভরযোগ্য পদ্ধতি
      if (courseId) {
        await supabase.from('course_modules').delete().eq('course_id', courseId)
        const validModules = modules.filter((m) => m.title.trim())
        if (validModules.length > 0) {
          const { error: modulesError } = await supabase.from('course_modules').insert(
            validModules.map((m, idx) => ({
              course_id: courseId,
              title: m.title.trim(),
              description: m.description.trim() || null,
              display_order: idx + 1,
            }))
          )
          if (modulesError) throw modulesError
        }
      }

      logActivity(isEditing ? 'কোর্স আপডেট করা হয়েছে' : 'নতুন কোর্স তৈরি হয়েছে', 'course', payload.title)
      onSaved()
      onClose()
    } catch (err: any) {
      console.error('কোর্স সংরক্ষণ ত্রুটি:', err)
      setError(err.message?.includes('duplicate') ? 'এই স্লাগ ইতিমধ্যে ব্যবহৃত হয়েছে, অন্য একটি দিন' : 'সংরক্ষণ করতে সমস্যা হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold">{isEditing ? 'কোর্স এডিট করুন' : 'নতুন কোর্স'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">কোর্সের নাম *</label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">স্লাগ (URL)</label>
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
              placeholder="course-name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-gray-400 text-xs mt-1">/courses/{slug || slugify(title)}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">সংক্ষিপ্ত বিবরণ</label>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="লিস্টিং কার্ডে দেখানো হবে"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">মেয়াদ</label>
              <input
                value={durationLabel}
                onChange={(e) => setDurationLabel(e.target.value)}
                placeholder="৩ মাস"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">কোর্স ফি (৳) *</label>
              <input
                type="number"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">কভার ছবি</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {coverImageUrl && <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file)
                }}
                className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
              />
              {imageUploading && <Loader2 className="animate-spin text-gray-400" size={18} />}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">বিস্তারিত বিবরণ</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">কোর্স মডিউল / সিলেবাস</label>
              <button
                onClick={addModuleRow}
                className="flex items-center gap-1 text-indigo-600 text-xs font-semibold hover:text-indigo-800"
              >
                <Plus size={14} /> মডিউল যোগ করুন
              </button>
            </div>
            {modulesLoading ? (
              <p className="text-gray-400 text-sm">মডিউল লোড হচ্ছে...</p>
            ) : (
              <div className="space-y-2">
                {modules.length === 0 && <p className="text-gray-400 text-xs">এখনো কোনো মডিউল যোগ করা হয়নি</p>}
                {modules.map((m, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-gray-400 text-xs mt-2.5 w-4">{idx + 1}.</span>
                    <div className="flex-1 space-y-1">
                      <input
                        value={m.title}
                        onChange={(e) => updateModuleRow(idx, 'title', e.target.value)}
                        placeholder="মডিউলের নাম (যেমন: MS Word)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        value={m.description}
                        onChange={(e) => updateModuleRow(idx, 'description', e.target.value)}
                        placeholder="সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button onClick={() => removeModuleRow(idx)} className="text-red-400 hover:text-red-600 mt-2">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">প্রদর্শন ক্রম</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              সক্রিয় (ওয়েবসাইটে দেখানো হবে)
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
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
