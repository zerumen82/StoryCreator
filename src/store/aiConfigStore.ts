import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIConfig } from '../types'

interface AIConfigState {
  config: AIConfig
  updateConfig: (data: Partial<AIConfig>) => void
  resetConfig: () => void
}

const defaultConfig: AIConfig = {
  provider: 'ollama',
  endpoint: 'http://localhost:11434',
  apiKey: '',
  model: 'llama3',
  visionModel: 'llava',
  sdEndpoint: 'http://127.0.0.1:8189',
  sdCheckpoint: 'juggernautXL_ragnarok.safetensors',
}

export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      updateConfig: (data) =>
        set({
          config: { ...get().config, ...data },
        }),
      resetConfig: () => set({ config: defaultConfig }),
    }),
    { name: 'storycreator-ai-config' }
  )
)

// Rellenar claves nuevas en configuraciones guardadas de versiones anteriores.
// Si nunca se configuro SD (checkpoint vacio), apuntar a la instancia propia.
try {
  const stored = useAIConfigStore.getState().config
  if (!stored.sdEndpoint || stored.sdCheckpoint === undefined || stored.sdCheckpoint === '') {
    useAIConfigStore.setState({
      config: {
        ...defaultConfig,
        ...stored,
        sdEndpoint: stored.sdEndpoint && stored.sdCheckpoint ? stored.sdEndpoint : defaultConfig.sdEndpoint,
        sdCheckpoint: stored.sdCheckpoint || defaultConfig.sdCheckpoint,
      },
    })
  }
} catch {
  // sin almacenamiento disponible
}
