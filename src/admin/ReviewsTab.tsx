import { useEffect, useState } from 'react'
import { Star, Check, X, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { supabase, Review } from '../lib/supabase'

export default function ReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')

  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setReviews(data || [])
    } catch (error) {
      console.error('রিভিউ লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleApproval = async (review: Review) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ is_approved: !review.is_approved })
        .eq('id', review.id)

      if (error) throw error
      fetchReviews()
    } catch (error) {
      console.error('রিভিউ অনুমোদন ত্রুটি:', error)
      alert('রিভিউ অনুমোদন করতে সমস্যা হয়েছে')
    }
  }

  const deleteReview = async (review: Review) => {
    const confirmed = window.confirm('এই রিভিউটি স্থায়ীভাবে মুছে ফেলতে চান?')
    if (!confirmed) return

    try {
      const { error } = await supabase.from('reviews').delete().eq('id', review.id)
      if (error) throw error
      fetchReviews()
    } catch (error) {
      console.error('রিভিউ ডিলিট ত্রুটি:', error)
      alert('রিভিউ মুছতে সমস্যা হয়েছে')
    }
  }

  const filteredReviews = reviews.filter((r) => {
    if (filter === 'pending') return !r.is_approved
    if (filter === 'approved') return r.is_approved
    return true
  })

  const avgRating =
    reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0.0'
  const pendingCount = reviews.filter((r) => !r.is_approved).length

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Star className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">রিভিউ ম্যানেজমেন্ট</h2>
            <p className="text-sm text-gray-500 mt-1">
              গড় রেটিং: <span className="font-semibold text-gray-700">{avgRating} / ৫</span> ({reviews.length}টি রিভিউ)
              {pendingCount > 0 && (
                <span className="ml-2 text-orange-600 font-semibold">{pendingCount}টি অনুমোদনের অপেক্ষায়</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {(['all', 'pending', 'approved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'সব' : f === 'pending' ? 'অপেক্ষমাণ' : 'প্রকাশিত'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">লোড করছি...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="p-12 text-center text-gray-500">কোনো রিভিউ পাওয়া যায়নি</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filteredReviews.map((review) => (
            <div key={review.id} className="p-6 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900">{review.customer_name}</p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      review.is_approved ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {review.is_approved ? 'প্রকাশিত' : 'অপেক্ষমাণ'}
                  </span>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}
                    />
                  ))}
                </div>
                {review.comment && <p className="text-gray-700 text-sm">{review.comment}</p>}
                <p className="text-xs text-gray-400 mt-2">
                  {formatDistanceToNow(new Date(review.created_at), { locale: bn, addSuffix: true })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleApproval(review)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold transition ${
                    review.is_approved
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {review.is_approved ? <X size={14} /> : <Check size={14} />}
                  {review.is_approved ? 'আনপাবলিশ' : 'অনুমোদন'}
                </button>
                <button
                  onClick={() => deleteReview(review)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                  title="মুছে ফেলুন"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
