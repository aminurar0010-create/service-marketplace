import { Printer, X } from 'lucide-react'

// ব্যবসার তথ্য — এখানে পরিবর্তন করলে সব মেমোতে আপডেট হয়ে যাবে
const BUSINESS = {
  name: 'নিউ প্রিন্টার্স',
  tagline: 'পরিষেবা মার্কেটপ্লেস',
  owner: 'প্রোপ্রাইটর: মোঃ মাসুদুর রহমান',
  phones: ['01968673241', '01936011045'],
  email: 'newprintssmj@gmail.com',
  address: 'সুন্দলপুর বাজার, মনিরামপুর, যশোর',
}

const paymentLabel = (m?: string) => {
  const map: Record<string, string> = {
    bkash: 'বিকাশ',
    nagad: 'নগদ',
    rocket: 'রকেট',
    cod: 'ক্যাশ অন ডেলিভারি',
    cash: 'ক্যাশ',
  }
  return m ? map[m] || m : '-'
}

const paymentStatusLabel = (s: string) => {
  const map: Record<string, string> = { unpaid: 'অপরিশোধিত', paid: 'পরিশোধিত', refunded: 'ফেরত' }
  return map[s] || s
}

function MemoSlip({ order, getServiceName }: { order: any; getServiceName: (id: string) => string }) {
  return (
    <div className="memo-slip">
      <div className="memo-header">
        <img
          src="/logo.png"
          alt="লোগো"
          className="memo-logo"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
        <div className="memo-header-text">
          <div className="memo-business-name">{BUSINESS.name}</div>
          <div className="memo-tagline">{BUSINESS.tagline}</div>
          <div className="memo-owner">{BUSINESS.owner}</div>
          <div className="memo-contact">
            {BUSINESS.phones.join(', ')} · {BUSINESS.email}
          </div>
          <div className="memo-contact">{BUSINESS.address}</div>
        </div>
      </div>

      <div className="memo-rule" />

      <div className="memo-meta">
        <div>
          <div>
            <strong>মেমো #:</strong> {order.tracking_id}
          </div>
          <div>
            <strong>তারিখ:</strong> {new Date(order.created_at).toLocaleDateString('bn-BD')}
          </div>
        </div>
        <div className="memo-meta-right">
          <div>
            <strong>পেমেন্ট:</strong> {paymentLabel(order.payment_method)}
          </div>
          <div>
            <strong>অবস্থা:</strong> {paymentStatusLabel(order.payment_status)}
          </div>
          {order.transaction_id && (
            <div>
              <strong>ট্রানজেকশন আইডি:</strong> {order.transaction_id}
            </div>
          )}
        </div>
      </div>

      <div className="memo-customer">
        <div>
          <strong>গ্রাহক:</strong> {order.customer_name}
        </div>
        <div>
          <strong>মোবাইল:</strong> {order.customer_phone}
        </div>
      </div>

      <table className="memo-table">
        <thead>
          <tr>
            <th>বিবরণ</th>
            <th>পরিমাণ</th>
            <th>মূল্য</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{getServiceName(order.service_id)}</td>
            <td>১</td>
            <td>৳{order.total_amount}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>মোট</td>
            <td>৳{order.total_amount}</td>
          </tr>
        </tfoot>
      </table>

      <div className="memo-footer">
        <span>ধন্যবাদান্তে</span>
        <span className="memo-sign">স্বাক্ষর</span>
      </div>
    </div>
  )
}

export default function OrderMemoModal({
  orders,
  getServiceName,
  onClose,
}: {
  orders: any[]
  getServiceName: (id: string) => string
  onClose: () => void
}) {
  const isSingle = orders.length === 1
  const sheets: any[][] = []
  for (let i = 0; i < orders.length; i += 4) sheets.push(orders.slice(i, i + 4))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #memo-print-area, #memo-print-area * { visibility: visible; }
          #memo-print-area { position: absolute; inset: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
        }
        .memo-sheet {
          width: 210mm;
          min-height: 148mm;
          margin: 0 auto 8px auto;
          background: white;
          page-break-after: always;
        }
        .memo-sheet.single { min-height: 297mm; padding: 14mm; box-sizing: border-box; }
        .memo-sheet.quad {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          height: 297mm;
        }
        .memo-slip {
          border: 1px dashed #999;
          padding: 8mm;
          font-size: 11px;
          color: #111;
          display: flex;
          flex-direction: column;
        }
        .memo-sheet.single .memo-slip { border: none; font-size: 14px; height: 100%; }
        .memo-header { display: flex; align-items: center; gap: 10px; }
        .memo-logo { width: 46px; height: 46px; object-fit: contain; border-radius: 6px; flex-shrink: 0; }
        .memo-header-text { flex: 1; }
        .memo-sheet.single .memo-logo { width: 70px; height: 70px; }
        .memo-business-name { font-size: 1.6em; font-weight: 800; color: #0f4c46; }
        .memo-tagline { color: #b8860b; font-weight: 600; margin-bottom: 2px; }
        .memo-owner { font-weight: 600; }
        .memo-contact { color: #444; }
        .memo-rule { border-top: 2px solid #0f4c46; margin: 6px 0; }
        .memo-meta { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .memo-meta-right { text-align: right; }
        .memo-customer { margin-bottom: 6px; }
        .memo-table { width: 100%; border-collapse: collapse; margin-top: 4px; flex: 1; }
        .memo-table th, .memo-table td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        .memo-table tfoot td { font-weight: 700; background: #f5f5f0; }
        .memo-footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 10px; font-size: 0.9em; color: #444; }
        .memo-sign { border-top: 1px solid #999; padding-top: 2px; }
      `}</style>

      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold">
            মেমো প্রিন্ট — {orders.length}টি অর্ডার {!isSingle && '(A4-তে ৪টি করে প্রিন্ট হবে)'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 transition"
            >
              <Printer size={14} />
              প্রিন্ট করুন
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
        </div>

        <div id="memo-print-area" className="p-4 bg-gray-100">
          {isSingle ? (
            <div className="memo-sheet single">
              <MemoSlip order={orders[0]} getServiceName={getServiceName} />
            </div>
          ) : (
            sheets.map((sheet, idx) => (
              <div className="memo-sheet quad" key={idx}>
                {sheet.map((order) => (
                  <MemoSlip key={order.id} order={order} getServiceName={getServiceName} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
