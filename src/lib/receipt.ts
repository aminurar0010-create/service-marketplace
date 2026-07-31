import { POSSale, POSSaleItem } from './supabase'

const paymentLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: 'নগদ (ক্যাশ)',
    bkash: 'বিকাশ',
    nagad: 'নগদ (Nagad)',
    rocket: 'রকেট',
  }
  return labels[method] || method
}

/**
 * একটি POS বিক্রয়ের প্রিন্টযোগ্য মেমো/রশিদ নতুন উইন্ডোতে খুলে প্রিন্ট ডায়ালগ চালু করে।
 */
export function printReceipt(
  sale: POSSale,
  items: POSSaleItem[],
  shopName: string = 'সার্ভিস মার্কেটপ্লেস'
) {
  const win = window.open('', '_blank', 'width=380,height=600')
  if (!win) {
    alert('প্রিন্ট উইন্ডো খুলতে ব্যর্থ হয়েছে। পপ-আপ ব্লক করা থাকলে অনুমতি দিন।')
    return
  }

  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:4px 0;">${it.item_name}</td>
        <td style="padding:4px 0; text-align:center;">${it.quantity}</td>
        <td style="padding:4px 0; text-align:right;">৳${it.unit_price}</td>
        <td style="padding:4px 0; text-align:right;">৳${it.line_total}</td>
      </tr>`
    )
    .join('')

  win.document.write(`
    <html>
      <head>
        <title>রশিদ — ${sale.sale_number}</title>
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
        <h2>${shopName}</h2>
        <p class="sub">বিক্রয় রশিদ / মেমো</p>
        <hr />
        <p>রশিদ নং: <strong>${sale.sale_number}</strong><br/>
        তারিখ: ${new Date(sale.created_at).toLocaleString('bn-BD')}<br/>
        ${sale.customer_name ? `কাস্টমার: ${sale.customer_name}<br/>` : ''}
        ${sale.customer_phone ? `ফোন: ${sale.customer_phone}<br/>` : ''}
        পেমেন্ট: ${paymentLabel(sale.payment_method)}</p>
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
