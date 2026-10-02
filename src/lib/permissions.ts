/**
 * Permission ম্যাট্রিক্স — কোন রোল কোন ট্যাব দেখবে ও কোন অ্যাকশন করবে, এক জায়গায়।
 *
 * ⚠️ এটা শুধু স্ক্রিনে কী দেখাবে তা ঠিক করে। আসল নিরাপত্তা Supabase-এর RLS/ফাংশনে
 * (supabase_phaseG_security_migration.sql) — দুটো মিলিয়ে রাখুন; এখানে বদলালে SQL-ও বদলান।
 *
 * রোল: admin = সব; counter_operator = কাউন্টারের কাজ (অর্ডার, কাস্টমার, ক্যাশ-বুক)।
 * (staff রোল আলাদা StaffDashboard ব্যবহার করে — এখানে নেই।)
 */
export type DashboardRole = 'admin' | 'counter_operator'

const ALL: DashboardRole[] = ['admin', 'counter_operator']
const ADMIN: DashboardRole[] = ['admin']

/** ট্যাব → কে দেখতে পারবে। তালিকায় না থাকা ট্যাব শুধু অ্যাডমিনের। */
export const TAB_ACCESS: Record<string, DashboardRole[]> = {
  today: ALL,
  orders: ALL,
  customer_ledger: ALL,
  cashbook: ALL,
  // নিচেরগুলো ইচ্ছাকৃতভাবে শুধু অ্যাডমিন (স্পষ্টতার জন্য লেখা)
  services: ADMIN, staff: ADMIN, coupons: ADMIN, performance: ADMIN, messages: ADMIN, gallery: ADMIN,
  reviews: ADMIN, reports: ADMIN, inventory: ADMIN, pos: ADMIN, due_collection: ADMIN, users: ADMIN,
  website: ADMIN, blog: ADMIN, prompts: ADMIN, leads: ADMIN, templates: ADMIN, portfolio: ADMIN,
  courses: ADMIN, enrollments: ADMIN, training: ADMIN, settings: ADMIN,
}

/** অ্যাকশন → কে করতে পারবে */
export const ACTION_ACCESS: Record<string, DashboardRole[]> = {
  'cashbook.add': ALL,
  'cashbook.delete': ADMIN,
  'activitylog.view': ADMIN,
}

const isDashboardRole = (r: string | null | undefined): r is DashboardRole => r === 'admin' || r === 'counter_operator'

export const canViewTab = (role: string | null | undefined, tab: string) =>
  isDashboardRole(role) && (TAB_ACCESS[tab] || ADMIN).includes(role)

export const canDo = (role: string | null | undefined, action: string) =>
  isDashboardRole(role) && (ACTION_ACCESS[action] || ADMIN).includes(role)
