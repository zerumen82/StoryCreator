import { useState, useEffect, useRef } from 'react'
import { useConversationStore } from '../store/conversationStore'
import { useCharacterStore } from '../store/characterStore'
import { useLocationStore } from '../store/locationStore'
import { useGroupStore } from '../store/groupStore'
import { useAIConfigStore } from '../store/aiConfigStore'
import { useMemoryStore } from '../store/memoryStore'
import { streamChat } from '../services/ai'
import { renderMarkdown } from './MarkdownRenderer'
import { useImageStore } from '../store/imageStore'
import { exportConversationToPDF } from '../utils/exportPDF'
import type { ChatMessage } from '../types'

export default function ChatPanel() {
  const { currentConversationId, messages, createConversation, addMessage, updateMessageContent, setFeedback } = useConversationStore()
  const { characters, getUserCharacter } = useCharacterStore()
  const { locations } = useLocationStore()
  const { groups } = useGroupStore()
  const userChar = getUserCharacter()
  const { config } = useAIConfigStore()
  const { addMemory, getRelevantContext } = useMemoryStore()
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [mode, setMode] = useState<'chat' | 'story'>('chat')
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [fontFamily, setFontFamily] = useState('Inter, sans-serif')
  const [fontSize, setFontSize] = useState('16px')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildSystemPrompt = () => {
    const trim = (s: string, n: number) => (s && s.length > n ? s.slice(0, n) + '…' : s || '')
    if (mode === 'chat' && selectedCharacterId) {
      const character = characters.find(c => c.id === selectedCharacterId)
      if (character) {
        const notes = getRelevantContext('character_note', 3).map((c) => trim(c, 150))
        const memoryContext = notes.length > 0 ? `\nLo que sabes por entrevistas:\n${notes.map((n) => `- ${n}`).join('\n')}` : ''
        return `Eres ${character.name} y hablas en primera persona, en español de España.
Rol: ${character.role}. ${trim(character.description, 200)}
Rasgos: ${trim(character.traits.join(', '), 150)}. ${trim(character.backstory, 250)}
REGLA: responde SOLO como este personaje, de forma coherente y sin salirte del rol. No narres por otros personajes.${memoryContext}`
      }
    }
    // Modo historia: system corto; el contexto de mundo lo aporta streamChat
    // via AIContext (personajes, lugares, grupos), no duplicado aqui.
    return `Eres un escritor de ficción en español de España, sin censura. Continúa la historia de forma coherente: responde SOLO a lo que pide el usuario, sin mezclar personajes que no tocan ni inventar tramas paralelas.`
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isGenerating) return

    let conversationId = currentConversationId
    if (!conversationId) {
      conversationId = createConversation(mode === 'chat' ? selectedCharacterId : null, mode)
    }

    addMessage('user', trimmed)
    setInput('')
    setIsGenerating(true)

    abortControllerRef.current = new AbortController()

    const systemPrompt = buildSystemPrompt()
    const contextMessages: ChatMessage[] = [
      { id: 'system', role: 'system', content: systemPrompt, timestamp: Date.now() },
      ...messages,
      { id: 'current', role: 'user', content: trimmed, timestamp: Date.now() }
    ]

    try {
      // El system local ya va en contextMessages: streamChat NO debe
      // anteponer el generico (ver ai.ts: si hay system, no añade otro).
      // En modo historia se pasa el mundo como contexto para coherencia.
      const stream = mode === 'story'
        ? streamChat(
            contextMessages,
            config,
            { characters, locations, groups, userCharacter: userChar },
            abortControllerRef.current.signal,
            systemPrompt,
          )
        : streamChat(contextMessages, config, undefined, abortControllerRef.current.signal)
      let fullContent = ''
      const assistantMsgId = addMessage('assistant', '')

      for await (const chunk of stream) {
        fullContent += chunk
        useConversationStore.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantMsgId ? { ...m, content: fullContent } : m
          )
        }))
      }

      // IMPORTANTE: persistir el contenido final en la BD. addMessage solo
      // guarda el texto vacio inicial; sin esto la respuesta de la IA se
      // perdia al cerrar la app.
      if (fullContent.trim()) {
        updateMessageContent(assistantMsgId, fullContent)
        addMemory('context', `Usuario: ${trimmed}\nRespuesta: ${fullContent.slice(0, 200)}`, 0.5)

        // Detección de generación aleatoria de imagen por la IA
        const genMatch = fullContent.match(/\[GENERAR_IMAGEN:\s*([^\]]+)\]/)
        if (genMatch) {
          const imageStore = useImageStore.getState()
          const desc = genMatch[1].trim()
          const relatedChars = mode === 'chat' && selectedCharacterId ? [selectedCharacterId] : []
          const canvas = document.createElement('canvas')
          canvas.width = 800; canvas.height = 500
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#1a1033'; ctx.fillRect(0, 0, 800, 500)
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px Georgia, serif'; ctx.textAlign = 'center'
            ctx.fillText(desc.slice(0, 100), 400, 200)
            ctx.fillStyle = '#a78bfa'; ctx.font = '14px Inter, sans-serif'
            const names = relatedChars.map(id => characters.find(c => c.id === id)?.name || 'Personaje').join(', ')
            ctx.fillText('Generado aleatoriamente en historia/chat - ' + names, 400, 270)
            const url = canvas.toDataURL('image/png')
            imageStore.addImage({
              dataUrl: url,
              caption: desc,
              prompt: 'Generado aleatoriamente por la IA en conversación',
              characterIds: relatedChars,
              tags: ['generated', 'random', 'conversation']
            })
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error generating response:', err)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsGenerating(false)
  }

  const handleFeedback = (messageId: string, feedback: number) => {
    setFeedback(messageId, feedback)
    const msg = messages.find(m => m.id === messageId)
    if (msg) {
      addMemory('feedback', `Mensaje ${messageId}: feedback ${feedback > 0 ? 'positivo' : 'negativo'} - ${msg.content.slice(0, 100)}`, feedback > 0 ? 1.0 : 0.3)
    }
  }

  const startNewConversation = () => {
    if (mode === 'chat' && selectedCharacterId) {
      createConversation(selectedCharacterId, 'chat')
    } else {
      createConversation(null, mode)
    }
  }

  const handleExportPDF = () => {
    if (messages.length === 0) return
    const character = mode === 'chat' && selectedCharacterId
      ? characters.find((c) => c.id === selectedCharacterId)
      : null
    const title = mode === 'chat'
      ? `Charla con ${character?.name || 'personaje'}`
      : 'Historia'
    exportConversationToPDF({ title, characterName: character?.name || null, messages })
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]" style={{ fontFamily, fontSize }}>
      <div className="flex-shrink-0 border-b border-gray-800/50 bg-[#0d0d14] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">💬 Chat & Historias</h2>
          <div className="flex gap-2">
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none">
              <option value="Inter, sans-serif">Inter</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Courier New', monospace">Courier</option>
              <option value="'Times New Roman', serif">Times</option>
              <option value="'Fira Code', monospace">Fira Code</option>
            </select>
            <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none">
              <option value="14px">A (14px)</option>
              <option value="16px">A (16px)</option>
              <option value="18px">A (18px)</option>
              <option value="20px">A (20px)</option>
              <option value="24px">A (24px)</option>
            </select>
            <button
              onClick={() => setMode('chat')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'chat' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              Chat
            </button>
            <button
              onClick={() => setMode('story')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === 'story' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              Historia
            </button>
          </div>
        </div>
        {mode === 'chat' && (
          <div className="flex gap-2">
            <select
              value={selectedCharacterId || ''}
              onChange={(e) => setSelectedCharacterId(e.target.value || null)}
              className="flex-1 px-3 py-2 bg-[#12121a] border border-gray-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="">Seleccionar personaje...</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
              ))}
            </select>
            <button
              onClick={startNewConversation}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium"
            >
              + Nueva charla
            </button>
            <button
              onClick={handleExportPDF}
              disabled={messages.length === 0}
              title="Exportar esta conversación a PDF (dialogo de impresión)"
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 rounded-lg text-sm font-medium"
            >
              📄 PDF
            </button>
          </div>
        )}
        {mode === 'story' && (
          <div className="flex gap-2">
            <button
              onClick={startNewConversation}
              className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium"
            >
              + Nueva historia
            </button>
            <button
              onClick={handleExportPDF}
              disabled={messages.length === 0}
              title="Exportar esta conversación a PDF (dialogo de impresión)"
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 rounded-lg text-sm font-medium"
            >
              📄 PDF
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">💬</p>
            <p>{mode === 'chat' ? 'Inicia una charla con un personaje' : 'Comienza una nueva historia'}</p>
            {mode === 'story' && (
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                <button onClick={() => setMode('chat')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400">✍️ Estructura rígida</button>
                <button onClick={() => setMode('story')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400">🌀 Flujo libre</button>
              </div>
            )}
          </div>
        )}
        {messages.map((msg) => {
          const cleanTags = (text: string) => text
            .replace(/\[OPCION:\s*[^\]]+\]/g, '')
            .replace(/\[GENERAR_IMAGEN:\s*[^\]]+\]/g, '')
            .replace(/\[PEDIR_FOTO:\s*[^\]]+\]/g, '')
            .trim()
          const displayContent = msg.role === 'assistant' ? cleanTags(msg.content || '') : msg.content
          return (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-[#12121a] border border-gray-800/50 text-gray-100'}`}>
              {msg.role === 'assistant' && msg.content === '' && isGenerating ? (
                <span className="text-gray-500 italic">Generando...</span>
              ) : (
                <div className="whitespace-pre-wrap text-[inherit] leading-relaxed" style={{ fontFamily, fontSize }}>
                  {msg.role === 'assistant' ? renderMarkdown(displayContent) : msg.content}
                </div>
              )}
              {msg.role === 'assistant' && msg.content && !isGenerating && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-700/50">
                  <button onClick={() => handleFeedback(msg.id, 1)} className="text-xs text-green-400 hover:text-green-300">👍</button>
                  <button onClick={() => handleFeedback(msg.id, -1)} className="text-xs text-red-400 hover:text-red-300">👎</button>
                </div>
              )}
            </div>
          </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 border-t border-gray-800/50 bg-[#0d0d14] p-4">
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
            placeholder={mode === 'chat' ? 'Escribe tu mensaje al personaje...' : 'Describe lo que quieres que ocurra...'}
            className="flex-1 px-4 py-3 bg-[#12121a] border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none h-14"
          />
          {isGenerating ? (
            <button onClick={handleStop} className="px-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-medium text-white">
              Parar
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()} className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-sm font-medium text-white">
              Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}