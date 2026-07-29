import { Image as GalleryIcon, Pencil, Plus, Trash2 } from 'lucide-react'

export default function GalleryTab({ ctx }: { ctx: any }) {
  const {
    galleryPhotos,
    galleryLoading,
    setShowGalleryModal,
    setEditingGalleryPhoto,
    toggleGalleryPhotoActive,
    deleteGalleryPhoto,
  } = ctx

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GalleryIcon className="text-indigo-600" size={22} />
          <div>
            <h2 className="text-xl font-bold">গ্যালারি ম্যানেজমেন্ট</h2>
            <p className="text-sm text-gray-500 mt-1">ওয়েবসাইটের গ্যালারিতে ছবি অ্যাড, এডিট বা ডিলিট করুন</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingGalleryPhoto(null)
            setShowGalleryModal(true)
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <Plus size={16} />
          নতুন ছবি
        </button>
      </div>

      <div className="p-6">
        {galleryLoading ? (
          <p className="text-center text-gray-500 py-8">লোড করছি...</p>
        ) : galleryPhotos.length === 0 ? (
          <p className="text-center text-gray-500 py-8">কোনো ছবি পাওয়া যায়নি</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryPhotos.map((p: any) => (
              <div
                key={p.id}
                className="border border-gray-200 rounded-lg overflow-hidden group relative"
              >
                <div className="aspect-video bg-gray-100">
                  <img src={p.image_url} alt={p.alt_text || ''} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-sm text-gray-700 truncate">{p.alt_text || 'কোনো বর্ণনা নেই'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {p.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </span>
                    <span className="text-xs text-gray-400">ক্রম: {p.display_order}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setEditingGalleryPhoto(p)
                        setShowGalleryModal(true)
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-indigo-600"
                    >
                      <Pencil size={12} />
                      এডিট
                    </button>
                    <button
                      onClick={() => toggleGalleryPhotoActive(p)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {p.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                    </button>
                    <button
                      onClick={() => deleteGalleryPhoto(p)}
                      className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={12} />
                      ডিলিট
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
