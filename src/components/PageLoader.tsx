/** lazy-লোড হওয়া পেজ/ট্যাব আসার সময় যে স্পিনার দেখায় */
export default function PageLoader({ full = false }: { full?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${full ? 'min-h-[60vh]' : 'py-16'}`}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ink-600 mx-auto mb-3"></div>
        <p className="text-charcoal/60 text-sm">লোড করছি...</p>
      </div>
    </div>
  )
}
