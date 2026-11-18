import { useEffect } from 'react'

interface EntityModalProps {
  title: string
  open: boolean
  onClose: () => void
  onSubmit: () => void
  children: React.ReactNode
}

export default function EntityModal({ title, open, onClose, onSubmit, children }: EntityModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">Cancelar</button>
          <button onClick={onSubmit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium">
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
