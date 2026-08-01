import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, BlogPost } from '../lib/supabase'
import { ArrowLeft } from 'lucide-react'

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .maybeSingle()
        if (!data) {
          setNotFound(true)
        } else {
          setPost(data)
        }
      } catch (error) {
        console.error('ব্লগ পোস্ট লোড ত্রুটি:', error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchPost()
  }, [slug])

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-charcoal/50">লোড করছি...</div>
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4">
        <p className="text-charcoal/60 mb-4">এই পোস্টটি খুঁজে পাওয়া যায়নি</p>
        <Link to="/blog" className="text-ink-600 font-semibold hover:underline">
          ব্লগে ফিরে যান
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-14">
      <div className="max-w-3xl mx-auto">
        <Link to="/blog" className="flex items-center gap-1.5 text-sm text-ink-600 hover:underline mb-6 font-semibold">
          <ArrowLeft size={16} />
          সব ব্লগ পোস্ট
        </Link>

        {post.cover_image_url && (
          <div className="aspect-video bg-ink-50 rounded-xl overflow-hidden mb-8">
            <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <h1 className="text-3xl font-display font-bold text-charcoal mb-2">{post.title}</h1>
        <p className="text-sm text-charcoal/50 mb-8">
          {post.author_name} · {new Date(post.created_at).toLocaleDateString('bn-BD')}
        </p>

        <div className="text-charcoal/80 leading-relaxed whitespace-pre-wrap text-[15px]">{post.content}</div>
      </div>
    </div>
  )
}
