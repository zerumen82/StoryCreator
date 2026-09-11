import { useAIConfigStore } from '../store/aiConfigStore'

export interface OllamaModel {
  name: string
  size: number
  modified_at: string
  details?: {
    parameter_size?: string
    quantization_level?: string
  }
}

export interface ModelStatus {
  name: string
  available: boolean
  loading: boolean
  size?: string
  error?: string
}

// Listar modelos instalados en Ollama
export async function listOllamaModels(endpoint: string): Promise<OllamaModel[]> {
  const response = await fetch(`${endpoint}/api/tags`, { method: 'GET' })
  if (!response.ok) throw new Error(`Ollama no responde (${response.status})`)
  const data = await response.json()
  return data.models || []
}

// Verificar si un modelo específico está disponible
export async function isModelAvailable(endpoint: string, modelName: string): Promise<boolean> {
  try {
    const models = await listOllamaModels(endpoint)
    return models.some(m => m.name === modelName || m.name.startsWith(modelName + ':'))
  } catch {
    return false
  }
}

// Obtener estado de los modelos configurados
export async function getModelsStatus(endpoint: string, textModel: string, visionModel: string): Promise<ModelStatus[]> {
  const models = await listOllamaModels(endpoint)
  const findModel = (name: string) => models.find(m => m.name === name || m.name.startsWith(name + ':'))
  
  const textM = findModel(textModel)
  const visionM = findModel(visionModel)
  
  const formatSize = (bytes?: number) => {
    if (!bytes) return '?'
    const gb = bytes / (1024 * 1024 * 1024)
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }
  
  return [
    {
      name: textModel,
      available: !!textM,
      loading: false,
      size: textM ? formatSize(textM.size) : undefined,
    },
    {
      name: visionModel,
      available: !!visionM,
      loading: false,
      size: visionM ? formatSize(visionM.size) : undefined,
    },
  ]
}

// Descargar un modelo (streaming de progreso)
export async function* pullModel(
  endpoint: string,
  modelName: string,
  signal?: AbortSignal
): AsyncGenerator<{ status: string; progress?: number }> {
  const response = await fetch(`${endpoint}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
    signal,
  })
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Error descargando ${modelName}: ${response.status} - ${text}`)
  }
  
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No se pudo leer la respuesta')
  
  const decoder = new TextDecoder()
  let buffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const json = JSON.parse(line)
        yield {
          status: json.status || 'descargando',
          progress: json.completed && json.total ? json.completed / json.total : undefined,
        }
      } catch {
        // skip malformed JSON
      }
    }
  }
}

// Eliminar un modelo
export async function deleteModel(endpoint: string, modelName: string): Promise<void> {
  const response = await fetch(`${endpoint}/api/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
  })
  if (!response.ok) throw new Error(`Error eliminando ${modelName}`)
}

// Verificar si Ollama está corriendo
export async function checkOllamaConnection(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(3000) })
    return response.ok
  } catch {
    return false
  }
}

// Auto-descargar modelos faltantes
export async function ensureModels(
  endpoint: string,
  textModel: string,
  visionModel: string,
  onProgress?: (model: string, status: string, progress?: number) => void,
  signal?: AbortSignal
): Promise<{ textReady: boolean; visionReady: boolean }> {
  const models = await listOllamaModels(endpoint)
  const hasModel = (name: string) => models.some(m => m.name === name || m.name.startsWith(name + ':'))
  
  let textReady = hasModel(textModel)
  let visionReady = hasModel(visionModel)
  
  if (!textReady) {
    onProgress?.(textModel, 'iniciando descarga')
    try {
      for await (const update of pullModel(endpoint, textModel, signal)) {
        onProgress?.(textModel, update.status, update.progress)
      }
      textReady = true
    } catch (e) {
      onProgress?.(textModel, `error: ${e instanceof Error ? e.message : 'desconocido'}`)
    }
  }
  
  if (!visionReady) {
    onProgress?.(visionModel, 'iniciando descarga')
    try {
      for await (const update of pullModel(endpoint, visionModel, signal)) {
        onProgress?.(visionModel, update.status, update.progress)
      }
      visionReady = true
    } catch (e) {
      onProgress?.(visionModel, `error: ${e instanceof Error ? e.message : 'desconocido'}`)
    }
  }
  
  return { textReady, visionReady }
}
