import { useState, useRef, useCallback } from 'react'
import { useImageStore } from '../store/imageStore'

export default function ImagesPanel() {
  const { images, addImage, deleteImage } = useImageStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFiles = useCallback((files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const maxDim = 1280
          let { width, height } = img
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height)
            width = Math.round(width * scale)
            height = Math.round(height * scale)
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.drawImage(img, 0, 0, width, height)
          addImage({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), caption: '', prompt: '' })
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })
  }, [addImage])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    processFiles(e.dataTransfer.files)
  }



  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Imágenes</h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium"
          >
            + Subir imagen
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
        </div>

        {error && <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">{error}</div>}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragOver ? 'border-indigo-500 bg-indigo-900/10' : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <p className="text-gray-500 text-sm">Arrastra imágenes aquí o usa el botón de arriba</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image) => (
            <div key={image.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden space-y-3">
              <img src={image.dataUrl} alt="Uploaded" className="w-full h-48 object-cover" />
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Caption</label>
                  <p className="text-sm text-gray-300 bg-gray-950 p-2 rounded-lg border border-gray-800">{image.caption || 'Sin caption generado'}</p>
                </div>
                <button
                  onClick={() => { if (window.confirm('¿Borrar esta imagen?')) deleteImage(image.id) }}
                  className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded-lg text-xs"
                >
                  Borrar imagen
                </button>
              </div>
            </div>
          ))}
        </div>

        {images.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">🖼️</p>
            <p>Sube imágenes para generar captions con IA.</p>
          </div>
        )}
      </div>
    </div>
  )
}
