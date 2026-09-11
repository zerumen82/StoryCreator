import { useState, useEffect, useRef } from 'react'
import { useAIConfigStore } from '../store/aiConfigStore'
import { listSdCheckpoints } from '../services/ai'
import { useSdStatus, startSd, stopSd, waitSdReady, isSdControlSupported } from '../utils/sdControl'
import { getModelsStatus, checkOllamaConnection, type ModelStatus } from '../services/ollamaModels'

export default function AISettingsModal({ onClose }: { onClose: () => void }) {
  const { config, updateConfig, resetConfig } = useAIConfigStore()
  const [local, setLocal] = useState(config)
  const [sdModels, setSdModels] = useState<string[]>([])
  const [sdStatus, setSdStatus] = useState<string | null>(null)
  const [sdLoading, setSdLoading] = useState(false)
  const [sdAuto, setSdAuto] = useState(true)
  const [sdBusy, setSdBusy] = useState(false)
  const { status: sdLive } = useSdStatus(8000)
  
  // Modelos Ollama
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null)
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>([])
  const [pullingModel, setPullingModel] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState<string>('')
  const [pullPercent, setPullPercent] = useState<number>(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setLocal(config)
  }, [config])

  useEffect(() => {
    try {
      window.electronAPI?.sd?.getAutostart().then((r) => setSdAuto(!!r.enabled)).catch(() => {})
    } catch {}
  }, [])

  // Comprobar Ollama y modelos al abrir o al cambiar endpoint
  useEffect(() => {
    if (local.provider !== 'ollama') {
      setOllamaConnected(null)
      setModelStatuses([])
      return
    }
    let cancelled = false
    const check = async () => {
      const connected = await checkOllamaConnection(local.endpoint)
      if (cancelled) return
      setOllamaConnected(connected)
      if (connected) {
        try {
          const statuses = await getModelsStatus(local.endpoint, local.model, local.visionModel)
          if (!cancelled) setModelStatuses(statuses)
        } catch { if (!cancelled) setModelStatuses([]) }
      }
    }
    check()
    return () => { cancelled = true }
  }, [local.provider, local.endpoint, local.model, local.visionModel])

  const handleSave = () => {
    updateConfig(local)
    onClose()
  }

  const loadSdModels = async () => {
    setSdLoading(true)
    setSdStatus(null)
    try {
      const models = await listSdCheckpoints(local.sdEndpoint || 'http://127.0.0.1:8188')
      setSdModels(models)
      setSdStatus(models.length > 0 ? `ComfyUI conectado: ${models.length} modelos.` : 'Conectado pero sin checkpoints.')
    } catch (e) {
      setSdModels([])
      setSdStatus(e instanceof Error ? e.message : 'No se pudo conectar. Abre ComfyUI primero.')
    } finally {
      setSdLoading(false)
    }
  }

  const handleAutoDownload = async () => {
    if (pullingModel) {
      abortRef.current?.abort()
      setPullingModel(null)
      return
    }
    abortRef.current = new AbortController()
    setPullProgress('')
    setPullPercent(0)
    
    const missingModels = modelStatuses.filter(m => !m.available)
    if (missingModels.length === 0) {
      setPullProgress('Todos los modelos ya están instalados')
      return
    }
    
    for (const m of missingModels) {
      setPullingModel(m.name)
      setPullProgress(`Descargando ${m.name}...`)
      try {
        const { pullModel } = await import('../services/ollamaModels')
        for await (const update of pullModel(local.endpoint, m.name, abortRef.current.signal)) {
          setPullProgress(update.status)
          if (update.progress !== undefined) setPullPercent(Math.round(update.progress * 100))
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setPullProgress(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
        }
      }
    }
    
    setPullingModel(null)
    setPullPercent(0)
    
    // Refrescar estado
    try {
      const statuses = await getModelsStatus(local.endpoint, local.model, local.visionModel)
      setModelStatuses(statuses)
    } catch {}
  }

  const handlePullSingle = async (modelName: string) => {
    if (pullingModel) return
    abortRef.current = new AbortController()
    setPullingModel(modelName)
    setPullProgress(`Descargando ${modelName}...`)
    setPullPercent(0)
    
    try {
      const { pullModel } = await import('../services/ollamaModels')
      for await (const update of pullModel(local.endpoint, modelName, abortRef.current.signal)) {
        setPullProgress(update.status)
        if (update.progress !== undefined) setPullPercent(Math.round(update.progress * 100))
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setPullProgress(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
      }
    } finally {
      setPullingModel(null)
      setPullPercent(0)
      // Refrescar
      try {
        const statuses = await getModelsStatus(local.endpoint, local.model, local.visionModel)
        setModelStatuses(statuses)
      } catch {}
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Configuración IA</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Proveedor</label>
            <select
              value={local.provider}
              onChange={(e) => setLocal({ ...local, provider: e.target.value as typeof local.provider })}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="openai">OpenAI / Compatible</option>
              <option value="custom">Custom / Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Endpoint</label>
            <input
              value={local.endpoint}
              onChange={(e) => setLocal({ ...local, endpoint: e.target.value })}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              placeholder="http://localhost:11434"
            />
            <p className="text-xs text-gray-500 mt-1">
              {local.provider === 'ollama' && 'Ej: http://localhost:11434'}
              {local.provider === 'openai' && 'Ej: https://api.openai.com'}
              {local.provider === 'custom' && 'URL base de tu API compatible con OpenAI'}
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key (opcional)</label>
            <input
              type="password"
              value={local.apiKey}
              onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Dejar vacío si no se requiere"
            />
            <p className="text-xs text-gray-500 mt-1">No se almacena en servidores externos.</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Modelo de texto</label>
            <input
              value={local.model}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              placeholder="llama3, mistral, etc."
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Modelo de visión (para fotos)</label>
            <input
              value={local.visionModel}
              onChange={(e) => setLocal({ ...local, visionModel: e.target.value })}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              placeholder="llava, bakllava, etc."
            />
            <p className="text-xs text-gray-500 mt-1">Necesario para Caption Studio y entrevistas con fotos.</p>
          </div>

          {/* Panel de estado de modelos Ollama */}
          {local.provider === 'ollama' && (
            <div className="pt-2 border-t border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-200">🤖 Modelos Ollama</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ollamaConnected === null ? 'bg-gray-800 text-gray-500' : ollamaConnected ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                  {ollamaConnected === null ? 'comprobando…' : ollamaConnected ? '● conectado' : '○ sin conexión'}
                </span>
              </div>
              
              {ollamaConnected && modelStatuses.length > 0 && (
                <div className="space-y-2">
                  {modelStatuses.map((m) => (
                    <div key={m.name} className="flex items-center justify-between bg-gray-950 rounded-lg px-3 py-2 border border-gray-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.available ? 'bg-green-400' : 'bg-amber-400'}`} />
                        <span className="text-sm text-gray-200 truncate">{m.name}</span>
                        {m.size && <span className="text-xs text-gray-500">{m.size}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {m.available ? (
                          <span className="text-xs text-green-400">listo</span>
                        ) : pullingModel === m.name ? (
                          <span className="text-xs text-violet-300">{pullPercent > 0 ? `${pullPercent}%` : 'descargando…'}</span>
                        ) : (
                          <button
                            onClick={() => handlePullSingle(m.name)}
                            disabled={!!pullingModel}
                            className="text-xs px-2 py-0.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 rounded"
                          >
                            descargar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Barra de progreso */}
                  {pullingModel && (
                    <div className="space-y-1">
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div
                          className="bg-violet-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${pullPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 text-center">{pullProgress}</p>
                    </div>
                  )}
                  
                  {/* Botón auto-descargar todos */}
                  {modelStatuses.some(m => !m.available) && !pullingModel && (
                    <button
                      onClick={handleAutoDownload}
                      className="w-full px-3 py-2 bg-violet-700 hover:bg-violet-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <span>↓</span>
                      Descargar modelos faltantes
                    </button>
                  )}
                  
                  {modelStatuses.every(m => m.available) && (
                    <p className="text-xs text-green-400 text-center">✓ Todos los modelos listos. La IA cambiará automáticamente entre texto y visión.</p>
                  )}
                </div>
              )}
              
              {ollamaConnected && modelStatuses.length === 0 && (
                <p className="text-xs text-gray-500 text-center">No se pudieron comprobar los modelos</p>
              )}
              
              {!ollamaConnected && ollamaConnected !== null && (
                <div className="text-center space-y-2">
                  <p className="text-xs text-red-300">Ollama no está corriendo en {local.endpoint}</p>
                  <p className="text-xs text-gray-500">Ejecuta <code className="bg-gray-800 px-1 rounded">ollama serve</code> en una terminal</p>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-gray-200 mb-2">🎨 Stable Diffusion local (ComfyUI)</h3>
            <label className="block text-sm text-gray-400 mb-1">Endpoint ComfyUI</label>
            <input
              value={local.sdEndpoint}
              onChange={(e) => setLocal({ ...local, sdEndpoint: e.target.value })}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              placeholder="http://127.0.0.1:8189"
            />
            <div className="flex gap-2 mt-2">
              <select
                value={local.sdCheckpoint}
                onChange={(e) => setLocal({ ...local, sdCheckpoint: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Elige checkpoint…</option>
                {local.sdCheckpoint && !sdModels.includes(local.sdCheckpoint) && (
                  <option value={local.sdCheckpoint}>{local.sdCheckpoint} (guardado)</option>
                )}
                {sdModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                onClick={loadSdModels}
                disabled={sdLoading}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm whitespace-nowrap"
              >
                {sdLoading ? '…' : '🔄 Modelos'}
              </button>
            </div>
            {sdStatus && <p className="text-xs text-gray-400 mt-1">{sdStatus}</p>}
            {isSdControlSupported() && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-300">
                    Estado: {sdLive.running ? '● en marcha' : '○ apagado'}
                  </span>
                  <div className="flex gap-2">
                    {!sdLive.running ? (
                      <button
                        onClick={async () => { setSdBusy(true); try { await startSd(); await waitSdReady(240000) } finally { setSdBusy(false) } }}
                        disabled={sdBusy}
                        className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 rounded-lg text-xs font-medium"
                      >
                        {sdBusy ? 'Arrancando…' : '▶ Arrancar SD'}
                      </button>
                    ) : (
                      <button
                        onClick={async () => { setSdBusy(true); try { await stopSd() } finally { setSdBusy(false) } }}
                        disabled={sdBusy}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-xs"
                      >
                        ⏹ Detener
                      </button>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sdAuto}
                    onChange={async (e) => {
                      const v = e.target.checked
                      setSdAuto(v)
                      try { await window.electronAPI?.sd?.setAutostart(v) } catch {}
                    }}
                    className="accent-violet-500"
                  />
                  Arrancar Stable Diffusion solo al abrir la app
                </label>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">Genera imágenes con tu GPU. Sin esto se usa composición local.</p>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <button
            onClick={resetConfig}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
          >
            Restablecer
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">
              Cancelar
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium">
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
