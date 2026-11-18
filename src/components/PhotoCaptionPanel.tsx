import { useState, useRef, useCallback, useEffect } from 'react'
import { useImageStore } from '../store/imageStore'
import { useAIConfigStore } from '../store/aiConfigStore'
import { useCharacterStore } from '../store/characterStore'
import { useGroupStore } from '../store/groupStore'
import { useMemoryStore } from '../store/memoryStore'
import type { ChatMessage } from '../types'
import { streamChat, analyzeImage } from '../services/ai'

interface CaptionStyle {
  id: string; name: string; fontFamily: string; fontSize: number; color: string; backgroundColor: string; position: 'top' | 'bottom' | 'center'; padding: number; preview: string
}

const captionStyles: CaptionStyle[] = [
  { id: 'cinematic', name: 'Cinematografico', fontFamily: 'Georgia, serif', fontSize: 24, color: '#ffffff', backgroundColor: 'rgba(0, 0, 0, 0.75)', position: 'bottom', padding: 20, preview: 'Georgia' },
  { id: 'minimal', name: 'Minimalista', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, color: '#ffffff', backgroundColor: 'transparent', position: 'bottom', padding: 16, preview: 'Inter' },
  { id: 'dramatic', name: 'Dramatico', fontFamily: 'Impact, sans-serif', fontSize: 36, color: '#ef4444', backgroundColor: 'rgba(0, 0, 0, 0.85)', position: 'center', padding: 24, preview: 'Impact Rojo' },
  { id: 'neon', name: 'Neon', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 20, color: '#22d3ee', backgroundColor: 'rgba(0, 0, 0, 0.6)', position: 'bottom', padding: 16, preview: 'Cyan glow' },
]

