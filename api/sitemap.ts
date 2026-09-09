import { createClient } from '@supabase/supabase-js'

// এই ফাইলটা Vercel Serverless Function — /sitemap.xml রিকোয়েস্ট এলে (vercel.json এর
// rewrite দিয়ে) এখানে আসে, আর প্রতিবার লাইভ Supabase ডেটা থেকে সব সার্ভিস/ব্লগ/পোর্টফোলিও
// URL নিয়ে XML সাইটম্যাপ বানিয়ে দেয় — তাই নতুন সার্ভিস যোগ করলেই সাইটম্যাপ অটোমেটিক আপডেট
// হয়ে যায়, আলাদা করে কিছু রিজেনারেট করতে হয় না।

const SITE_URL = 'https://service-marketplace-jade.vercel.app'

export default async function handler(req: any, res: any) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY as string
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const [{ data: services }, { data: posts }, { data: projects }] = await Promise.all([
      supabase.from('services').select('id, created_at').eq('is_active', true),
      supabase.from('blog_posts').select('slug, updated_at').eq('is_published', true),
      supabase.from('portfolio_projects').select('id, created_at').eq('is_active', true),
    ])

    const staticPages = ['', '/order', '/tracking', '/blog', '/prompts']

    const urls: { loc: string; lastmod?: string }[] = [
      ...staticPages.map((p) => ({ loc: `${SITE_URL}${p}` })),
      ...(services || []).map((s: any) => ({ loc: `${SITE_URL}/service/${s.id}`, lastmod: s.created_at })),
      ...(posts || []).map((p: any) => ({ loc: `${SITE_URL}/blog/${p.slug}`, lastmod: p.updated_at })),
      ...(projects || []).map((p: any) => ({ loc: `${SITE_URL}/portfolio/${p.id}`, lastmod: p.created_at })),
    ]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`

    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    res.status(200).send(xml)
  } catch (error) {
    console.error('সাইটম্যাপ তৈরি ত্রুটি:', error)
    res.status(500).send('সাইটম্যাপ তৈরি করা যায়নি')
  }
}
