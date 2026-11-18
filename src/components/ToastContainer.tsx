import { useToastStore } from '../store/toastStore'

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`px-4 py-2 rounded-lg text-sm shadow-lg cursor-pointer border ${
            t.type === 'success' ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100' :
            t.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' :
            'bg-gray-900/90 border-gray-700 text-gray-100'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