export default function PhotoCaptionPanel() {
  const { images, addImage, updateImage } = useImageStore()
  const { config } = useAIConfigStore()
  const { characters } = useCharacterStore()
  const { groups } = useGroupStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [customCaption, setCustomCaption] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const currentImage = images.find((img) => img.id === selectedImage)
  const selectedStyle = captionStyles[0]

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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => { processFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = '' }
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files) }
  const clearError = () => setError(null)

  const analyzePhoto = async (imageId: string) => {
    const image = images.find((img) => img.id === imageId)
    if (!image) return
    if (!config.endpoint || !config.visionModel) { setError('Configura el endpoint y modelo de vision (Configuracion IA)'); return }
    setError(null)
    try {
      const characterContext = characters.map((c) => ({ name: c.name, description: c.description, role: c.role, traits: c.traits, age: c.age, gender: c.gender, hairColor: c.hairColor, eyeColor: c.eyeColor, skinColor: c.skinColor, build: c.build, marks: c.marks }))
      const groupContext = groups.map((g) => ({ name: g.name, theme: g.theme, purpose: g.purpose }))
      const prompt = `Analiza esta imagen y responde en formato JSON: {"characters": [{"name": "nombre del personaje", "isExisting": true/false, "confidence": 0-1, "suggestedRole": "protagonist/antagonist/supporting/minor"}], "caption": "caption creativo en español", "theme": "tematica", "atmosphere": "atmosfera"}. Personajes guardados: ${JSON.stringify(characterContext)}. Grupos: ${JSON.stringify(groupContext)}. Responde SOLO en español de España.`
      const content = await analyzeImage(image.dataUrl, prompt, config)
      // llava casi nunca devuelve JSON puro: viene con ```json, texto extra
      // o comas rotas. Extraer el primer {...} y reintentar con limpieza.
      const extractJson = (raw: string): string => {
        const noFence = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '')
        const start = noFence.indexOf('{')
        const end = noFence.lastIndexOf('}')
        if (start >= 0 && end > start) return noFence.slice(start, end + 1)
        return noFence
      }
      let parsed: { caption?: string } | null = null
      try {
        parsed = JSON.parse(extractJson(content))
      } catch {
        // fallback: usar el texto crudo como caption (mejor que error)
        const fallback = content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim().slice(0, 300)
        if (fallback) setCustomCaption(fallback)
        return
      }
      if (parsed?.caption) setCustomCaption(parsed.caption)
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al analizar') }
  }

  const generateCaptionWithAI = async () => {
    if (!currentImage) return
    if (!config.endpoint) { setError('Configura el endpoint de IA primero'); return }
    setError(null)
    try {
      // Prompt autocontenido como unico mensaje de usuario: streamChat solo
      // antepone el system generico SIN contexto pesado (sin fichas ni memoria),
      // asi no divaga y devuelve solo el caption.
      const messages: ChatMessage[] = [{ id: '1', role: 'user', content: `Genera un caption creativo en español de España para una foto. Responde SOLO con el caption, sin comillas ni explicaciones. Maximo 2 frases.`, timestamp: Date.now() }]
      let fullCaption = ''
      const stream = streamChat(messages, config, undefined, undefined, '')
      for await (const chunk of stream) fullCaption += chunk
      setCustomCaption(fullCaption.trim().replace(/^["«“]+|["»”]+$/g, ''))
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al generar') }
  }

  const renderCaptionOnImage = useCallback(() => {
    if (!canvasRef.current || !currentImage) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      if (customCaption) {
        const scale = img.width / 1000
        const fontSize = selectedStyle.fontSize * scale
        const padding = selectedStyle.padding * scale
        ctx.font = `${fontSize}px ${selectedStyle.fontFamily}`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const maxWidth = canvas.width - padding * 4
        const lines = wrapText(ctx, customCaption, maxWidth)
        const lineHeight = fontSize * 1.4
        const totalHeight = lines.length * lineHeight
        let yPos: number
        if (selectedStyle.position === 'top') yPos = padding + lineHeight / 2
        else if (selectedStyle.position === 'center') yPos = canvas.height / 2 - totalHeight / 2 + lineHeight / 2
        else yPos = canvas.height - padding - totalHeight + lineHeight / 2
        if (selectedStyle.backgroundColor !== 'transparent') {
          ctx.fillStyle = selectedStyle.backgroundColor
          const bgHeight = totalHeight + padding
          let bgY: number
          if (selectedStyle.position === 'top') bgY = 0
          else if (selectedStyle.position === 'center') bgY = yPos - lineHeight / 2 - padding / 2
          else bgY = canvas.height - bgHeight
          ctx.fillRect(0, bgY, canvas.width, bgHeight)
        }
        if (selectedStyle.id === 'neon') { ctx.shadowColor = selectedStyle.color; ctx.shadowBlur = 20 }
        ctx.fillStyle = selectedStyle.color
        lines.forEach((line, index) => ctx.fillText(line, canvas.width / 2, yPos + index * lineHeight))
        ctx.shadowBlur = 0
      }
    }
    img.src = currentImage.dataUrl
  }, [currentImage, customCaption, selectedStyle])

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' '); const lines: string[] = []; let currentLine = ''
    words.forEach((word) => { const testLine = currentLine ? `${currentLine} ${word}` : word; const metrics = ctx.measureText(testLine); if (metrics.width > maxWidth && currentLine) { lines.push(currentLine); currentLine = word } else { currentLine = testLine } })
    if (currentLine) lines.push(currentLine)
    return lines
  }

  useEffect(() => { renderCaptionOnImage() }, [renderCaptionOnImage])

  const saveCaptionedImage = () => {
    if (!canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    addImage({ dataUrl, caption: customCaption, prompt: `Caption: ${customCaption} | Style: ${selectedStyle.name}` })
    // Aprender el estilo de caption que le gusta al usuario
    try {
      useMemoryStore.getState().addMemory(
        'preference',
        `Estilo de caption '${selectedStyle.name}' con texto: ${customCaption.slice(0, 150)}`,
        0.9
      )
    } catch (e) {
      console.debug('[caption] No se pudo guardar preferencia:', e)
    }
  }

  const toggleImageCharacter = (charId: string) => {
    if (!currentImage) return
    const ids = currentImage.characterIds || []
    const next = ids.includes(charId) ? ids.filter((id) => id !== charId) : [...ids, charId]
    updateImage(currentImage.id, { characterIds: next })
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center"><span className="text-lg">📸</span></div>
            <div><h1 className="text-xl font-bold text-white">Caption Studio</h1><p className="text-sm text-gray-500">Analisis de imagenes con IA</p></div>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Subir foto
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
        </div>

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3"><span className="text-red-400">⚠️</span><p className="text-sm text-red-300">{error}</p></div>
            <button onClick={clearError} className="text-red-400 hover:text-red-300 p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 p-4">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Imagenes</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {images.length === 0 ? (
                  <div onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={`h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${dragOver ? 'border-violet-500 bg-violet-500/10' : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'}`}>
                    <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-xs text-gray-500">Arrastra o haz click</p>
                  </div>
                ) : (
                  images.map((image) => (
                    <div key={image.id} onClick={() => setSelectedImage(image.id)} className={`relative rounded-xl overflow-hidden cursor-pointer transition-all ${selectedImage === image.id ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#12121a]' : 'hover:ring-2 hover:ring-gray-600 hover:ring-offset-1 hover:ring-offset-[#12121a]'}`}>
                      <img src={image.dataUrl} alt="" className="w-full h-20 object-cover" />
                      {image.caption && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"><p className="absolute bottom-1 left-1 right-1 text-xs text-white truncate">{image.caption}</p></div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {currentImage ? (
              <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Vista previa</h3>
                  <div className="flex gap-2">
                    <button onClick={() => analyzePhoto(currentImage.id)} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2">🔍 Analizar</button>
                    <button onClick={generateCaptionWithAI} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2">✨ Generar caption</button>
                    <button onClick={saveCaptionedImage} disabled={!customCaption} className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2">💾 Guardar</button>
                  </div>
                </div>
                <div className="bg-[#0a0a0f] rounded-xl overflow-hidden flex items-center justify-center p-4">
                  <canvas ref={canvasRef} className="max-w-full max-h-full rounded-lg shadow-2xl" style={{ maxHeight: '400px' }} />
                </div>
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    Personajes en esta foto {currentImage.characterIds?.length ? `(${currentImage.characterIds.length})` : ''}
                  </h4>
                  {characters.length === 0 ? (
                    <p className="text-xs text-gray-500">Crea personajes primero para enlazarlos a tus fotos.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {characters.map((char) => {
                        const selected = (currentImage.characterIds || []).includes(char.id)
                        return (
                          <button
                            key={char.id}
                            type="button"
                            onClick={() => toggleImageCharacter(char.id)}
                            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                              selected ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            {char.name || 'Sin nombre'}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 p-12 text-center">
                <h3 className="text-xl font-semibold text-white mb-2">Sin imagen seleccionada</h3>
                <p className="text-gray-500 mb-6">Sube una imagen o selecciona una de la galeria</p>
                <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Subir imagen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}