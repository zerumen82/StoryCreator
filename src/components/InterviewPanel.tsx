import { useState, useRef } from 'react'
import { useCharacterStore } from '../store/characterStore'
import { useAIConfigStore } from '../store/aiConfigStore'
import { useMemoryStore } from '../store/memoryStore'
import { useImageStore } from '../store/imageStore'
import { streamChat, analyzeImage } from '../services/ai'
import type { ChatMessage, Character } from '../types'
import { renderMarkdown } from './MarkdownRenderer'
import { log } from '../utils/logger'

interface InterviewMsg {
  id: string
  role: 'ai' | 'user'
  text: string
  image?: string
}

function missingFields(c: Character): string[] {
  const missing: string[] = []
  if (!c.age) missing.push('edad')
  if (!c.gender) missing.push('género')
  if (!c.height) missing.push('altura')
  if (!c.weight) missing.push('peso')
  if (!c.build) missing.push('complexión')
  if (!c.skinColor) missing.push('color de piel')
  if (!c.hairColor) missing.push('pelo')
  if (!c.eyeColor) missing.push('ojos')
  if (!c.marks) missing.push('marcas distintivas')
  if (!c.occupation) missing.push('ocupación')
  if (!c.description) missing.push('personalidad')
  if (!c.backstory) missing.push('trasfondo')
  if (c.traits.length === 0) missing.push('rasgos')
  return missing
}

function fichaText(c: Character): string {
  const lines = [
    `Nombre: ${c.name || 'Sin nombre'} (${c.role})`,
    c.age && `Edad: ${c.age}`,
    c.gender && `Género: ${c.gender}`,
    c.height && `Altura: ${c.height}`,
    c.weight && `Peso: ${c.weight}`,
    c.build && `Complexión: ${c.build}`,
    c.skinColor && `Piel: ${c.skinColor}`,
    c.hairColor && `Pelo: ${c.hairColor}`,
    c.eyeColor && `Ojos: ${c.eyeColor}`,
    c.marks && `Marcas: ${c.marks}`,
    c.occupation && `Ocupación: ${c.occupation}`,
    c.description && `Personalidad: ${c.description}`,
    c.backstory && `Trasfondo: ${c.backstory}`,
    c.traits.length > 0 && `Rasgos: ${c.traits.join(', ')}`,
  ].filter(Boolean)
  return lines.join('\n')
}

let seq = 0
const nextId = () => `interview-${Date.now()}-${seq++}`

