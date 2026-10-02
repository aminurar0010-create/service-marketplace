import { StudentOverview } from '../../lib/supabase'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const bnDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })

/** প্রিন্টযোগ্য সার্টিফিকেট (A4 ল্যান্ডস্কেপ) — ইস্যু হওয়া স্টুডেন্টের জন্য */
export function printCertificate(s: StudentOverview, result?: string | null) {
  if (!s.certificate_no || !s.certificate_date) return
  const w = window.open('', '_blank', 'width=1000,height=720')
  if (!w) {
    alert('প্রিন্ট উইন্ডো খুলতে পারছি না — ব্রাউজারের পপ-আপ অনুমতি দিন')
    return
  }
  const duration = s.duration_label ? ` (সময়কাল: ${esc(s.duration_label)})` : ''
  const period = s.start_date ? `${esc(bnDate(s.start_date))} থেকে ${esc(bnDate(s.certificate_date))} পর্যন্ত` : ''
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>সার্টিফিকেট ${esc(s.certificate_no)}</title>
<style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}
body{margin:0;font-family:'Noto Serif Bengali','Kalpurush',serif;color:#1f2937}
.page{width:297mm;height:210mm;padding:12mm}
.frame{height:100%;border:3px double #0f4c5c;padding:10mm 14mm;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative}
.org{font-size:26px;font-weight:700;color:#0f4c5c;margin:0}
.sub{font-size:13px;color:#555;margin:2px 0 0}
h1{font-size:40px;margin:14px 0 4px;color:#b8860b;letter-spacing:2px}
.line{font-size:17px;margin:6px 0}
.name{font-size:34px;font-weight:700;border-bottom:2px solid #b8860b;padding:2px 36px;margin:10px 0}
.course{font-size:22px;font-weight:700;color:#0f4c5c;margin:8px 0}
.meta{font-size:14px;color:#444;margin-top:6px}
.foot{margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end;font-size:13px}
.sig{width:200px;border-top:1px solid #333;padding-top:4px}
.no{font-size:12px;color:#666}
</style></head><body><div class="page"><div class="frame">
<p class="org">নিউ প্রিন্টার্স — আইটি সলিউশন এ্যান্ড ট্রেনিং সেন্টার</p>
<p class="sub">সুন্দলপুর বাজার, মনিরামপুর, যশোর</p>
<h1>সনদপত্র</h1>
<p class="line">এই মর্মে প্রত্যয়ন করা যাচ্ছে যে</p>
<p class="name">${esc(s.full_name)}</p>
<p class="line">আমাদের প্রতিষ্ঠান থেকে নিম্নোক্ত কোর্সটি সফলভাবে সম্পন্ন করেছেন</p>
<p class="course">${esc(s.course_title)}${duration}</p>
<p class="meta">${period}${s.batch_name ? ` • ব্যাচ: ${esc(s.batch_name)}` : ''}${result ? ` • ফলাফল: ${esc(result)}` : ''}</p>
<div class="foot">
<div><div class="sig">প্রশিক্ষক</div></div>
<div class="no">সনদ নং: <b>${esc(s.certificate_no)}</b><br>প্রদানের তারিখ: ${esc(bnDate(s.certificate_date))}</div>
<div><div class="sig">প্রোপ্রাইটর: মোঃ মাসুদুর রহমান</div></div>
</div></div></div></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}
