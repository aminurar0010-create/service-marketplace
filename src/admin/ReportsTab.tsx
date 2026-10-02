import { useState } from 'react'
import { Order, Service } from '../lib/supabase'
import DailyReport from './reports/DailyReport'
import ServiceReport from './reports/ServiceReport'
import CustomerStaffReport from './reports/CustomerStaffReport'
import MonthlyReport from './reports/MonthlyReport'
import LegacyOverview from './reports/LegacyOverview'

type ReportView = 'daily' | 'service' | 'customer' | 'monthly' | 'overview'

const VIEWS: { id: ReportView; label: string }[] = [
  { id: 'daily', label: 'দৈনিক রিপোর্ট' },
  { id: 'service', label: 'সার্ভিস-ভিত্তিক' },
  { id: 'customer', label: 'কাস্টমার ও স্টাফ' },
  { id: 'monthly', label: 'মান্থলি রিপোর্ট' },
  { id: 'overview', label: 'অর্ডার ওভারভিউ' },
]

/** রিপোর্টস — ট্যাব-সুইচার; প্রতিটি রিপোর্ট src/admin/reports/-এর আলাদা ফাইলে */
export default function ReportsTab({ services, orders }: { services: Service[]; orders: Order[] }) {
  const [view, setView] = useState<ReportView>('daily')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              view === v.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 shadow hover:bg-gray-50'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === 'daily' && (
        <div className="bg-white rounded-lg shadow p-6">
          <DailyReport />
        </div>
      )}
      {view === 'service' && <ServiceReport services={services} orders={orders} />}
      {view === 'customer' && <CustomerStaffReport />}
      {view === 'monthly' && <MonthlyReport orders={orders} />}
      {view === 'overview' && <LegacyOverview services={services} orders={orders} />}
    </div>
  )
}
