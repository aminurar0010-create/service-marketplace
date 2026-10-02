export interface CartLine {
  key: string
  item_type: 'service' | 'inventory' | 'custom'
  item_ref_id: string | null
  item_name: string
  quantity: number
  unit_price: number
  max_quantity?: number
}

export type PayMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'other'

export const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: 'cash', label: 'নগদ (ক্যাশ)' },
  { id: 'bkash', label: 'বিকাশ' },
  { id: 'nagad', label: 'নগদ (Nagad)' },
  { id: 'rocket', label: 'রকেট' },
  { id: 'other', label: 'অন্যান্য' },
]

export const payMethodLabel = (m: string) =>
  PAY_METHODS.find((p) => p.id === m)?.label || (m === 'due' ? 'বাকি' : m)
