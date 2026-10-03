import { useEffect, useMemo, useState } from 'react'
import { ShoppingCart, Plus, Minus, Trash2, User } from 'lucide-react'
import {
  supabase,
  logActivity,
  ShopCustomer,
  POSSale,
  POSSaleItem,
  SalePayment,
  CreatePOSSaleResult,
} from '../../lib/supabase'
import { printReceipt } from '../../lib/receipt'
import { printMemo } from '../../lib/memo'
import CustomerPicker from '../../components/CustomerPicker'
import { CartLine, PAY_METHODS, PayMethod } from './posTypes'

interface Props {
  cart: CartLine[]
  onQty: (key: string, delta: number) => void
  onRemove: (key: string) => void
  onClear: () => void
  onCompleted: () => void
}

type PayState = Record<PayMethod, string>
const EMPTY_PAY: PayState = { cash: '', bkash: '', nagad: '', rocket: '', other: '' }

/** কার্ট + কাস্টমার + পেমেন্ট (আংশিক/বাকি সহ) + চেকআউট */
export default function CartPanel({ cart, onQty, onRemove, onClear, onCompleted }: Props) {
  const [customer, setCustomer] = useState<ShopCustomer | null>(null)
  const [discount, setDiscount] = useState('0')
  const [pay, setPay] = useState<PayState>(EMPTY_PAY)
  const [touched, setTouched] = useState(false) // কাস্টমার নিজে পেমেন্ট বদলালে true
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')
  // রশিদের ধরন (এই ডিভাইসে মনে রাখা হয়): ছোট স্লিপ নাকি A5 মেমো
  const [format, setFormat] = useState<'slip' | 'a5'>(() => {
    try {
      return localStorage.getItem('np_receipt_format') === 'a5' ? 'a5' : 'slip'
    } catch {
      return 'slip'
    }
  })
  const chooseFormat = (f: 'slip' | 'a5') => {
    setFormat(f)
    try {
      localStorage.setItem('np_receipt_format', f)
    } catch {
      /* ব্রাউজার স্টোরেজ বন্ধ থাকলে শুধু এই সেশনে থাকবে */
    }
  }

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.quantity * l.unit_price, 0), [cart])
  const discountNum = Math.max(Number(discount || 0), 0)
  const total = Math.max(subtotal - discountNum, 0)

  // ডিফল্ট: পুরো টাকা নগদে (দ্রুত এন্ট্রি); হাতে বদলালে সেটাই ধরা হয়
  const paidFromInputs = (Object.keys(pay) as PayMethod[]).reduce((s, m) => s + Number(pay[m] || 0), 0)
  const paid = touched ? paidFromInputs : total
  const due = total - paid
  const overpaid = paid > total

  useEffect(() => {
    if (cart.length === 0) setError('')
  }, [cart.length])

  const setAmount = (m: PayMethod, value: string) => {
    setTouched(true)
    setPay((p) => ({ ...p, [m]: value }))
  }

  const fillRemaining = (m: PayMethod) => {
    const others = (Object.keys(pay) as PayMethod[]).filter((x) => x !== m).reduce((s, x) => s + Number(pay[x] || 0), 0)
    setTouched(true)
    setPay((p) => ({ ...p, [m]: String(Math.max(total - others, 0)) }))
  }

  const markAllDue = () => {
    setTouched(true)
    setPay(EMPTY_PAY)
  }

  const reset = () => {
    setCustomer(null)
    setDiscount('0')
    setPay(EMPTY_PAY)
    setTouched(false)
    setError('')
  }

  const handleCheckout = async () => {
    setError('')
    if (cart.length === 0) return setError('কার্টে কোনো আইটেম নেই')
    if (overpaid) return setError('পরিশোধের পরিমাণ মোট বিলের বেশি হয়েছে')
    if (due > 0 && !customer) return setError('বাকিতে বিক্রির জন্য আগে কাস্টমার নির্বাচন করুন')

    const payments = touched
      ? PAY_METHODS.map((m) => ({ method: m.id, amount: Number(pay[m.id] || 0) })).filter((p) => p.amount > 0)
      : total > 0
        ? [{ method: 'cash', amount: total }]
        : []

    setCheckingOut(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_pos_sale_v2', {
        p_items: cart.map((l) => ({
          item_type: l.item_type,
          item_ref_id: l.item_ref_id || '',
          item_name: l.item_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        p_customer_id: customer?.id ?? null,
        p_discount_amount: discountNum,
        p_payments: payments,
      })
      if (rpcError) throw rpcError
      const result = data as CreatePOSSaleResult
      if (!result?.success) {
        setError(result?.message || 'বিক্রয় সম্পন্ন করতে সমস্যা হয়েছে')
        return
      }

      logActivity(`POS বিক্রয় সম্পন্ন (${result.invoice_no})`, 'pos_sale', result.invoice_no, {
        total_amount: result.total_amount,
        paid_amount: result.paid_amount,
        due_amount: result.due_amount,
      })

      const [{ data: sale }, { data: items }, { data: pays }] = await Promise.all([
        supabase.from('pos_sales').select('*').eq('id', result.sale_id).single(),
        supabase.from('pos_sale_items').select('*').eq('sale_id', result.sale_id),
        supabase.from('sale_payments').select('*').eq('sale_id', result.sale_id),
      ])
      if (sale) {
        const args = [sale as POSSale, (items || []) as POSSaleItem[], (pays || []) as SalePayment[]] as const
        if (format === 'a5') printMemo(args[0], args[1], args[2], customer?.address || '')
        else printReceipt(...args)
      }

      reset()
      onClear()
      onCompleted()
    } catch (err) {
      console.error('চেকআউট ত্রুটি:', err)
      setError('বিক্রয় সম্পন্ন করতে সমস্যা হয়েছে। SQL (ফেজ B) রান করা আছে কিনা দেখুন।')
    } finally {
      setCheckingOut(false)
    }
  }

  const field =
    'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none'

  return (
    <div className="bg-white rounded-lg shadow p-6 h-fit lg:sticky lg:top-6">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="text-indigo-600" size={20} />
        <h3 className="font-bold">বিক্রয় কার্ট</h3>
      </div>

      {error && <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

      {cart.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">কার্ট খালি — বাম দিক থেকে সেবা/পণ্য যোগ করুন</p>
      ) : (
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {cart.map((line) => (
            <div key={line.key} className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{line.item_name}</p>
                <p className="text-xs text-gray-400">
                  ৳{line.unit_price} × {line.quantity} = ৳{line.unit_price * line.quantity}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onQty(line.key, -1)} className="p-1 border border-gray-300 rounded hover:bg-gray-50">
                  <Minus size={12} />
                </button>
                <span className="text-sm w-5 text-center">{line.quantity}</span>
                <button onClick={() => onQty(line.key, 1)} className="p-1 border border-gray-300 rounded hover:bg-gray-50">
                  <Plus size={12} />
                </button>
                <button onClick={() => onRemove(line.key)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-1">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 border-t border-gray-200 pt-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
            <User size={13} /> কাস্টমার (ফোন দিয়ে খুঁজুন)
          </p>
          <CustomerPicker value={customer} onChange={setCustomer} />
          {!customer && <p className="text-xs text-gray-400 mt-1">ঐচ্ছিক — তবে বাকিতে বিক্রি করতে হলে বাধ্যতামূলক</p>}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">ছাড় (৳)</label>
          <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className={field} />
        </div>

        <div className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">পেমেন্ট</p>
            <button onClick={markAllDue} className="text-xs font-semibold text-red-600 hover:text-red-800">
              সম্পূর্ণ বাকি
            </button>
          </div>
          {!touched && (
            <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1">
              এখন পুরো ৳{total} নগদে ধরা হচ্ছে — বদলাতে নিচের ঘরে লিখুন
            </p>
          )}
          {PAY_METHODS.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fillRemaining(m.id)}
                className="w-28 text-left text-xs font-semibold text-gray-600 hover:text-indigo-600 shrink-0"
                title="বাকি পুরোটা এই মেথডে"
              >
                {m.label}
              </button>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={touched ? pay[m.id] : m.id === 'cash' ? String(total) : ''}
                onChange={(e) => setAmount(m.id, e.target.value)}
                placeholder="0"
                className={field}
              />
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>সাবটোটাল</span>
            <span>৳{subtotal}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>ছাড়</span>
            <span>৳{discountNum}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900">
            <span>সর্বমোট</span>
            <span>৳{total}</span>
          </div>
          <div className="flex justify-between text-sm text-green-700">
            <span>পরিশোধ</span>
            <span>৳{paid}</span>
          </div>
          <div className={`flex justify-between text-sm font-bold ${due > 0 ? 'text-red-600' : overpaid ? 'text-orange-600' : 'text-gray-500'}`}>
            <span>{overpaid ? 'বেশি দেওয়া হয়েছে' : 'বাকি (Due)'}</span>
            <span>৳{Math.abs(due)}</span>
          </div>
        </div>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {([['slip', 'ছোট স্লিপ'], ['a5', 'A5 মেমো']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => chooseFormat(id)}
              className={`flex-1 py-1.5 font-semibold transition ${format === id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={handleCheckout}
          disabled={checkingOut || cart.length === 0 || overpaid}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {checkingOut ? 'প্রসেস হচ্ছে...' : 'বিক্রয় সম্পন্ন করুন ও রশিদ প্রিন্ট করুন'}
        </button>
        <button
          onClick={() => {
            reset()
            onClear()
          }}
          className="w-full border border-gray-300 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
        >
          কার্ট খালি করুন
        </button>
      </div>
    </div>
  )
}
