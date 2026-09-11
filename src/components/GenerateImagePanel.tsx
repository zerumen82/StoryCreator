import { useState, useCallback } from 'react'
import { useCharacterStore } from '../store/characterStore'
import { useLocationStore } from '../store/locationStore'
import { useGroupStore } from '../store/groupStore'
import { useImageStore } from '../store/imageStore'
import { useAIConfigStore } from '../store/aiConfigStore'
import { generateImage, generateImageComfy } from '../services/ai'
import { useSdStatus, startSd, waitSdReady, isSdControlSupported } from '../utils/sdControl'

export default function GenerateImagePanel() {
  const { characters } = useCharacterStore()
  const { locations } = useLocationStore()
  const { groups } = useGroupStore()
  const { images, addImage } = useImageStore()
  const { config } = useAIConfigStore()
  const [caption, setCaption] = useState('')
  const [selectedChars, setSelectedChars] = useState<string[]>([])
  const [selectedLoc, setSelectedLoc] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [aiUsed, setAiUsed] = useState<'comfy' | 'openai' | 'local' | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleChar = (id: string) => {
    setSelectedChars(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const handleGenerate = useCallback(async () => {
    if (!caption.trim() || generating) return
    setError(null)
    setAiUsed(null)
    const names = selectedChars.map(id => characters.find(c => c.id === id)?.name || 'Personaje').join(', ')
    const locName = locations.find(l => l.id === selectedLoc)?.name
    const groupName = groups.find(g => g.id === selectedGroup)?.name
    const prompt = [caption.trim(), names && `Personajes: ${names}`, locName && `Lugar: ${locName}`, groupName && `Grupo: ${groupName}`].filter(Boolean).join('. ')

    // 1. Stable Diffusion local via tu ComfyUI (tu GPU, tus checkpoints)
    if (config.sdEndpoint && config.sdCheckpoint) {
      setGenerating(true)
      setStage('Conectando con ComfyUI…')
      try {
        const dataUrl = await generateImageComfy(
          prompt,
          { endpoint: config.sdEndpoint, checkpoint: config.sdCheckpoint },
          undefined,
          (s) => setStage(s)
        )
        setGeneratedUrl(dataUrl)
        setAiUsed('comfy')
        return
      } catch (e) {
        setError(`ComfyUI falló (${e instanceof Error ? e.message : 'error'}). Pruebo alternativas.`)
      } finally {
        setGenerating(false)
        setStage(null)
      }
    }

    // 2. IA real si el proveedor tiene endpoint de imagenes (OpenAI-compatible con API key).
    // Ollama NO genera imagenes: no tiene ese endpoint, asi que se usa composicion local.
    if (config.provider !== 'ollama' && config.apiKey) {
      setGenerating(true)
      try {
        const url = await generateImage(prompt, config)
        if (url) {
          setGeneratedUrl(url)
          setAiUsed('openai')
          setGenerating(false)
          return
        }
      } catch (e) {
        setError(`La IA de imágenes falló (${e instanceof Error ? e.message : 'error'}). Genero composición local.`)
      }
      setGenerating(false)
    }

    // 3. Composicion local: tarjeta con caption + referencias a fotos asociadas
    const relatedImages = images.filter(img => {
      const charIds = img.characterIds || []
      return selectedChars.some(sc => charIds.includes(sc))
    })
    const canvas = document.createElement('canvas')
    canvas.width = 800; canvas.height = 500
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#1a1033'; ctx.fillRect(0, 0, 800, 500)
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px Georgia, serif'; ctx.textAlign = 'center'
    ctx.fillText(caption.slice(0, 100), 400, 200)
    ctx.fillStyle = '#a78bfa'; ctx.font = '16px Inter, sans-serif'
    ctx.fillText('Personajes: ' + names, 400, 250)
    if (relatedImages.length > 0) {
      ctx.fillStyle = '#8b5cf6'; ctx.font = '12px Inter, sans-serif'
      ctx.fillText('Fotos asociadas disponibles: ' + relatedImages.length, 400, 290)
    }
    setGeneratedUrl(canvas.toDataURL('image/png'))
    setAiUsed('local')
  }, [caption, generating, selectedChars, selectedLoc, selectedGroup, images, characters, locations, groups, config])

  const handleSave = () => {
    if (!generatedUrl || !caption) return
    addImage({
      dataUrl: generatedUrl,
      caption: caption,
      prompt: 'Inverso: caption con personajes ' + selectedChars.map(id => characters.find(c => c.id === id)?.name).join(', '),
      characterIds: selectedChars,
      locationIds: selectedLoc ? [selectedLoc] : [],
      groupIds: selectedGroup ? [selectedGroup] : [],
      tags: ['inverse', aiUsed === 'comfy' ? 'comfyui' : aiUsed === 'openai' ? 'dalle' : 'composition'],
      updatedAt: Date.now(),
      createdAt: Date.now()
    } as any)
    setGeneratedUrl(null); setCaption(''); setSelectedChars([]); setAiUsed(null)
  }

  const sdReady = !!(config.sdEndpoint && config.sdCheckpoint)
  const { status: sdStatus, refresh: refreshSd } = useSdStatus(10000)
  const [sdStarting, setSdStarting] = useState(false)

  const handleStartSd = async () => {
    setError(null)
    setSdStarting(true)
    try {
      await startSd()
      const ok = await waitSdReady(240000)
      if (!ok) setError('ComfyUI tarda más de lo esperado. Revisa la ventana/consola del SD.')
      refreshSd()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo arrancar. Usa iniciar_SD_StoryCreator.bat')
    } finally {
      setSdStarting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold">Generar imagen desde caption (Inverso de Caption Studio)</h2>
          {sdStatus.running ? (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
              ● SD listo{sdReady ? `: ${config.sdCheckpoint}` : ''}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
              ○ SD apagado
              {isSdControlSupported() ? (
                <button onClick={handleStartSd} disabled={sdStarting} className="px-2 py-0.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 rounded-full text-white font-medium">
                  {sdStarting ? 'Arrancando…' : '▶ Arrancar'}
                </button>
              ) : (
                <span className="text-gray-500">usa iniciar_SD_StoryCreator.bat</span>
              )}
            </span>
          )}
        </div>
        {!sdReady && (
          <p className="text-xs text-gray-500">
            Configura tu ComfyUI en ⚙️ Configuración IA → Stable Diffusion para generar con tu GPU.
            Sin eso se crea una composición local con el caption.
          </p>
        )}
        <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Ej: Una escena dramática con los personajes reunidos..." className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white min-h-[100px] resize-y focus:outline-none focus:border-violet-500" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <h3 className="text-xs text-gray-400 mb-2">Personajes</h3>
            <div className="flex flex-wrap gap-1.5">
              {characters.map(ch => (
                <button key={ch.id} onClick={() => toggleChar(ch.id)} className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${selectedChars.includes(ch.id) ? 'bg-violet-700 border-violet-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-violet-500'}`}>{ch.name || 'Sin nombre'}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Lugar</label>
            <select value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white">
              <option value="">Ninguno</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Grupo</label>
            <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white">
              <option value="">Ninguno</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={!caption.trim() || generating} className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold shadow-lg shadow-violet-900/30 transition-colors">
          {generating ? (stage || 'Generando…') : sdReady ? '🎨 Generar con Stable Diffusion' : 'Generar imagen'}
        </button>
        {error && <p className="text-xs text-amber-300">{error}</p>}
        {generatedUrl && (
          <div className="space-y-3 bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-2xl shadow-violet-900/10">
            <h3 className="text-lg font-bold text-white">
              Imagen generada{' '}
              <span className="text-xs font-normal text-gray-400">
                ({aiUsed === 'comfy' ? 'Stable Diffusion local' : aiUsed === 'openai' ? 'IA en nube' : 'composición local'})
              </span>
            </h3>
            <img src={generatedUrl} alt="Generada" className="w-full max-h-[400px] object-contain rounded-xl bg-gray-950 border border-gray-800 shadow-inner" />
            <div className="flex gap-3">
              <button onClick={handleSave} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold shadow-lg shadow-violet-900/20">Guardar imagen</button>
              <button onClick={() => { setGeneratedUrl(null); setCaption(''); }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm border border-gray-600">Limpiar</button>
            </div>
            <p className="text-xs text-gray-400">Esta imagen se generó a partir del caption y los elementos seleccionados. La IA puede usar estas referencias en historias futuras.</p>
          </div>
        )}
      </div>
    </div>
  )
}
