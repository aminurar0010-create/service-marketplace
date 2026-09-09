import { useEffect } from 'react'

// প্রতিটা পেজ (বিশেষ করে সার্ভিস/ব্লগ/পোর্টফোলিও ডিটেইল পেজ) নিজের title + meta description
// সেট করলে Google প্রতিটা পেজকে আলাদা আলাদা কীওয়ার্ডে ইনডেক্স করতে পারে —
// এতে কেউ কোনো নির্দিষ্ট সার্ভিসের নাম সার্চ করলে সরাসরি সেই পেজটাই দেখাবে।
export function useSEO(title?: string, description?: string) {
  useEffect(() => {
    if (title) document.title = title

    if (description) {
      let tag = document.querySelector('meta[name="description"]')
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('name', 'description')
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', description)
    }
  }, [title, description])
}
