import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import { useAIConfigStore } from '../store/aiConfigStore'
import { useCharacterStore } from '../store/characterStore'
import { useLocationStore } from '../store/locationStore'
import { useGroupStore } from '../store/groupStore'
import { useConversationStore } from '../store/conversationStore'
import { useMemoryStore } from '../store/memoryStore'
import { useImageStore } from '../store/imageStore'
import { streamChat, STORY_THEMES, STORY_TAG_SUGGESTIONS } from '../services/ai'
import type { ChatMessage } from '../types'
import { v4 as uuidv4 } from 'uuid'
import FormatToolbar from './FormatToolbar'
import { renderMarkdown } from './MarkdownRenderer'
import { exportConversationToPDF } from '../utils/exportPDF'
import { log } from '../utils/logger'

export default function ConsolePanel() {
  const { messages, isGenerating, addMessage, clearMessages, setGenerating } = useChatStore()
  const { config } = useAIConfigStore()
  const { characters, getUserCharacter } = useCharacterStore()
  const { locations } = useLocationStore()
  const { groups } = useGroupStore()
  const [input, setInput] = useState('')
  const [voted, setVoted] = useState<Record<string, 1 | -1>>({})
  const [storyMode, setStoryMode] = useState<'free' | 'choices'>('choices')
  const [theme, setTheme] = useState<string>('libre')
  const [subgenre, setSubgenre] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const consoleConversationId = useRef<string | null>(null)
  const userCharacter = getUserCharacter()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const applyFormat = (prefix: string, suffix?: string) => {
    const textarea = document.querySelector('.console-input') as HTMLTextAreaElement | null
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = input.slice(start, end)
    const newText = input.slice(0, start) + prefix + selected + (suffix || '') + input.slice(end)
    setInput(newText)
    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = start + prefix.length
      textarea.selectionEnd = start + prefix.length + selected.length
    }, 0)
  }

  const handleInsertEntity = (type: 'character' | 'location' | 'group', id: string) => {
    let name = ''
    if (type === 'character') name = characters.find((c) => c.id === id)?.name || ''
    if (type === 'location') name = locations.find((l) => l.id === id)?.name || ''
    if (type === 'group') name = groups.find((g) => g.id === id)?.name || ''
    if (name) {
      setInput((prev) => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + name)
    }
  }

  const handleSend = async (forcedText?: string) => {
    const trimmed = (forcedText ?? input).trim()
    if (!trimmed || isGenerating) return

    log('[CONSOLA] Enviando mensaje. Modo:', storyMode, 'Modelo:', config.model)

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }

    addMessage(userMessage)
    setInput('')
    setGenerating(true)

    abortControllerRef.current = new AbortController()

    const assistantMessageId = addMessage({
      role: 'assistant',
      content: '',
    })

    try {
      const contextMessages: ChatMessage[] = [...messages, userMessage]
      log('[CONSOLA] Llamando streamChat. Mensajes en contexto:', contextMessages.length)
      const stream = streamChat(
        contextMessages,
        config,
        { characters, locations, groups, userCharacter, storyMode, theme, subgenre, tags },
        abortControllerRef.current.signal
      )

      let fullContent = ''
      let chunkCount = 0
      for await (const chunk of stream) {
        fullContent += chunk
        chunkCount++
        if (chunkCount === 1) log('[CONSOLA] Primer chunk recibido')
        useChatStore.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantMessageId ? { ...m, content: fullContent } : m
          ),
        }))
      }
      log('[CONSOLA] Stream completado. Chunks:', chunkCount, 'Longitud total:', fullContent.length)

      if (fullContent.trim()) {
        // Persistir en historial de conversaciones (exportable) y aprender.
        // conversationStore.addMessage ya registra user_message/ai_response en memoria.
        try {
          const convStore = useConversationStore.getState()
          if (!consoleConversationId.current) {
            consoleConversationId.current = convStore.createConversation(null, 'story')
          } else if (convStore.currentConversationId !== consoleConversationId.current) {
            convStore.selectConversation(consoleConversationId.current)
          }
          useConversationStore.getState().addMessage('user', trimmed)
          useConversationStore.getState().addMessage('assistant', fullContent)
        } catch (e) {
          console.debug('[consola] No se pudo persistir:', e)
        }

        // Imagen aleatoria que pida la IA: guardarla enlazada a los personajes mencionados
        const genMatch = fullContent.match(/\[GENERAR_IMAGEN:\s*([^\]]+)\]/)
        if (genMatch) {
          try {
            const desc = genMatch[1].trim()
            const mentioned = characters.filter((c) =>
              c.name && desc.toLowerCase().includes(c.name.toLowerCase())
            ).map((c) => c.id)
            const canvas = document.createElement('canvas')
            canvas.width = 800; canvas.height = 500
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.fillStyle = '#1a1033'; ctx.fillRect(0, 0, 800, 500)
              ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px Georgia, serif'; ctx.textAlign = 'center'
              ctx.fillText(desc.slice(0, 100), 400, 200)
              ctx.fillStyle = '#a78bfa'; ctx.font = '14px Inter, sans-serif'
              const names = mentioned.map((id) => characters.find((c) => c.id === id)?.name || 'Personaje').join(', ')
              ctx.fillText('Generado en consola' + (names ? ' - ' + names : ''), 400, 270)
              useImageStore.getState().addImage({
                dataUrl: canvas.toDataURL('image/png'),
                caption: desc,
                prompt: 'Generado por la IA en consola',
                characterIds: mentioned,
                tags: ['generated', 'console'],
              })
            }
          } catch (e) {
            console.debug('[consola] No se pudo generar imagen:', e)
          }
        }
      }
    } catch (err) {
      log('[CONSOLA][ERROR]', err)
      if ((err as Error).name === 'AbortError') {
        useChatStore.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantMessageId ? { ...m, content: m.content + '\n\n[Generación detenida]' } : m
          ),
        }))
      } else {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
        useChatStore.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantMessageId ? { ...m, content: `Error: ${errorMsg}` } : m
          ),
        }))
      }
    } finally {
      setGenerating(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setGenerating(false)
  }

  const handleFeedback = (msg: ChatMessage, value: 1 | -1) => {
    setVoted((prev) => ({ ...prev, [msg.id]: value }))
    try {
      useMemoryStore.getState().addMemory(
        'feedback',
        `Respuesta ${value > 0 ? 'gustó' : 'no gustó'}: ${msg.content.slice(0, 200)}`,
        value > 0 ? 1.0 : 0.3
      )
    } catch (e) {
      console.debug('[consola] No se pudo guardar feedback:', e)
    }
  }

  const quickPrompt = (text: string) => {
    setInput(text)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Consola</h2>
            <p className="text-xs text-gray-500 mt-1">
              {userCharacter ? `Eres ${userCharacter.name} · ` : ''}
              {characters.length > 0 || locations.length > 0 || groups.length > 0
                ? `Contexto: ${characters.length} personajes, ${locations.length} localizaciones, ${groups.length} grupos.`
                : 'Crea personajes y localizaciones primero para generar historias contextualizadas.'}
            </p>
          </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            <button
              onClick={() => setStoryMode('choices')}
              title="Escenas cortas con 2-3 opciones clicables"
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${storyMode === 'choices' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              🌀 Interactiva
            </button>
            <button
              onClick={() => setStoryMode('free')}
              title="La IA escribe sin opciones"
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${storyMode === 'free' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              ✍️ Libre
            </button>
          </div>
          <button
            onClick={clearMessages}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs"
          >
            Limpiar chat
          </button>
          <button
            onClick={() =>
              exportConversationToPDF({
                title: 'Sesión de Consola',
                characterName: userCharacter?.name || null,
                messages,
              })
            }
            disabled={messages.length === 0}
            title="Exportar la conversación a PDF (dialogo de impresión)"
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-xs"
          >
            📄 PDF
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-20 text-gray-500 space-y-4">
            <p className="text-4xl">✍️</p>
            <p>Escribe una historia o pide una idea. Usa la toolbar para formatear.</p>
            {storyMode === 'choices' && (
              <p className="text-xs text-indigo-300/80 max-w-md mx-auto">
                🌀 Modo interactivo: la IA escribe escenas cortas y te da 2-3 opciones. Pulsa una y la historia sigue según tu decisión.
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => quickPrompt('Hazme una historia completa con todos los personajes y localizaciones.')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs">Historia completa</button>
              <button onClick={() => quickPrompt('Genera un conflicto dramático entre los personajes.')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs">Conflicto</button>
              <button onClick={() => quickPrompt('Describe una escena detallada en una de las localizaciones.')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs">Escena</button>
              <button onClick={() => quickPrompt('Escribe un diálogo intenso entre dos personajes.')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs">Diálogo</button>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          // Opciones interactivas: la IA las emite como [OPCION: ...].
          // Se sacan del texto y se muestran como botones clicables.
          const options = msg.role === 'assistant'
            ? Array.from(msg.content.matchAll(/\[OPCION:\s*([^\]]+)\]/g)).map((m) => m[1].trim()).filter(Boolean).slice(0, 3)
            : []
          // Limpiar todos los tags internos del texto visible
          const cleanTags = (text: string) => text
            .replace(/\[OPCION:\s*[^\]]+\]/g, '')
            .replace(/\[GENERAR_IMAGEN:\s*[^\]]+\]/g, '')
            .replace(/\[PEDIR_FOTO:\s*[^\]]+\]/g, '')
            .trim()
          const body = msg.role === 'assistant' ? cleanTags(msg.content) : msg.content
          return (
          <div key={msg.id} className={`max-w-4xl mx-auto ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-900 border border-gray-800 text-gray-100'
              }`}
            >
              {msg.role === 'assistant' && msg.content === '' && isGenerating ? (
                <span className="text-gray-500 italic">Generando...</span>
              ) : msg.role === 'assistant' ? (
                <>
                  <div className="markdown-content leading-relaxed">{renderMarkdown(body)}</div>
                  {options.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3">
                      {options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(`Elijo: ${opt}`)}
                          disabled={isGenerating}
                          className="text-left px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 disabled:opacity-40 border border-indigo-500/40 rounded-lg text-sm text-indigo-100 transition-colors"
                        >
                          {i + 1}. {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isGenerating && msg.content && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-gray-700/50">
                      <button
                        onClick={() => handleFeedback(msg, 1)}
                        title="Me gusta: la IA aprenderá"
                        className={`text-xs ${voted[msg.id] === 1 ? 'text-green-300' : 'text-green-400/60 hover:text-green-300'}`}
                      >
                        👍
                      </button>
                      <button
                        onClick={() => handleFeedback(msg, -1)}
                        title="No me gusta: la IA aprenderá"
                        className={`text-xs ${voted[msg.id] === -1 ? 'text-red-300' : 'text-red-400/60 hover:text-red-300'}`}
                      >
                        👎
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-800">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Selector de tono: tematica + subgenero libre + etiquetas.
              El subgenero manda sobre la tematica (ver ai.ts). */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              title="Temática de la historia"
              className="px-2 py-1 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-indigo-500"
            >
              {STORY_THEMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={subgenre}
              onChange={(e) => setSubgenre(e.target.value)}
              placeholder="subgénero libre (opcional)"
              title="Prioridad máxima sobre la temática"
              className="px-2 py-1 w-44 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
            {STORY_TAG_SUGGESTIONS.map((tag) => {
              const active = tags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() =>
                    setTags((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag]))
                  }
                  className={`px-2 py-0.5 rounded-full border transition-colors ${
                    active
                      ? 'bg-violet-600/80 border-violet-500 text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
          <FormatToolbar
            onFormat={applyFormat}
            onInsertEntity={handleInsertEntity}
            characters={characters.map((c) => ({ id: c.id, name: c.name }))}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          />
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Escribe tu petición para la IA..."
              className="console-input flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-b-xl text-sm focus:outline-none focus:border-indigo-500 resize-none h-14"
            />
            {isGenerating ? (
              <button onClick={handleStop} className="px-4 py-3 bg-red-600 hover:bg-red-500 rounded-b-xl text-sm font-medium">
                Detener
              </button>
            ) : (
              <button onClick={() => handleSend()} disabled={!input.trim()} className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-b-xl text-sm font-medium">
                Enviar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
