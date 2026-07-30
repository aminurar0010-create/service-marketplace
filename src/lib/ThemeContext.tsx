import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, SiteSettings } from './supabase'
import { applyTheme, DEFAULT_THEME } from './theme'

interface ThemeContextValue {
  settings: SiteSettings | null
  loading: boolean
  refreshSettings: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue>({
  settings: null,
  loading: true,
  refreshSettings: async () => {},
})

export function useSiteSettings() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      if (data) {
        setSettings(data)
        applyTheme(data)
      } else {
        applyTheme(DEFAULT_THEME)
      }
    } catch (error) {
      // site_settings টেবিল এখনো তৈরি না হয়ে থাকলে (ফেজ ৪ মাইগ্রেশন রান করা হয়নি)
      // ডিফল্ট থিমেই সাইট চলবে, কোনো ক্র্যাশ হবে না
      console.warn('সাইট সেটিংস লোড করা যায়নি, ডিফল্ট থিম ব্যবহার হচ্ছে:', error)
      applyTheme(DEFAULT_THEME)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()

    const subscription = supabase
      .channel('site-settings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => {
        fetchSettings()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </ThemeContext.Provider>
  )
}
