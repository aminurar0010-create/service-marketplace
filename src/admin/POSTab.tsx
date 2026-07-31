import { useEffect, useMemo, useState } from 'react'
import { supabase, Service, InventoryItem, POSSale, POSSaleItem, CreatePOSSaleResult, logActivity } from '../lib/supabase'
import { ShoppingCart, Plus, Minus, Trash2, Printer, Receipt, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'
import { printReceipt } from '../lib/receipt'

interface CartLine {
  key: string
  item_type: 'service' | 'inventory' | 'custom'
  item_ref_id: string | null
  item_name: string
  quantity: number
  unit_price: number
  max_quantity?: number
}

export default function POSTab() {
  const [services, setServices] = useState<Service[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])

  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')

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

  const clearCart = () => {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setDiscountAmount('0')
    setPaymentMethod('cash')
    setError('')
  }

  const subtotal = useMemo(() => cart.reduce((sum, l) => sum + l.quantity * l.unit_price, 0), [cart])
  const total = Math.max(subtotal - Number(discountAmount || 0), 0)

  const filteredServices = services.filter((s) => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()))
  const filteredInventory = inventoryItems.filter((i) => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()))

  const handleCheckout = async () => {
    setError('')
    if (cart.length === 0) {
      setError('কার্টে কোনো আইটেম নেই')
      return
    }
    setCheckingOut(true)
    try {
      const payload = cart.map((l) => ({
        item_type: l.item_type,
        item_ref_id: l.item_ref_id || '',
        item_name: l.item_name,
        quantity: l.quantity,
        unit_price: l.unit_price,
      }))

      const { data, error: rpcError } = await supabase.rpc('create_pos_sale', {
        p_items: payload,
        p_customer_name: customerName.trim() || null,
        p_customer_phone: customerPhone.trim() || null,
        p_payment_method: paymentMethod,
        p_discount_amount: Number(discountAmount || 0),
      })

      if (rpcError) throw rpcError
      const result = data as CreatePOSSaleResult
      if (!result?.success) {
        setError(result?.message || 'বিক্রয় সম্পন্ন করতে সমস্যা হয়েছে')
        setCheckingOut(false)
        return
      }

      logActivity(`POS বিক্রয় সম্পন্ন (${result.sale_number})`, 'pos_sale', result.sale_number, {
        total_amount: result.total_amount,
      })

      // রশিদ প্রিন্টের জন্য সম্পূর্ণ সেল ও আইটেম আবার লোড করা
      const { data: saleData } = await supabase.from('pos_sales').select('*').eq('id', result.sale_id).single()
      const { data: saleItemsData } = await supabase.from('pos_sale_items').select('*').eq('sale_id', result.sale_id)

      if (saleData) {
        printReceipt(saleData as POSSale, (saleItemsData || []) as POSSaleItem[])
      }

      clearCart()
      fetchCatalog()
      fetchRecentSales()
    } catch (err) {
      console.error('চেকআউট ত্রুটি:', err)
      setError('বিক্রয় সম্পন্ন করতে সমস্যা হয়েছে')
    } finally {
      setCheckingOut(false)
    }
  }

  const reprintSale = async (sale: POSSale) => {
    try {
      const { data: saleItemsData, error: fetchError } = await supabase
        .from('pos_sale_items')
        .select('*')
        .eq('sale_id', sale.id)
      if (fetchError) throw fetchError
      printReceipt(sale, (saleItemsData || []) as POSSaleItem[])
    } catch (err) {
      console.error('রিপ্রিন্ট ত্রুটি:', err)
      alert('রশিদ পুনরায় প্রিন্ট করতে সমস্যা হয়েছে')
    }
  }

  const paymentLabel = (method: string) => {
    const labels: Record<string, string> = { cash: 'নগদ', bkash: 'বিকাশ', nagad: 'নগদ (Nagad)', rocket: 'রকেট' }
    return labels[method] || method
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
                    <p className="text-sm font-semibold">{sale.sale_number}</p>
                    <p className="text-xs text-gray-400">
                      {paymentLabel(sale.payment_method)} • {formatDistanceToNow(new Date(sale.created_at), { locale: bn, addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-indigo-600">৳{sale.total_amount}</p>
                    <button
                      onClick={() => reprintSale(sale)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition"
                      title="রশিদ প্রিন্ট"
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ডান দিক: কার্ট / চেকআউট */}
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
                  <p className="text-xs text-gray-400">৳{line.unit_price} × {line.quantity} = ৳{line.unit_price * line.quantity}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => updateQuantity(line.key, -1)} className="p-1 border border-gray-300 rounded hover:bg-gray-50">
                    <Minus size={12} />
                  </button>
                  <span className="text-sm w-5 text-center">{line.quantity}</span>
                  <button onClick={() => updateQuantity(line.key, 1)} className="p-1 border border-gray-300 rounded hover:bg-gray-50">
                    <Plus size={12} />
                  </button>
                  <button onClick={() => removeLine(line.key)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-gray-200 pt-4">
          <input
            type="text"
            placeholder="কাস্টমারের নাম (ঐচ্ছিক)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <input
            type="text"
            placeholder="ফোন নম্বর (ঐচ্ছিক)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="cash">নগদ (ক্যাশ)</option>
            <option value="bkash">বিকাশ</option>
            <option value="nagad">নগদ (Nagad)</option>
            <option value="rocket">রকেট</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">ছাড় (৳)</label>
            <input
              type="number"
              min={0}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="border-t border-gray-200 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>সাবটোটাল</span>
              <span>৳{subtotal}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>ছাড়</span>
              <span>৳{Number(discountAmount || 0)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900">
              <span>সর্বমোট</span>
              <span>৳{total}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={checkingOut || cart.length === 0}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {checkingOut ? 'প্রসেস হচ্ছে...' : 'বিক্রয় সম্পন্ন করুন ও রশিদ প্রিন্ট করুন'}
          </button>
          <button
            onClick={clearCart}
            className="w-full border border-gray-300 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
          >
            কার্ট খালি করুন
          </button>
        </div>
      </div>
    </div>
  )
}
