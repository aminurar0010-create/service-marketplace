import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { CartLine } from './posTypes'

interface Frequent {
  key: string
  item_type: CartLine['item_type']
  item_ref_id: string | null
  item_name: string
  unit_price: number
  count: number
}

/** সাম্প্রতিক বিক্রি থেকে সবচেয়ে বেশি বিক্রি হওয়া আইটেম — এক ক্লিকে কার্টে যোগ (Quick Buttons) */
export default function QuickItems({
  refreshKey,
  onAdd,
}: {
  refreshKey: number
  onAdd: (line: Omit<CartLine, 'quantity'>) => void
}) {
  const [items, setItems] = useState<Frequent[]>([])

  useEffect(() => {
    ;(async () => {
      const { data: sales } = await supabase
        .from('pos_sales')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(150)
      const ids = (sales || []).map((x: { id: string }) => x.id)
      if (ids.length === 0) return
      const { data, error } = await supabase
        .from('pos_sale_items')
        .select('item_type,item_ref_id,item_name,unit_price')
        .in('sale_id', ids)
      if (error || !data) return
      const map = new Map<string, Frequent>()
      for (const r of data as any[]) {
        const key = r.item_ref_id ? `${r.item_type}:${r.item_ref_id}` : `custom:${r.item_name}`
        const cur = map.get(key)
        if (cur) cur.count += 1
        else
          map.set(key, {
            key,
            item_type: r.item_type,
            item_ref_id: r.item_ref_id,
            item_name: r.item_name,
            unit_price: Number(r.unit_price),
            count: 1,
          })
      }
      setItems([...map.values()].sort((a, b) => b.count - a.count).slice(0, 8))
    })()
  }, [refreshKey])

  if (items.length === 0) return null

  return (
    <div className="mb-5">
      <h4 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1.5">
        <Zap size={14} className="text-amber-500" /> দ্রুত যোগ (বেশি বিক্রি হয়)
      </h4>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button
            key={i.key}
            onClick={() =>
              onAdd({
                key: i.key,
                item_type: i.item_type,
                item_ref_id: i.item_ref_id,
                item_name: i.item_name,
                unit_price: i.unit_price,
              })
            }
            className="px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition"
          >
            {i.item_name} <span className="text-xs text-amber-700">৳{i.unit_price}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
