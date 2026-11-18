import type { View } from '../App'
import { useState, useEffect } from 'react'
import { useCharacterStore } from '../store/characterStore'
import { useLocationStore } from '../store/locationStore'
import { useGroupStore } from '../store/groupStore'
import { useImageStore } from '../store/imageStore'
import { useMemoryStore } from '../store/memoryStore'
import { useThemeStore } from '../store/themeStore'
import { useAIConfigStore } from '../store/aiConfigStore'
import { checkOllamaConnection, getModelsStatus, type ModelStatus } from '../services/ollamaModels'

interface SidebarProps {
  currentView: View
  onNavigate: (view: View) => void
  onOpenSettings: () => void
}

interface NavDef {
  view: View
  label: string
  icon: string
  description: string
  // Paso sugerido en el flujo de creación
  step?: number
}

// Orden sugerido: 1 personajes (+ tu personaje) → 2 localizaciones → 3 grupos → resto libre
const navItems: NavDef[] = [
  { view: 'characters', label: 'Personajes', icon: '👤', description: 'Crea tu personaje y el reparto', step: 1 },
  { view: 'interview', label: 'Entrevista', icon: '🎤', description: 'La IA pregunta y aprende' },
  { view: 'locations', label: 'Localizaciones', icon: '📍', description: 'Lugares de tus historias', step: 2 },
  { view: 'groups', label: 'Grupos', icon: '👥', description: 'Grupos por temática', step: 3 },
  { view: 'images', label: 'Imágenes', icon: '🖼️', description: 'Galería y fotos' },
  { view: 'captionstudio', label: 'Caption Studio', icon: '📸', description: 'Fotos con IA' },
  { view: 'generate', label: 'Generar Imagen', icon: '✨', description: 'Caption → Imagen' },
  { view: 'console', label: 'Consola', icon: '💬', description: 'Generar historias' },
  { view: 'logs', label: 'Registros', icon: '📋', description: 'Ver logs de la app' },
]

