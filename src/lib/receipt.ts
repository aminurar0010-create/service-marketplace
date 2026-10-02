import { POSSale, POSSaleItem, SalePayment } from './supabase'

const paymentLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: 'নগদ (ক্যাশ)',
    bkash: 'বিকাশ',
    nagad: 'নগদ (Nagad)',
    rocket: 'রকেট',
    other: 'অন্যান্য',
    due: 'বাকি',
  }
  return labels[method] || method
}

const SHOP_NAME = 'নিউ প্রিন্টার্স'
const SHOP_TAGLINE = 'আইটি সলিউশন এ্যান্ড ট্রেনিং সেন্টার'
const SHOP_CONTACT = 'সুন্দলপুর বাজার, মনিরামপুর, যশোর • মোবাইল: 01968673241'

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * একটি POS বিক্রয়ের প্রিন্টযোগ্য মেমো/রশিদ নতুন উইন্ডোতে খুলে প্রিন্ট ডায়ালগ চালু করে।
 */
export function printReceipt(sale: POSSale, items: POSSaleItem[], payments: SalePayment[] = []) {
  const win = window.open('', '_blank', 'width=380,height=600')
  if (!win) {
    alert('প্রিন্ট উইন্ডো খুলতে ব্যর্থ হয়েছে। পপ-আপ ব্লক করা থাকলে অনুমতি দিন।')
    return
  }

  // পুরনো বিক্রিতে paid/due কলাম না থাকলে পুরো পরিশোধিত ধরা হয়
  const paid = sale.paid_amount ?? sale.total_amount
  const due = sale.due_amount ?? 0
  const paymentSummary =
    payments.length > 0
      ? payments.map((p) => `${paymentLabel(p.method)} ৳${p.amount}`).join(', ')
      : due > 0 && paid === 0
        ? 'বাকি'
        : paymentLabel(sale.payment_method)

  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:4px 0;">${esc(it.item_name)}</td>
        <td style="padding:4px 0; text-align:center;">${it.quantity}</td>
        <td style="padding:4px 0; text-align:right;">৳${it.unit_price}</td>
        <td style="padding:4px 0; text-align:right;">৳${it.line_total}</td>
      </tr>`
    )
    .join('')

  win.document.write(`
    <html>
      <head>
        <title>রশিদ — ${esc(sale.invoice_no || sale.sale_number)}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Noto Sans Bengali', Arial, sans-serif; padding: 16px; color: #111; font-size: 13px; }
          h2 { text-align: center; margin: 0 0 4px 0; }
          .sub { text-align: center; color: #555; font-size: 11px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th { border-bottom: 1px solid #333; text-align: left; padding: 4px 0; font-size: 12px; }
          .totals td { padding: 2px 0; }
          .grand { font-weight: bold; font-size: 15px; border-top: 1px dashed #333; padding-top: 6px; }
          .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #555; }
          hr { border: none; border-top: 1px dashed #999; }
        </style>
      </head>
      <body>
        <h2>${SHOP_NAME}</h2>
        <p class="sub" style="margin-bottom:2px;">${SHOP_TAGLINE}</p>
        <p class="sub">${SHOP_CONTACT}</p>
        <hr />
        <p>ইনভয়েস নং: <strong>${esc(sale.invoice_no || sale.sale_number)}</strong><br/>
        তারিখ: ${new Date(sale.created_at).toLocaleString('bn-BD')}<br/>
        ${sale.customer_name ? `কাস্টমার: ${esc(sale.customer_name)}<br/>` : ''}
        ${sale.customer_phone ? `ফোন: ${esc(sale.customer_phone)}<br/>` : ''}
        পেমেন্ট: ${paymentSummary}</p>
        <table>
          <thead>
            <tr><th>পণ্য/সেবা</th><th style="text-align:center;">পরিমাণ</th><th style="text-align:right;">দর</th><th style="text-align:right;">মোট</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <hr />
        <table class="totals">
          <tr><td>সাবটোটাল</td><td style="text-align:right;">৳${sale.subtotal}</td></tr>
          <tr><td>ছাড়</td><td style="text-align:right;">৳${sale.discount_amount}</td></tr>
          <tr class="grand"><td>সর্বমোট</td><td style="text-align:right;">৳${sale.total_amount}</td></tr>
          <tr><td>পরিশোধ</td><td style="text-align:right;">৳${paid}</td></tr>
          <tr style="font-weight:bold;${due > 0 ? 'color:#b91c1c;' : ''}"><td>বাকি (Due)</td><td style="text-align:right;">৳${due}</td></tr>
        </table>
        <p class="footer">ধন্যবাদ! আবার আসবেন।</p>
        <script>
          window.onload = function () { window.print(); };
        </script>
      </body>
    </html>
  `)
  win.document.close()
}
