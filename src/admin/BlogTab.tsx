import { useEffect, useState } from 'react'
import { supabase, BlogPost, logActivity } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { Newspaper, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import BlogFormModal from './BlogFormModal'

export default function BlogTab() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BlogPost | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      console.error('ব্লগ লোড ত্রুটি:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async (post: BlogPost) => {
    try {
      await supabase.from('blog_posts').update({ is_published: !post.is_published }).eq('id', post.id)
      logActivity(post.is_published ? 'ব্লগ পোস্ট আনপাবলিশ করা হয়েছে' : 'ব্লগ পোস্ট পাবলিশ করা হয়েছে', 'blog_post', post.title)
      fetchPosts()
    } catch (error) {
      console.error('স্ট্যাটাস পরিবর্তন ত্রুটি:', error)
    }
  }

  const deletePost = async (post: BlogPost) => {
    if (!confirm(`"${post.title}" পোস্টটি ডিলিট করতে চান?`)) return
    try {
      await supabase.from('blog_posts').delete().eq('id', post.id)
      logActivity('ব্লগ পোস্ট ডিলিট করা হয়েছে', 'blog_post', post.title)
      fetchPosts()
    } catch (error) {
      console.error('ডিলিট ত্রুটি:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Newspaper className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">ব্লগ ম্যানেজমেন্ট</h2>
            <p className="text-sm text-gray-500 mt-1">ব্লগ পোস্ট তৈরি, এডিট বা প্রকাশ/অপ্রকাশ করুন</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowModal(true)
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <Plus size={16} />
          নতুন পোস্ট
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-center text-gray-500 py-8">লোড করছি...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-500 py-8">কোনো পোস্ট পাওয়া যায়নি</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100 rounded-lg p-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800">{post.title}</p>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        post.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {post.is_published ? 'প্রকাশিত' : 'খসড়া'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    /blog/{post.slug} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: bn })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePublish(post)}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    {post.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                    {post.is_published ? 'আনপাবলিশ' : 'পাবলিশ'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(post)
                      setShowModal(true)
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600"
                  >
                    <Pencil size={13} />
                    এডিট
                  </button>
                  <button
                    onClick={() => deletePost(post)}
                    className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={13} />
                    ডিলিট
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <BlogFormModal
          post={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onSaved={fetchPosts}
        />
      )}
    </div>
  )
}
