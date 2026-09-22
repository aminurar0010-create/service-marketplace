import { useState } from 'react'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase, Course } from '../lib/supabase'

export default function EnrollmentModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!fullName.trim() || !phone.trim()) {
      setError('নাম ও মোবাইল নম্বর আবশ্যক')
      return
    }
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('enrollments').insert({
        course_id: course.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        message: message.trim() || null,
      })
      if (insertError) throw insertError
      setDone(true)
    } catch (err) {
      console.error('ভর্তির আবেদন সংরক্ষণ ত্রুটি:', err)
      setError('আবেদন সাবমিট করতে সমস্যা হয়েছে, দয়া করে আবার চেষ্টা করুন')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-charcoal">এখনই ভর্তি হোন</h3>
            <p className="text-sm text-charcoal/50">{course.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="text-seal mx-auto mb-3" size={44} />
            <h4 className="font-bold text-charcoal mb-1">আবেদন গ্রহণ করা হয়েছে!</h4>
            <p className="text-charcoal/60 text-sm mb-6">
              আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে।
            </p>
            <button
              onClick={onClose}
              className="bg-ink-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-ink-700 transition"
            >
              বন্ধ করুন
            </button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">পুরো নাম *</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">মোবাইল নম্বর *</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ইমেইল</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ঠিকানা</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">মন্তব্য</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-500"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex items-center justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
                বাতিল
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 bg-ink-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-ink-700 transition disabled:opacity-50"
              >
                {saving && <Loader2 className="animate-spin" size={16} />}
                আবেদন সাবমিট করুন
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