export default function Sidebar({ currentView, onNavigate, onOpenSettings }: SidebarProps) {
  const { characters, userCharacterId } = useCharacterStore()
  const { locations } = useLocationStore()
  const { groups } = useGroupStore()
  const { images } = useImageStore()
  const { memories } = useMemoryStore()
  const { config } = useAIConfigStore()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected' | 'not-ollama'>('not-ollama')
  const [modelsReady, setModelsReady] = useState<boolean | null>(null)

  const userCharacter = characters.find((c) => c.id === userCharacterId) || null

  // Comprobar estado de Ollama y modelos
  useEffect(() => {
    if (config.provider !== 'ollama') {
      setOllamaStatus('not-ollama')
      setModelsReady(null)
      return
    }
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    const check = async () => {
      try {
        const connected = await checkOllamaConnection(config.endpoint)
        if (cancelled) return
        setOllamaStatus(connected ? 'connected' : 'disconnected')
        if (connected) {
          const statuses = await getModelsStatus(config.endpoint, config.model, config.visionModel)
          if (!cancelled) setModelsReady(statuses.every(m => m.available))
        } else {
          if (!cancelled) setModelsReady(null)
        }
      } catch {
        if (!cancelled) {
          setOllamaStatus('disconnected')
          setModelsReady(null)
        }
      }
    }

    check()
    interval = setInterval(check, 30000) // recheck cada 30s
    return () => { cancelled = true; if (interval) clearInterval(interval) }
  }, [config.provider, config.endpoint, config.model, config.visionModel])

  const counts: Partial<Record<View, number>> = {
    characters: characters.length,
    locations: locations.length,
    groups: groups.length,
    images: images.length,
  }

  // Avisos de dependencias: que necesita cada seccion para tener sentido
  const notesCount = memories.filter((m) => m.type === 'character_note').length
  const hints: Partial<Record<View, string | null>> = {
    characters: !userCharacter ? 'Marca cuál eres tú con “Este soy yo”' : null,
    interview: characters.length === 0
      ? 'Necesita personajes primero'
      : notesCount === 0 ? 'Aún no ha aprendido nada: empieza una' : null,
    groups: characters.length === 0 ? 'Necesita personajes primero' : null,
    captionstudio: characters.length === 0 ? 'Rinde más con personajes creados' : null,
    generate: characters.length === 0 && locations.length === 0 && groups.length === 0
      ? 'Crea personajes o lugares primero'
      : null,
    console: characters.length === 0 ? 'Sin personajes: historia genérica' : null,
  }

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold tracking-tight">StoryCreator</h1>
        <p className="text-xs text-gray-500 mt-1">Generador de historias con IA</p>
      </div>

      {/* Tu personaje: acceso directo y estado */}
      <div className="p-3 border-b border-gray-800">
        {userCharacter ? (
          <button
            onClick={() => onNavigate('characters')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-900/30 border border-violet-700/40 hover:bg-violet-900/50 text-left transition-colors"
            title="Tu personaje principal (usuario)"
          >
            {userCharacter.image
              ? <img src={userCharacter.image} alt="" className="w-8 h-8 rounded-full object-cover" />
              : <span className="text-xl">🧑</span>}
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-violet-300">Tú (usuario)</span>
              <span className="block text-sm font-medium truncate">{userCharacter.name || 'Sin nombre'}</span>
            </span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate('characters')}
            className="w-full px-3 py-2 rounded-xl bg-amber-900/20 border border-amber-700/40 hover:bg-amber-900/40 text-left transition-colors"
            title="Aún no has marcado tu personaje"
          >
            <span className="block text-[11px] uppercase tracking-wide text-amber-300">Paso 1 · Sin tu personaje</span>
            <span className="block text-sm">Crea un personaje y pulsa “Este soy yo” →</span>
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = currentView === item.view
          const count = counts[item.view]
          const hint = hints[item.view]
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{item.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    {item.step && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${active ? 'bg-indigo-500' : 'bg-gray-800 text-gray-400'}`}>
                        {item.step}
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                    {count !== undefined && count > 0 && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-500' : 'bg-gray-800 text-gray-300'}`}>
                        {count}
                      </span>
                    )}
                  </span>
                  <span className={`block text-xs font-normal ${active ? 'text-indigo-200' : 'text-gray-600'}`}>
                    {item.description}
                  </span>
                  {hint && (
                    <span className={`block text-[11px] font-normal mt-0.5 ${active ? 'text-amber-200' : 'text-amber-400/90'}`}>
                      ⚠ {hint}
                    </span>
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t border-gray-800">
        {/* Indicador de modelos Ollama */}
        {config.provider === 'ollama' && (
          <div className={`mb-2 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${
            ollamaStatus === 'connected' && modelsReady === true
              ? 'bg-green-900/20 border border-green-800/30 text-green-300'
              : ollamaStatus === 'connected' && modelsReady === false
                ? 'bg-amber-900/20 border border-amber-800/30 text-amber-300'
                : ollamaStatus === 'disconnected'
                  ? 'bg-red-900/20 border border-red-800/30 text-red-300'
                  : 'bg-gray-800/50 border border-gray-700/30 text-gray-400'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              ollamaStatus === 'connected' && modelsReady === true ? 'bg-green-400' :
              ollamaStatus === 'connected' && modelsReady === false ? 'bg-amber-400 animate-pulse' :
              ollamaStatus === 'disconnected' ? 'bg-red-400' : 'bg-gray-500'
            }`} />
            <span className="min-w-0 truncate">
              {ollamaStatus === 'connected' && modelsReady === true && 'IA local lista'}
              {ollamaStatus === 'connected' && modelsReady === false && 'Modelos faltantes'}
              {ollamaStatus === 'disconnected' && 'Ollama apagado'}
              {ollamaStatus === 'not-ollama' && 'Usando cloud'}
              {ollamaStatus === 'checking' && 'Comprobando IA...'}
            </span>
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors mb-1"
        >
          <span className="mr-2">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors"
        >
          <span className="mr-2">⚙️</span>
          Configuración IA
        </button>
      </div>
    </aside>
  )
}
