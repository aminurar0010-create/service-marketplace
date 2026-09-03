import { Order } from './supabase'

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'অপেক্ষমান',
    documents_pending: 'ডকুমেন্ট বাকি',
    ready: 'প্রস্তুত',
    processing: 'প্রসেসিং চলছে',
    waiting: 'অপেক্ষমাণ',
    quality_check: 'কোয়ালিটি চেক',
    completed: 'সম্পন্ন',
    delivered: 'ডেলিভার হয়েছে',
    cancelled: 'বাতিল',
    rejected: 'প্রত্যাখ্যাত',
    on_hold: 'হোল্ডে আছে',
  }
  return labels[status] || status
}

const paymentStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    unpaid: 'অপরিশোধিত',
    paid: 'পরিশোধিত',
    refunded: 'ফেরতযোগ্য',
  }
  return labels[status] || status
}

/**
 * একটি অর্ডারের ইনভয়েস/রসিদ প্রিন্টযোগ্য নতুন উইন্ডোতে খুলে প্রিন্ট ডায়ালগ চালু করে।
 * ব্যবহারকারী "Save as PDF" নির্বাচন করে ডিজিটাল PDF ইনভয়েস ডাউনলোড করতে পারবেন।
 */
export function downloadInvoice(order: Order, shopName: string = 'সার্ভিস মার্কেটপ্লেস') {
  const win = window.open('', '_blank', 'width=480,height=700')
  if (!win) {
    alert('ইনভয়েস উইন্ডো খুলতে ব্যর্থ হয়েছে। পপ-আপ ব্লক করা থাকলে অনুমতি দিন।')
    return
  }

  const discount = order.discount_amount || 0
  const urgentFee = order.urgent_fee || 0
  const subtotal = order.total_amount + discount - urgentFee

  win.document.write(`
    <html>
      <head>
        <title>ইনভয়েস — ${order.tracking_id}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Noto Sans Bengali', Arial, sans-serif; padding: 24px; color: #111; font-size: 14px; max-width: 620px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #1F4D3D; padding-bottom: 12px; margin-bottom: 16px; }
          h1 { margin: 0 0 4px 0; color: #1F4D3D; font-size: 22px; }
          .sub { color: #555; font-size: 12px; }
          .badge { display:inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight:600; background:#EAF3EE; color:#1F4D3D; }
          .meta { display:flex; justify-content: space-between; margin: 16px 0; font-size: 13px; }
          .meta div { line-height: 1.7; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th { text-align:left; border-bottom: 1px solid #333; padding: 6px 4px; font-size: 12px; }
          td { padding: 6px 4px; border-bottom: 1px solid #eee; }
          .totals { margin-top: 12px; width: 100%; }
          .totals td { border: none; padding: 3px 4px; }
          .grand { font-weight:bold; font-size: 16px; border-top: 1px dashed #333 !important; padding-top: 8px !important; color:#1F4D3D; }
          .footer { text-align:center; margin-top: 24px; font-size: 11px; color: #777; }
          @media print { .no-print { display:none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${shopName}</h1>
          <p class="sub">ডিজিটাল ইনভয়েস / রসিদ</p>
          <span class="badge">ট্র্যাকিং আইডি: ${order.tracking_id}</span>
        </div>

        <div class="meta">
          <div>
            <strong>গ্রাহক তথ্য</strong><br/>
            নাম: ${order.customer_name}<br/>
            ফোন: ${order.customer_phone}<br/>
            ${order.customer_email ? `ইমেইল: ${order.customer_email}<br/>` : ''}
          </div>
          <div style="text-align:right;">
            <strong>অর্ডার তথ্য</strong><br/>
            তারিখ: ${new Date(order.created_at).toLocaleDateString('bn-BD')}<br/>
            স্ট্যাটাস: ${statusLabel(order.status)}<br/>
            পেমেন্ট: ${paymentStatusLabel(order.payment_status)}
          </div>
        </div>

        <table>
          <thead>
            <tr><th>বিবরণ</th><th style="text-align:right;">পরিমাণ</th></tr>
          </thead>
          <tbody>
            <tr><td>সার্ভিস চার্জ</td><td style="text-align:right;">৳${subtotal.toFixed(2)}</td></tr>
            ${urgentFee ? `<tr><td>আর্জেন্ট ফি</td><td style="text-align:right;">৳${urgentFee.toFixed(2)}</td></tr>` : ''}
            ${discount ? `<tr><td>ছাড় ${order.coupon_code ? `(${order.coupon_code})` : ''}</td><td style="text-align:right;">-৳${discount.toFixed(2)}</td></tr>` : ''}
          </tbody>
        </table>

        <table class="totals">
          <tr class="grand"><td>সর্বমোট</td><td style="text-align:right;">৳${order.total_amount.toFixed(2)}</td></tr>
        </table>

        <p class="footer">এই ইনভয়েসটি স্বয়ংক্রিয়ভাবে তৈরি করা হয়েছে। ধন্যবাদ আমাদের সাথে থাকার জন্য।</p>
        <script>
          window.onload = function () { window.print(); };
        </script>
      </body>
    </html>
  `)
  win.document.close()
}
