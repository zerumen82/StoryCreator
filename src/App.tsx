import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import CharactersPanel from './components/CharactersPanel'
import LocationsPanel from './components/LocationsPanel'
import GroupsPanel from './components/GroupsPanel'
import ImagesPanel from './components/ImagesPanel'
import ConsolePanel from './components/ConsolePanel'
import PhotoCaptionPanel from './components/PhotoCaptionPanel'
import GenerateImagePanel from './components/GenerateImagePanel'
import InterviewPanel from './components/InterviewPanel'
import LogPanel from './components/LogPanel'
import AISettingsModal from './components/AISettingsModal'
import { useCharacterStore } from './store/characterStore'
import { useLocationStore } from './store/locationStore'
import { useGroupStore } from './store/groupStore'
import { useImageStore } from './store/imageStore'
import { useConversationStore } from './store/conversationStore'
import { useMemoryStore } from './store/memoryStore'
import { useRelationshipStore } from './store/relationshipStore'
import { useChatStore } from './store/chatStore'
import { useAIConfigStore } from './store/aiConfigStore'
import { checkOllamaConnection, getModelsStatus } from './services/ollamaModels'
import { clearLog, log } from './utils/logger'

log('[APP] App.tsx cargado')

export type View = 'characters' | 'locations' | 'groups' | 'images' | 'console' | 'captionstudio' | 'generate' | 'interview' | 'logs'

function App() {
  const [view, setView] = useState<View>('console')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    clearLog()
    log('[APP] StoryCreator iniciado')
    // Por si una sesion anterior se cerro a mitad de generacion
    useChatStore.setState({ isGenerating: false })

    try {
      log('[APP] Inicializando characterStore...')
      useCharacterStore.getState().init()
      log(`[APP] characterStore: ${useCharacterStore.getState().characters.length} personajes`)
    } catch (e) {
      log('[APP][ERROR] characterStore:', e)
    }

    try {
      log('[APP] Inicializando locationStore...')
      useLocationStore.getState().init()
      log(`[APP] locationStore: ${useLocationStore.getState().locations.length} localizaciones`)
    } catch (e) {
      log('[APP][ERROR] locationStore:', e)
    }

    try {
      log('[APP] Inicializando groupStore...')
      useGroupStore.getState().init()
      log(`[APP] groupStore: ${useGroupStore.getState().groups.length} grupos`)
    } catch (e) {
      log('[APP][ERROR] groupStore:', e)
    }

    try {
      log('[APP] Inicializando imageStore...')
      useImageStore.getState().init()
      log(`[APP] imageStore: ${useImageStore.getState().images.length} imágenes`)
    } catch (e) {
      log('[APP][ERROR] imageStore:', e)
    }

    try {
      log('[APP] Inicializando conversationStore...')
      useConversationStore.getState().init()
      log(`[APP] conversationStore: ${useConversationStore.getState().conversations.length} conversaciones`)
    } catch (e) {
      log('[APP][ERROR] conversationStore:', e)
    }

    try {
      log('[APP] Inicializando memoryStore...')
      useMemoryStore.getState().init()
      log(`[APP] memoryStore: ${useMemoryStore.getState().memories.length} memorias`)
    } catch (e) {
      log('[APP][ERROR] memoryStore:', e)
    }

    try {
      log('[APP] Inicializando relationshipStore...')
      useRelationshipStore.getState().init()
      log(`[APP] relationshipStore: ${useRelationshipStore.getState().relationships.length} relaciones`)
    } catch (e) {
      log('[APP][ERROR] relationshipStore:', e)
    }

    // Comprobar modelos Ollama al iniciar (en background)
    const aiConfig = useAIConfigStore.getState().config
    if (aiConfig.provider === 'ollama') {
      log('[APP] Comprobando modelos Ollama...')
      checkOllamaConnection(aiConfig.endpoint).then((connected) => {
        if (connected) {
          getModelsStatus(aiConfig.endpoint, aiConfig.model, aiConfig.visionModel).then((statuses) => {
            const missing = statuses.filter(m => !m.available)
            if (missing.length > 0) {
              log(`[APP] Modelos faltantes: ${missing.map(m => m.name).join(', ')}. Ábre Configuración IA para descargarlos.`)
            } else {
              log(`[APP] Modelos OK: ${statuses.map(m => `${m.name} (${m.size || '?'})`).join(', ')}`)
            }
          }).catch(() => log('[APP] No se pudieron comprobar modelos'))
        } else {
          log('[APP] Ollama no detectado. Arranca Ollama o usa OpenAI/Groq.')
        }
      }).catch(() => {})
    }

    const handleError = (event: ErrorEvent) => {
      log('[APP][RUNTIME ERROR]', event.message, 'at', event.filename, ':', event.lineno)
    }
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', (event) => {
      log('[APP][UNHANDLED REJECTION]', event.reason)
    })

    return () => {
      window.removeEventListener('error', handleError)
    }
  }, [])

  return (
    <div className="flex h-screen w-full bg-gray-950 text-gray-100">
      <Sidebar currentView={view} onNavigate={setView} onOpenSettings={() => setShowSettings(true)} />
      <main className="flex-1 overflow-hidden bg-gray-950">
        {view === 'characters' && <CharactersPanel />}
        {view === 'locations' && <LocationsPanel />}
        {view === 'groups' && <GroupsPanel />}
        {view === 'images' && <ImagesPanel />}
        {view === 'console' && <ConsolePanel />}
        {view === 'interview' && <InterviewPanel />}
        {view === 'logs' && <LogPanel />}
        {view === 'captionstudio' && <PhotoCaptionPanel />}
        {view === 'generate' && <GenerateImagePanel />}
      </main>
      {showSettings && <AISettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
