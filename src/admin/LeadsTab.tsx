import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  UserPlus, Upload, Sparkles, Loader2, MessageCircle, Mail, Pencil, Check, Trash2,
} from 'lucide-react'

export interface Lead {
  id: string
  name: string
  company: string | null
  email: string | null
  whatsapp: string | null
  target_service: string | null
  notes: string | null
  proposal_text: string | null
  status: 'new' | 'proposal_generated' | 'sent' | 'replied' | 'closed'
  created_at: string
}

const STATUS_LABEL: Record<Lead['status'], string> = {
  new: 'নতুন',
  proposal_generated: 'প্রপোজাল রেডি',
  sent: 'পাঠানো হয়েছে',
  replied: 'রিপ্লাই এসেছে',
  closed: 'ক্লোজড',
}

const STATUS_COLOR: Record<Lead['status'], string> = {
  new: 'bg-gray-200 text-gray-700',
  proposal_generated: 'bg-blue-100 text-blue-700',
  sent: 'bg-amber-100 text-amber-700',
  replied: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
}

// WhatsApp নম্বর থেকে + ও স্পেস বাদ দিয়ে wa.me ফরম্যাটে আনে
function cleanWhatsapp(num: string) {
  return num.replace(/[^0-9]/g, '')
}

export default function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null)
  const [draftProposal, setDraftProposal] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setLeads((data as Lead[]) || [])
    } catch (err) {
      console.error('লিড লোড ত্রুটি:', err)
    } finally {
      setLoading(false)
    }
  }

  // ---------- CSV ইম্পোর্ট ----------
  // প্রত্যাশিত কলাম হেডার: name,email,whatsapp,company,target_service
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      alert('ফাইলে কোনো ডেটা পাওয়া যায়নি। প্রথম লাইনে header (name,email,whatsapp,company,target_service) দিন।')
      return
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(',').map((c) => c.trim())
      const row: Record<string, string> = {}
      headers.forEach((h, i) => (row[h] = cells[i] || ''))
      return row
    })

    const newLeads = rows
      .filter((r) => r.name)
      .map((r) => ({
        name: r.name,
        email: r.email || null,
        whatsapp: r.whatsapp || null,
        company: r.company || null,
        target_service: r.target_service || null,
        status: 'new' as const,
      }))

    if (newLeads.length === 0) {
      alert('বৈধ কোনো সারি (row) পাওয়া যায়নি — অন্তত "name" কলাম থাকা লাগবে।')
      return
    }

    try {
      const { error } = await supabase.from('leads').insert(newLeads)
      if (error) throw error
      fetchLeads()
      alert(`${newLeads.length}টি লিড সফলভাবে ইম্পোর্ট হয়েছে।`)
    } catch (err) {
      console.error('ইম্পোর্ট ত্রুটি:', err)
      alert('ইম্পোর্ট করতে সমস্যা হয়েছে।')
    }
  }

  // ---------- AI প্রপোজাল জেনারেট ----------
  const generateProposal = async (lead: Lead) => {
    setGeneratingId(lead.id)
    try {
      const { data, error } = await supabase.functions.invoke('generate-proposal', {
        body: {
          leadId: lead.id,
          name: lead.name,
          company: lead.company,
          targetService: lead.target_service,
          notes: lead.notes,
        },
      })
      if (error) throw error
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id ? { ...l, proposal_text: data.proposal, status: 'proposal_generated' } : l
        )
      )
    } catch (err) {
      console.error('প্রপোজাল জেনারেট ত্রুটি:', err)
      alert('প্রপোজাল জেনারেট করতে সমস্যা হয়েছে। GEMINI_API_KEY সেট আছে কিনা চেক করুন।')
    } finally {
      setGeneratingId(null)
    }
  }

  const saveProposalEdit = async (lead: Lead) => {
    try {
      await supabase.from('leads').update({ proposal_text: draftProposal }).eq('id', lead.id)
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, proposal_text: draftProposal } : l)))
      setEditingProposalId(null)
    } catch (err) {
      console.error('সেভ ত্রুটি:', err)
    }
  }

  const markSent = async (lead: Lead) => {
    try {
      await supabase.from('leads').update({ status: 'sent' }).eq('id', lead.id)
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'sent' } : l)))
    } catch (err) {
      console.error('স্ট্যাটাস আপডেট ত্রুটি:', err)
    }
  }

  const deleteLead = async (lead: Lead) => {
    if (!confirm(`"${lead.name}" লিডটি ডিলিট করতে চান?`)) return
    try {
      await supabase.from('leads').delete().eq('id', lead.id)
      setLeads((prev) => prev.filter((l) => l.id !== lead.id))
    } catch (err) {
      console.error('ডিলিট ত্রুটি:', err)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">লিড ও AI প্রপোজাল</h2>
            <p className="text-sm text-gray-500 mt-1">লিড যোগ করুন, AI দিয়ে প্রপোজাল লিখুন, এক ক্লিকে WhatsApp/Email পাঠান</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
          >
            <Upload size={16} />
            CSV ইম্পোর্ট
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <UserPlus size={16} />
            নতুন লিড
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-center text-gray-500 py-8">লোড করছি...</p>
        ) : leads.length === 0 ? (
          <p className="text-center text-gray-500 py-8">কোনো লিড পাওয়া যায়নি। CSV ইম্পোর্ট করুন বা নতুন লিড যোগ করুন।</p>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div key={lead.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{lead.name}</p>
                      {lead.company && <span className="text-xs text-gray-500">({lead.company})</span>}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[lead.status]}`}>
                        {STATUS_LABEL[lead.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {lead.target_service && <>চাহিদা: {lead.target_service} · </>}
                      {lead.email && <>{lead.email} · </>}
                      {lead.whatsapp && <>{lead.whatsapp}</>}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => generateProposal(lead)}
                      disabled={generatingId === lead.id}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                    >
                      {generatingId === lead.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {lead.proposal_text ? 'আবার জেনারেট করুন' : 'প্রপোজাল জেনারেট করুন'}
                    </button>
                    <button
                      onClick={() => deleteLead(lead)}
                      className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={13} />
                      ডিলিট
                    </button>
                  </div>
                </div>

                {lead.proposal_text && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    {editingProposalId === lead.id ? (
                      <>
                        <textarea
                          value={draftProposal}
                          onChange={(e) => setDraftProposal(e.target.value)}
                          rows={5}
                          className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => saveProposalEdit(lead)}
                          className="mt-2 flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-900"
                        >
                          <Check size={13} />
                          সেভ করুন
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.proposal_text}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => {
                              setEditingProposalId(lead.id)
                              setDraftProposal(lead.proposal_text || '')
                            }}
                            className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600"
                          >
                            <Pencil size={13} />
                            এডিট
                          </button>
                          {lead.whatsapp && (
                            <a
                              href={`https://wa.me/${cleanWhatsapp(lead.whatsapp)}?text=${encodeURIComponent(lead.proposal_text)}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => markSent(lead)}
                              className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-900"
                            >
                              <MessageCircle size={13} />
                              WhatsApp-এ পাঠান
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}?subject=${encodeURIComponent(
                                'আপনার জন্য একটি প্রস্তাবনা'
                              )}&body=${encodeURIComponent(lead.proposal_text)}`}
                              onClick={() => markSent(lead)}
                              className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                            >
                              <Mail size={13} />
                              ইমেইলে পাঠান
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false)
            fetchLeads()
          }}
        />
      )}
    </div>
  )
}

// ---------- নতুন লিড যোগ করার ছোট মডাল ----------
function AddLeadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', whatsapp: '', target_service: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.name.trim()) {
      alert('নাম আবশ্যক')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('leads').insert({ ...form, status: 'new' })
      if (error) throw error
      onSaved()
    } catch (err) {
      console.error('লিড সেভ ত্রুটি:', err)
      alert('সেভ করতে সমস্যা হয়েছে')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">নতুন লিড যোগ করুন</h3>
        <div className="space-y-3">
          <input
            placeholder="নাম *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="কোম্পানি"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="ইমেইল"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="WhatsApp নম্বর (যেমন 8801XXXXXXXXX)"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="কী সার্ভিস দরকার (যেমন: Dynamic Website)"
            value={form.target_service}
            onChange={(e) => setForm({ ...form, target_service: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            placeholder="বাড়তি নোট (ঐচ্ছিক)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
            বাতিল
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </button>
        </div>
      </div>
    </div>
  )
}
