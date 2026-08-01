import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogIn, AlertCircle, CheckCircle2, UserPlus, KeyRound } from 'lucide-react'

type Mode = 'login' | 'register' | 'forgot'

export default function CustomerLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const resetMessages = () => {
    setError('')
    setMessage('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      const { data: customer } = await supabase
        .from('customers')
        .select('is_blocked')
        .eq('id', data.user?.id)
        .maybeSingle()

      if (customer?.is_blocked) {
        await supabase.auth.signOut()
        setError('আপনার অ্যাকাউন্টটি সাময়িকভাবে ব্লক করা হয়েছে। সহায়তার জন্য যোগাযোগ করুন।')
        return
      }

      navigate('/account')
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।' : (err.message || 'লগইন ব্যর্থ হয়েছে।'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError

      if (data.user) {
        const { error: profileError } = await supabase.from('customers').insert({
          id: data.user.id,
          full_name: fullName,
          phone,
          email,
        })
        if (profileError) throw profileError
      }

      if (data.session) {
        navigate('/account')
      } else {
        setMessage('অ্যাকাউন্ট তৈরি হয়েছে! আপনার ইমেইল যাচাই করে লগইন করুন।')
        setMode('login')
      }
    } catch (err: any) {
      setError(err.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMessages()
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/account`,
      })
      if (resetError) throw resetError
      setMessage('পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে।')
    } catch (err: any) {
      setError(err.message || 'রিসেট লিংক পাঠাতে ব্যর্থ হয়েছে।')
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: Mode; label: string; icon: any }[] = [
    { id: 'login', label: 'লগইন', icon: LogIn },
    { id: 'register', label: 'রেজিস্ট্রেশন', icon: UserPlus },
    { id: 'forgot', label: 'পাসওয়ার্ড ভুলে গেছেন?', icon: KeyRound },
  ]

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-16">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-ink-100">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-ink-600 rounded-full flex items-center justify-center text-white mx-auto mb-4">
            <LogIn size={22} />
          </div>
          <h1 className="text-2xl font-display font-bold text-charcoal">আমার অ্যাকাউন্ট</h1>
          <p className="text-charcoal/60 mt-1 text-sm">অর্ডার হিস্ট্রি, ইনভয়েস ও আরও অনেক কিছু দেখতে লগইন করুন</p>
        </div>

        <div className="flex gap-1 bg-ink-50 rounded-lg p-1 mb-6 text-xs sm:text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setMode(t.id)
                resetMessages()
              }}
              className={`flex-1 py-2 rounded-md font-semibold transition ${
                mode === t.id ? 'bg-white text-ink-700 shadow' : 'text-charcoal/50 hover:text-charcoal'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 flex gap-2 items-start">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        {message && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-5 flex gap-2 items-start">
            <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-green-700 text-sm">{message}</p>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="ইমেইল" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            <Field label="পাসওয়ার্ড" type="password" value={password} onChange={setPassword} placeholder="আপনার পাসওয়ার্ড" />
            <SubmitButton loading={loading} label="লগইন করুন" loadingLabel="লগইন করছি..." />
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Field label="পুরো নাম" type="text" value={fullName} onChange={setFullName} placeholder="আপনার নাম" />
            <Field label="ফোন নম্বর" type="tel" value={phone} onChange={setPhone} placeholder="01XXXXXXXXX" />
            <Field label="ইমেইল" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            <Field label="পাসওয়ার্ড" type="password" value={password} onChange={setPassword} placeholder="ন্যূনতম ৬ ক্যারেক্টার" minLength={6} />
            <SubmitButton loading={loading} label="অ্যাকাউন্ট তৈরি করুন" loadingLabel="তৈরি করছি..." />
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <Field label="ইমেইল" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            <SubmitButton loading={loading} label="রিসেট লিংক পাঠান" loadingLabel="পাঠাচ্ছি..." />
          </form>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  minLength,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  minLength?: number
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2 text-charcoal">{label}</label>
      <input
        type={type}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-ink-100 rounded-lg px-4 py-2 focus:ring-2 focus:ring-ink-400 focus:border-transparent outline-none"
        placeholder={placeholder}
      />
    </div>
  )
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-ink-600 text-white py-2.5 rounded-lg font-semibold hover:bg-ink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? loadingLabel : label}
    </button>
  )
}