export default function InterviewPanel() {
  const { characters, getUserCharacter } = useCharacterStore()
  const { config } = useAIConfigStore()
  const memoryStore = useMemoryStore()
  const { images, addImage } = useImageStore()

  const userChar = getUserCharacter()
  const [selectedId, setSelectedId] = useState<string>(userChar?.id || characters[0]?.id || '')
  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState<InterviewMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [photoRequested, setPhotoRequested] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answered, setAnswered] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const historyRef = useRef<ChatMessage[]>([])
  const lastQuestionRef = useRef('')
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const character = characters.find((c) => c.id === selectedId) || null
  const learned = memoryStore.getMemoriesByType('character_note')
    .filter((m) => character && m.content.startsWith(`[Ficha de ${character.name}]`))
  const linkedPhotos = character ? images.filter((img) => (img.characterIds || []).includes(character.id)) : []

  const scrollDown = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

  const cleanPhotoTag = (text: string) => text.replace(/\[PEDIR_FOTO:[^\]]+\]/g, '').trim()

  // La IA a veces devuelve 2 preguntas o parrafos extra: quedarnos con la
  // primera pregunta para que la entrevista no se lie.
  const cleanQuestion = (text: string) => {
    const noTag = cleanPhotoTag(text)
    const qEnd = noTag.indexOf('?')
    if (qEnd >= 0) return noTag.slice(0, qEnd + 1).trim()
    const lines = noTag.split('\n').map((l) => l.trim()).filter(Boolean)
    return (lines[0] || noTag).slice(0, 220).trim()
  }

  const streamAnswer = async (history: ChatMessage[]): Promise<{ raw: string; text: string }> => {
    let full = ''
    log('[ENTREVISTA] Iniciando stream. Modelo:', config.model, 'Endpoint:', config.endpoint)
    // Sin context generico: history ya trae el system de entrevistador.
    // (streamChat no antepone otro system si ya hay uno.)
    try {
      const stream = streamChat(history, config, undefined, undefined)
      for await (const chunk of stream) {
        full += chunk
        const text = full
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'ai' && last.id === 'streaming') {
            return [...prev.slice(0, -1), { ...last, text }]
          }
          return [...prev, { id: 'streaming', role: 'ai', text }]
        })
      }
      log('[ENTREVISTA] Stream completado. Longitud:', full.length)
    } catch (e) {
      log('[ENTREVISTA][ERROR] Stream falló:', e)
      throw e
    }
    setMessages((prev) => prev.map((m) => (m.id === 'streaming' ? { ...m, id: nextId(), text: cleanQuestion(full) } : m)))
    return { raw: full, text: cleanQuestion(full) }
  }

  const startInterview = async () => {
    if (!character || sending) return
    setError(null)
    setMessages([])
    setAnswered(0)
    setPhotoRequested(false)
    historyRef.current = []
    const missing = missingFields(character)
    const system: ChatMessage = {
      id: 'system', role: 'system', timestamp: Date.now(),
      content: `Eres un escritor que entrevista al usuario para definir al personaje "${character.name}" para usarlo en historias.\n\nFicha actual:\n${fichaText(character)}\n\nCampos que faltan: ${missing.length > 0 ? missing.join(', ') : 'completos, pregunta por hábitos y anécdotas concretas'}.\nFotos enlazadas: ${linkedPhotos.length}.\n\nREGLAS ESTRICTAS:\n1. Haz UNA sola pregunta. Termina con "?".\n2. Longitud según contexto: 15-30 palabras para datos concretos (ropa, trabajo, hábitos), hasta 40 para opiniones o situaciones.\n3. Ejemplos de BUENAS preguntas:\n   - "¿Cuál es su trabajo y cómo llegó a él?"\n   - "¿Cómo viste normalmente: ropa, accesorios?"\n   - "¿Qué le enfada de verdad y por qué?"\n   - "¿Tiene algún hábito raro que le haga especial?"\n   - "¿Qué haría si encontrara un billete de 50 en la calle?"\n   - "¿Qué opina de la gente que miente siempre?"\n   - "¿Alguna vez ha roto algo por enfado?"\n4. Ejemplos de MALAS preguntas (NO hagas estas):\n   - "¿Cuál es el sentido de su existencia?"\n   - "¿Cómo define la justicia universal?"\n   - "¿Qué opina sobre la condición humana?"\n5. Prioriza: apariencia física → hábitos cotidianos → relaciones personales → opiniones concretas → anécdotas.\n6. Si te falta aspecto visual y no hay foto, añade [PEDIR_FOTO: ${character.name}].\n7. SOLO la pregunta. Sin saludos, sin explicaciones, sin despedidas.`,
    }
    historyRef.current = [system]
    setStarted(true)
    setSending(true)
    try {
      const { raw, text } = await streamAnswer(historyRef.current)
      lastQuestionRef.current = text
      historyRef.current.push({ id: nextId(), role: 'assistant', content: text, timestamp: Date.now() })
      if (raw.includes('[PEDIR_FOTO:')) setPhotoRequested(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al empezar')
      setStarted(false)
    } finally {
      setSending(false)
      scrollDown()
    }
  }

  const sendAnswer = async () => {
    const trimmed = input.trim()
    if (!trimmed || sending || !character) return
    setError(null)
    setInput('')
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: trimmed }])
    try {
      memoryStore.addMemory('character_note', `[Ficha de ${character.name}] P: ${lastQuestionRef.current} | R: ${trimmed}`, 1.0)
    } catch (e) {
      console.debug('[entrevista] memoria:', e)
    }
    historyRef.current.push({ id: nextId(), role: 'user', content: trimmed, timestamp: Date.now() })
    setSending(true)
    try {
      const { raw, text } = await streamAnswer(historyRef.current)
      lastQuestionRef.current = text
      historyRef.current.push({ id: nextId(), role: 'assistant', content: text, timestamp: Date.now() })
      if (raw.includes('[PEDIR_FOTO:')) setPhotoRequested(true)
      setAnswered((n) => n + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al responder')
    } finally {
      setSending(false)
      scrollDown()
    }
  }

  const sendPhoto = (file: File | undefined) => {
    if (!file || !character || sending) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setError(null)
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: 'Te envío esta foto.', image: dataUrl }])
      try {
        addImage({
          dataUrl, caption: `Foto de entrevista de ${character.name}`, prompt: 'Enviada por el usuario en entrevista',
          characterIds: [character.id], tags: ['interview'],
        })
      } catch (e) {
        console.debug('[entrevista] guardar foto:', e)
      }
      setSending(true)
      try {
        const analysis = await analyzeImage(
          dataUrl,
          `Esta foto es de "${character.name}". Ficha actual:\n${fichaText(character)}\nDescribe lo que ves (aspecto, ropa, entorno) en español y di que datos nuevos aporta a su ficha. Se conciso.`,
          config
        )
        setMessages((prev) => [...prev, { id: nextId(), role: 'ai', text: analysis }])
        try {
          memoryStore.addMemory('character_note', `[Ficha de ${character.name}] Foto: ${analysis.slice(0, 400)}`, 1.0)
        } catch (e) {
          console.debug('[entrevista] memoria foto:', e)
        }
        historyRef.current.push({ id: nextId(), role: 'user', content: `[El usuario envio una foto de ${character.name}. Analisis: ${analysis}]`, timestamp: Date.now() })
        setPhotoRequested(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al analizar la foto')
      } finally {
        setSending(false)
        scrollDown()
      }
    }
    reader.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const endInterview = () => {
    if (character) {
      try {
        memoryStore.addMemory('character_note', `[Ficha de ${character.name}] Fin de entrevista: ${learned.length} notas aprendidas en esta sesion.`, 0.8)
      } catch (e) {
        console.debug('[entrevista] fin:', e)
      }
    }
    setStarted(false)
  }

  if (characters.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto text-center py-20 text-gray-500">
          <p className="text-4xl mb-4">🎤</p>
          <p>Crea primero al menos un personaje para entrevistar a la IA sobre el.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Chat */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-4 border-b border-gray-800 flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-xl font-bold">🎤 Entrevista</h2>
            <p className="text-xs text-gray-500 mt-1">
              La IA te pregunta sobre tu personaje y aprende. Puedes enviarle fotos.
              {started && <span className="ml-2 text-violet-300">{answered} respuestas</span>}
              {' '}<button onClick={() => setShowHelp((v) => !v)} className="underline hover:text-gray-300">¿Cómo funciona?</button>
            </p>
            {showHelp && (
              <div className="mt-2 text-xs text-gray-400 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 leading-relaxed">
                1. La IA hace <strong>una pregunta cada vez</strong>, empezando por lo que falta en la ficha.<br />
                2. Cada respuesta se guarda como <strong>nota en su ficha</strong> (panel 🧠 Lo aprendido).<br />
                3. Si necesita verte, te pedirá <strong>una foto</strong> (📎 o el aviso ámbar).<br />
                4. Al <strong>Terminar</strong>, todo lo aprendido se usa solo en tus <strong>historias de la Consola</strong>.
              </div>
            )}
          </div>
          <select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setStarted(false); setMessages([]) }}
            disabled={started}
            className="ml-auto px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
          >
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name || 'Sin nombre'}</option>
            ))}
          </select>
          {!started ? (
            <button onClick={startInterview} disabled={!character || sending} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-medium">
              {sending ? 'Empezando…' : 'Empezar entrevista'}
            </button>
          ) : (
            <button onClick={endInterview} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">
              Terminar
            </button>
          )}
        </div>

        {photoRequested && started && (
          <button
            onClick={() => fileRef.current?.click()}
            className="mx-6 mt-3 px-4 py-2.5 bg-amber-900/30 border border-amber-600/50 hover:bg-amber-900/50 rounded-xl text-sm text-amber-200 text-left transition-colors"
          >
            📸 La IA te ha pedido una foto de {character?.name}. Pulsa aquí para enviársela →
          </button>
        )}

        {error && (
          <div className="mx-6 mt-3 px-4 py-2 bg-red-950/50 border border-red-800/50 rounded-xl text-sm text-red-300">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!started && messages.length === 0 && (
            <div className="text-center py-16 text-gray-500 space-y-2">
              <p className="text-4xl">🎤</p>
              <p>Elige personaje y pulsa <strong>Empezar entrevista</strong>.</p>
              <p className="text-xs">Responde con naturalidad: cada respuesta se guarda en su ficha y la IA la usará en tus historias.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-violet-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-100'}`}>
                {m.image && <img src={m.image} alt="Enviada" className="rounded-lg mb-2 max-h-48 object-contain" />}
                <div className="whitespace-pre-wrap leading-relaxed">{renderMarkdown(m.text)}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={!started || sending}
              title="Enviar foto a la IA"
              className="px-4 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-xl text-sm"
            >
              📎
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => sendPhoto(e.target.files?.[0])} />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAnswer() } }}
              placeholder={started ? 'Responde a la pregunta…' : 'Empieza la entrevista para responder'}
              disabled={!started}
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm focus:outline-none focus:border-violet-500 resize-none h-14 disabled:opacity-50"
            />
            <button onClick={sendAnswer} disabled={!started || sending || !input.trim()} className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl text-sm font-medium">
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Lo aprendido */}
      <aside className="lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-800 p-4 overflow-y-auto bg-gray-900/50">
        <h3 className="text-sm font-semibold mb-1">🧠 Lo aprendido de {character?.name}</h3>
        <p className="text-xs text-gray-500 mb-3">{learned.length} notas · alimentan tus historias</p>
        {character && missingFields(character).length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Aun falta:</p>
            <div className="flex flex-wrap gap-1">
              {missingFields(character).map((f) => (
                <span key={f} className="px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-200 rounded-full text-[11px]">{f}</span>
              ))}
            </div>
          </div>
        )}
        {linkedPhotos.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Fotos enlazadas ({linkedPhotos.length}):</p>
            <div className="grid grid-cols-3 gap-1">
              {linkedPhotos.slice(0, 6).map((img) => (
                <img key={img.id} src={img.dataUrl} alt="" className="w-full h-14 object-cover rounded" />
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          {learned.length === 0 && <p className="text-xs text-gray-500">Sin notas todavía. Empieza la entrevista.</p>}
          {learned.map((m) => (
            <div key={m.id} className="text-xs bg-gray-800/60 rounded-lg px-3 py-2 text-gray-300 leading-relaxed">
              {m.content.replace(`[Ficha de ${character?.name}] `, '')}
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
