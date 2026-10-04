import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { canDo } from '../../lib/permissions'
import { TicketRow } from './ticketUtils'
import TicketBoard from './TicketBoard'
import TicketForm from './TicketForm'
import TicketReport from './TicketReport'

type View = 'board' | 'new' | 'report'

/** টিকিট ডেস্ক */
export default function TicketsTab({ role }: { role?: string }) {
  const [view, setView] = useState<View>('board')
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [error, setError] = useState('')
  const isAdmin = canDo(role, 'ticket.confirm')

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('ticket_requests').select('*').order('created_at', { ascending: false }).limit(1000)
    if (e) { console.error('টিকিট লোড ত্রুটি:', e); setError('টিকিট লোড করা যায়নি (ফেজ J-এর SQL রান করা আছে কি?)') } else setError('')
    setTickets((data as TicketRow[]) || [])
  }, [])
  useEffect(() => { load() }, [load])

  const tabs: { id: View; label: string }[] = [{ id: 'board', label: 'বোর্ড' }, { id: 'new', label: 'নতুন অনুরোধ' }, ...(isAdmin ? [{ id: 'report' as const, label: 'লাভের হিসাব' }] : [])]
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => <button key={t.id} onClick={() => setView(t.id)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${view === t.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 shadow hover:bg-gray-50'}`}>{t.label}</button>)}
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
      <div className="bg-white rounded-lg shadow p-6">
        {view === 'board' && <TicketBoard tickets={tickets} isAdmin={isAdmin} reload={load} />}
        {view === 'new' && <TicketForm onSaved={() => { load(); setView('board') }} />}
        {view === 'report' && isAdmin && <TicketReport tickets={tickets} />}
      </div>
    </div>
  )
}
