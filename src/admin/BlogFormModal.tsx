import { useState } from 'react'
import { supabase, BlogPost, logActivity } from '../lib/supabase'
import { X, Loader2 } from 'lucide-react'

const slugify = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\u0980-\u09FFa-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || `post-${Date.now()}`

export default function BlogFormModal({
  post,
  onClose,
  onSaved,
}: {
  post: BlogPost | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!post
  const [title, setTitle] = useState(post?.title || '')
  const [slug, setSlug] = useState(post?.slug || '')
  const [excerpt, setExcerpt] = useState(post?.excerpt || '')
  const [content, setContent] = useState(post?.content || '')
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url || '')
  const [authorName, setAuthorName] = useState(post?.author_name || 'অ্যাডমিন')
  const [isPublished, setIsPublished] = useState(post?.is_published ?? true)
  const [slugTouched, setSlugTouched] = useState(isEditing)
  const [imageUploading, setImageUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('শুধু ছবি ফাইল আপলোড করা যাবে')
      return
    }
    setImageUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `blog/${crypto.randomUUID()}.${ext}`
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

  const handleSave = async () => {
    setError('')
    if (!title.trim() || !content.trim()) {
      setError('শিরোনাম ও কন্টেন্ট আবশ্যক')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        slug: (slug.trim() || slugify(title)).toLowerCase(),
        excerpt: excerpt.trim() || null,
        content: content.trim(),
        cover_image_url: coverImageUrl || null,
        author_name: authorName.trim() || 'অ্যাডমিন',
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      }

      if (isEditing) {
        const { error: updateError } = await supabase.from('blog_posts').update(payload).eq('id', post!.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('blog_posts').insert(payload)
        if (insertError) throw insertError
      }

      logActivity(isEditing ? 'ব্লগ পোস্ট আপডেট করা হয়েছে' : 'নতুন ব্লগ পোস্ট তৈরি হয়েছে', 'blog_post', payload.title)
      onSaved()
      onClose()
    } catch (err: any) {
      console.error('ব্লগ পোস্ট সংরক্ষণ ত্রুটি:', err)
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
          <h3 className="text-lg font-bold">{isEditing ? 'পোস্ট এডিট করুন' : 'নতুন ব্লগ পোস্ট'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">শিরোনাম *</label>
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
              placeholder="my-blog-post"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-gray-400 text-xs mt-1">/blog/{slug || slugify(title)}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">সংক্ষিপ্ত বিবরণ</label>
            <input
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="লিস্টিংয়ে দেখানোর জন্য ছোট বর্ণনা"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
            <label className="block text-sm font-semibold text-gray-700 mb-1">লেখক</label>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">কন্টেন্ট *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="rounded border-gray-300"
            />
            প্রকাশিত (ওয়েবসাইটে দেখানো হবে)
          </label>
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
