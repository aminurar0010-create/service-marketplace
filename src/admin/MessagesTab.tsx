import { MessageSquare, Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { bn } from 'date-fns/locale'

export default function MessagesTab({ ctx }: { ctx: any }) {
  const { staffList, messages, selectedStaffId, messageText, setMessageText, messagesLoading, sendingMessage, user, getUnreadCount, selectStaffConversation, sendMessage } = ctx

  return (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center gap-3">
              <MessageSquare className="text-indigo-600" size={22} />
              <h2 className="text-xl font-bold">ইন্টারনাল মেসেজিং</h2>
            </div>

            <div className="flex h-[600px]">
              {/* স্টাফ লিস্ট */}
              <div className="w-72 border-r border-gray-200 overflow-y-auto">
                {staffList.length === 0 ? (
                  <p className="p-6 text-center text-sm text-gray-500">কোনো স্টাফ পাওয়া যায়নি</p>
                ) : (
                  staffList.map((staff: any) => {
                    const unread = getUnreadCount(staff.id)
                    const staffMessages = messages.filter(
                      (m: any) => m.sender_id === staff.id || m.receiver_id === staff.id
                    )
                    const lastMessage = staffMessages[staffMessages.length - 1]
                    return (
                      <button
                        key={staff.id}
                        onClick={() => selectStaffConversation(staff.id)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition flex items-start gap-3 ${
                          selectedStaffId === staff.id ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {(staff.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm truncate">{staff.full_name || 'নামহীন স্টাফ'}</p>
                            {unread > 0 && (
                              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center flex-shrink-0">
                                {unread}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {lastMessage ? lastMessage.content : 'কোনো মেসেজ নেই'}
                          </p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              {/* চ্যাট প্যানেল */}
              <div className="flex-1 flex flex-col">
                {!selectedStaffId ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                    কথোপকথন শুরু করতে বাম পাশ থেকে একজন স্টাফ নির্বাচন করুন
                  </div>
                ) : (
                  <>
                    <div className="px-6 py-4 border-b border-gray-200">
                      <p className="font-bold">
                        {staffList.find((s: any) => s.id === selectedStaffId)?.full_name || 'নামহীন স্টাফ'}
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-gray-50">
                      {messagesLoading ? (
                        <p className="text-center text-sm text-gray-400">লোড করছি...</p>
                      ) : (
                        messages
                          .filter(
                            (m: any) =>
                              (m.sender_id === user.id && m.receiver_id === selectedStaffId) ||
                              (m.sender_id === selectedStaffId && m.receiver_id === user.id)
                          )
                          .map((m: any) => (
                            <div
                              key={m.id}
                              className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                                  m.sender_id === user.id
                                    ? 'bg-indigo-600 text-white rounded-br-sm'
                                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                <p
                                  className={`text-[10px] mt-1 ${
                                    m.sender_id === user.id ? 'text-indigo-200' : 'text-gray-400'
                                  }`}
                                >
                                  {formatDistanceToNow(new Date(m.created_at), { locale: bn, addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          ))
                      )}
                    </div>

                    <div className="p-4 border-t border-gray-200 flex gap-2">
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        placeholder="মেসেজ লিখুন..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!messageText.trim() || sendingMessage}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
  )
}
