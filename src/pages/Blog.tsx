import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, BlogPost } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { Newspaper } from 'lucide-react'

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
        setPosts(data || [])
      } catch (error) {
        console.error('ব্লগ লোড ত্রুটি:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [])

  return (
    <div className="min-h-screen bg-paper px-4 py-14">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="w-12 h-12 bg-ink-600 rounded-full flex items-center justify-center text-white mx-auto mb-4">
            <Newspaper size={22} />
          </div>
          <h1 className="text-3xl font-display font-bold text-charcoal">ব্লগ ও আপডেট</h1>
          <p className="text-charcoal/60 mt-2">আমাদের সেবা, টিপস ও সর্বশেষ খবর</p>
        </div>

        {loading ? (
          <p className="text-center text-charcoal/50 py-12">লোড করছি...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-charcoal/50 py-12">এখনো কোনো ব্লগ পোস্ট প্রকাশিত হয়নি</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="bg-white rounded-xl shadow-sm border border-ink-100 overflow-hidden hover:shadow-md transition group"
              >
                {post.cover_image_url && (
                  <div className="aspect-video bg-ink-50 overflow-hidden">
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h2 className="font-display font-bold text-charcoal text-lg leading-snug group-hover:text-ink-700 transition">
                    {post.title}
                  </h2>
                  {post.excerpt && <p className="text-charcoal/60 text-sm mt-2 line-clamp-2">{post.excerpt}</p>}
                  <p className="text-xs text-charcoal/40 mt-3">
                    {post.author_name} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: bn })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
