import { useEffect } from 'react'

// প্রতিটা পেজ (বিশেষ করে সার্ভিস/ব্লগ/পোর্টফোলিও ডিটেইল পেজ) নিজের title + meta description
// সেট করলে Google প্রতিটা পেজকে আলাদা আলাদা কীওয়ার্ডে ইনডেক্স করতে পারে —
// এতে কেউ কোনো নির্দিষ্ট সার্ভিসের নাম সার্চ করলে সরাসরি সেই পেজটাই দেখাবে।
//
// ফেজ ৪-ঙ: একই সঙ্গে সোশ্যাল শেয়ারের og:* ট্যাগ, canonical লিংক এবং (ঐচ্ছিক) পেজ-ভিত্তিক JSON-LD।
// আগের ব্যবহার (শুধু title, description) অপরিবর্তিত কাজ করে।
export interface SEOOptions {
  /** og:image — পূর্ণ URL (না দিলে index.html-এর ডিফল্ট লোগো থাকে) */
  image?: string | null
  /** পেজ-ভিত্তিক স্ট্রাকচার্ড ডেটা (যেমন সার্ভিসের জন্য schema.org/Service) */
  jsonLd?: Record<string, unknown> | null
}

const JSON_LD_ID = 'page-jsonld'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.querySelector(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

export function useSEO(title?: string, description?: string, options?: SEOOptions) {
  const image = options?.image
  const jsonLdText = options?.jsonLd ? JSON.stringify(options.jsonLd) : ''

  useEffect(() => {
    if (title) {
      document.title = title
      setMeta('property', 'og:title', title)
    }
    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
    }
    // শুধু আসল পেজ (title দেওয়া) হলে canonical/og:url বসাই — নিজের URL-ই, কোনো প্যারামিটার ছাড়া
    if (title) {
      const url = `${window.location.origin}${window.location.pathname}`
      setMeta('property', 'og:url', url)
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.setAttribute('rel', 'canonical')
        document.head.appendChild(link)
      }
      link.setAttribute('href', url)
    }
    if (image) setMeta('property', 'og:image', image)

    let script: HTMLScriptElement | null = null
    if (jsonLdText) {
      script = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.type = 'application/ld+json'
        script.id = JSON_LD_ID
        document.head.appendChild(script)
      }
      script.textContent = jsonLdText
    }

    return () => {
      // পেজ ছাড়লে এই পেজের স্ট্রাকচার্ড ডেটা সরে যায় (অন্য পেজে যেন না থাকে)
      if (script && script.parentNode) script.parentNode.removeChild(script)
    }
  }, [title, description, image, jsonLdText])
}
