import { useEffect, useState } from 'react'
import { supabase, logActivity, ShopCustomer, Service, InventoryItem, POSSale, POSSaleItem, SalePayment } from '../lib/supabase'
import { Plus, Printer, Receipt, Search, FileText, Undo2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { printReceipt } from '../lib/receipt'
import { printMemo } from '../lib/memo'
import CartPanel from './pos/CartPanel'
import QuickItems from './pos/QuickItems'
import { CartLine, payMethodLabel } from './pos/posTypes'
import { PENDING_QUOTE_KEY } from './pricing/QuotesTab'

export default function POSTab() {
  const [services, setServices] = useState<Service[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  // কোটেশন থেকে "বিক্রি করুন" চাপলে আসা তথ্য (একবারই নেওয়া হয়)
  const [preset, setPreset] = useState<{ quoteId: string; quoteNo: string; discount: number; customer: ShopCustomer | null } | null>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PENDING_QUOTE_KEY)
      if (!raw) return
      localStorage.removeItem(PENDING_QUOTE_KEY)
      const q = JSON.parse(raw)
      setCart(
        (q.lines || []).map((l: { name: string; quantity: number; unit_price: number }) => ({
          key: `custom:${crypto.randomUUID()}`,
          item_type: 'custom' as const,
          item_ref_id: null,
          item_name: l.name,
          quantity: 1,
          unit_price: Math.round(Number(l.quantity) * Number(l.unit_price) * 100) / 100,
        }))
      )
      setPreset({ quoteId: q.quoteId, quoteNo: q.quoteNo, discount: Number(q.discount) || 0, customer: q.customer || null })
    } catch (e) {
      console.error('কোটেশন লোড ত্রুটি:', e)
    }
  }, [])

  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')

  const [quickRefresh, setQuickRefresh] = useState(0)

  const [recentSales, setRecentSales] = useState<POSSale[]>([])
  const [recentLoading, setRecentLoading] = useState(false)

  useEffect(() => {
    fetchCatalog()
    fetchRecentSales()
  }, [])

  const fetchCatalog = async () => {
    setLoading(true)
    try {
      const [{ data: servicesData }, { data: inventoryData }] = await Promise.all([
        supabase.from('services').select('*').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('inventory_items').select('*').eq('is_active', true).order('name', { ascending: true }),
      ])
      setServices(servicesData || [])
      setInventoryItems(inventoryData || [])
    } catch (err) {
      console.error('ক্যাটালগ লোড ত্রুটি:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentSales = async () => {
    setRecentLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('pos_sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (fetchError) throw fetchError
      setRecentSales(data || [])
    } catch (err) {
      console.error('সাম্প্রতিক বিক্রয় লোড ত্রুটি:', err)
    } finally {
      setRecentLoading(false)
    }
  }

  const addServiceToCart = (service: Service) => {
    setCart((prev) => {
      const key = `service:${service.id}`
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [
        ...prev,
        { key, item_type: 'service', item_ref_id: service.id, item_name: service.name, quantity: 1, unit_price: service.price },
      ]
    })
  }

  const addInventoryToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const key = `inventory:${item.id}`
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        if (existing.quantity + 1 > item.quantity) {
          alert('পর্যাপ্ত স্টক নেই')
          return prev
        }
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
      }
      if (item.quantity <= 0) {
        alert('এই পণ্যের স্টক শেষ')
        return prev
      }
      return [
        ...prev,
        {
          key,
          item_type: 'inventory',
          item_ref_id: item.id,
          item_name: item.name,
          quantity: 1,
          unit_price: item.sell_price,
          max_quantity: item.quantity,
        },
      ]
    })
  }

  const addCustomToCart = () => {
    if (!customName.trim() || !customPrice || Number(customPrice) < 0) {
      alert('পণ্যের নাম ও সঠিক দাম দিন')
      return
    }
    setCart((prev) => [
      ...prev,
      {
        key: `custom:${crypto.randomUUID()}`,
        item_type: 'custom',
        item_ref_id: null,
        item_name: customName.trim(),
        quantity: 1,
        unit_price: Number(customPrice),
      },
    ])
    setCustomName('')
    setCustomPrice('')
  }

  const updateQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l
          const newQty = l.quantity + delta
          if (newQty <= 0) return null
          if (l.max_quantity !== undefined && newQty > l.max_quantity) {
            alert('পর্যাপ্ত স্টক নেই')
            return l
          }
          return { ...l, quantity: newQty }
        })
        .filter(Boolean) as CartLine[]
    )
  }

  const removeLine = (key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key))
  }

  const handleQuickAdd = (line: Omit<CartLine, 'quantity'>) => {
    if (line.item_type === 'service') {
      const svc = services.find((x) => x.id === line.item_ref_id)
      if (svc) return addServiceToCart(svc)
    }
    if (line.item_type === 'inventory') {
      const inv = inventoryItems.find((x) => x.id === line.item_ref_id)
      if (inv) return addInventoryToCart(inv)
      return
    }
    // কাস্টম আইটেম বা মুছে ফেলা সার্ভিস — আগের দামে যোগ
    setCart((prev) => {
      const existing = prev.find((l) => l.key === line.key)
      if (existing) return prev.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { ...line, item_type: 'custom', item_ref_id: null, quantity: 1 }]
    })
  }

  const filteredServices = services.filter((s) => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()))
  const filteredInventory = inventoryItems.filter((i) => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()))

  const handleCompleted = () => {
    fetchCatalog()
    fetchRecentSales()
    setQuickRefresh((n) => n + 1)
  }

  const reprintSale = async (sale: POSSale, fmt: 'slip' | 'a5' = 'slip') => {
    try {
      const [{ data: saleItemsData, error: fetchError }, { data: paysData }] = await Promise.all([
        supabase.from('pos_sale_items').select('*').eq('sale_id', sale.id),
        supabase.from('sale_payments').select('*').eq('sale_id', sale.id),
      ])
      if (fetchError) throw fetchError
      if (fmt === 'a5') {
        let address = ''
        if (sale.shop_customer_id) {
          const { data: c } = await supabase.from('shop_customers').select('address').eq('id', sale.shop_customer_id).maybeSingle()
          address = c?.address || ''
        }
        printMemo(sale, (saleItemsData || []) as POSSaleItem[], (paysData || []) as SalePayment[], address)
      } else {
        printReceipt(sale, (saleItemsData || []) as POSSaleItem[], (paysData || []) as SalePayment[])
      }
    } catch (err) {
      console.error('রিপ্রিন্ট ত্রুটি:', err)
      alert('রশিদ পুনরায় প্রিন্ট করতে সমস্যা হয়েছে')
    }
  }

  const refundSale = async (sale: POSSale) => {
    const inv = sale.invoice_no || sale.sale_number
    if (!window.confirm(`${inv} ফেরত দেবেন?\n• স্টক ফেরত যাবে\n• যত টাকা নেওয়া হয়েছিল ক্যাশ-বুকে ফেরত-ব্যয় হবে\n• এর বকেয়া (যদি থাকে) বাদ যাবে\nএটা পূর্বাবস্থায় ফেরানো যায় না।`)) return
    const reason = window.prompt('ফেরতের কারণ (ঐচ্ছিক):') ?? ''
    const { data, error: rpcError } = await supabase.rpc('refund_pos_sale', { p_sale_id: sale.id, p_reason: reason })
    if (rpcError || !data?.success) {
      alert(data?.message || 'ফেরত দেওয়া যায়নি (ফেজ H-এর SQL রান করা আছে কি?)')
      if (rpcError) console.error('POS ফেরত ত্রুটি:', rpcError)
      return
    }
    logActivity(`POS বিক্রয় ফেরত (${inv})`, 'pos_sale', inv, { refunded: data.refunded, reason })
    fetchRecentSales()
    fetchCatalog()
    setQuickRefresh((n) => n + 1)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* বাম দিক: ক্যাটালগ */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Search className="text-gray-400" size={18} />
            <input
              type="text"
              placeholder="সেবা বা পণ্য খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <QuickItems refreshKey={quickRefresh} onAdd={handleQuickAdd} />

          {loading ? (
            <p className="text-center text-gray-500 py-8">লোড হচ্ছে...</p>
          ) : (
            <div className="space-y-6">
              {filteredServices.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-500 mb-2">সার্ভিস</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredServices.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => addServiceToCart(s)}
                        className="text-left border border-gray-200 rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50 transition"
                      >
                        <p className="text-sm font-semibold truncate">{s.name}</p>
                        <p className="text-xs text-indigo-600 font-bold">৳{s.price}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredInventory.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-500 mb-2">পণ্য (ইনভেন্টরি)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredInventory.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => addInventoryToCart(i)}
                        disabled={i.quantity <= 0}
                        className="text-left border border-gray-200 rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50 transition disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-white"
                      >
                        <p className="text-sm font-semibold truncate">{i.name}</p>
                        <p className="text-xs text-indigo-600 font-bold">৳{i.sell_price}</p>
                        <p className="text-xs text-gray-400">স্টক: {i.quantity} {i.unit}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredServices.length === 0 && filteredInventory.length === 0 && (
                <p className="text-center text-gray-400 py-4">কোনো ফলাফল পাওয়া যায়নি</p>
              )}
            </div>
          )}

          <div className="border-t border-gray-200 mt-6 pt-4">
            <h4 className="text-sm font-bold text-gray-500 mb-2">কাস্টম আইটেম (ক্যাটালগে নেই এমন কিছু)</h4>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="আইটেমের নাম"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="flex-1 min-w-[140px] px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <input
                type="number"
                placeholder="দাম (৳)"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-28 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={addCustomToCart}
                className="flex items-center gap-1 bg-gray-800 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-gray-900 transition"
              >
                <Plus size={14} /> কার্টে যোগ করুন
              </button>
            </div>
          </div>
        </div>

        {/* সাম্প্রতিক বিক্রয় */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 flex items-center gap-3">
            <Receipt className="text-indigo-600" size={20} />
            <h3 className="font-bold">সাম্প্রতিক বিক্রয়</h3>
          </div>
          {recentLoading ? (
            <p className="text-center text-gray-500 py-6">লোড হচ্ছে...</p>
          ) : recentSales.length === 0 ? (
            <p className="text-center text-gray-400 py-6">এখনো কোনো POS বিক্রয় হয়নি</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {recentSales.map((sale) => (
                <div key={sale.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{sale.invoice_no || sale.sale_number}</p>
                    <p className="text-xs text-gray-400">
                      {sale.customer_name ? `${sale.customer_name} • ` : ''}
                      {payMethodLabel(sale.payment_method)} • {formatDistanceToNow(new Date(sale.created_at), { locale: bn, addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {Number(sale.due_amount || 0) > 0 && (
                      <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        বাকি ৳{sale.due_amount}
                      </span>
                    )}
                    {sale.status === 'refunded' && (
                      <span className="text-xs font-semibold text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full">ফেরত</span>
                    )}
                    <p className={`text-sm font-bold ${sale.status === 'refunded' ? 'text-gray-400 line-through' : 'text-indigo-600'}`}>৳{sale.total_amount}</p>
                    <button
                      onClick={() => reprintSale(sale)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition"
                      title="ছোট স্লিপ প্রিন্ট"
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      onClick={() => reprintSale(sale, 'a5')}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition"
                      title="A5 মেমো প্রিন্ট"
                    >
                      <FileText size={16} />
                    </button>
                    {sale.status === 'completed' && (
                      <button
                        onClick={() => refundSale(sale)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                        title="ফেরত দিন (অ্যাডমিন)"
                      >
                        <Undo2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ডান দিক: কার্ট / কাস্টমার / পেমেন্ট */}
      <CartPanel
        cart={cart}
        onQty={updateQuantity}
        onRemove={removeLine}
        onClear={() => {
          setCart([])
          setPreset(null)
        }}
        preset={preset}
        onCompleted={handleCompleted}
      />
    </div>
  )
}
