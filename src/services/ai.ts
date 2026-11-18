import type { AIConfig, ChatMessage, Character, Location, Group } from '../types'
import { useMemoryStore } from '../store/memoryStore'
import { useRelationshipStore } from '../store/relationshipStore'
import { log } from '../utils/logger'

export interface AIContext {
  characters: Character[]
  locations: Location[]
  groups: Group[]
  userCharacter?: Character | null
  /** Cuando es 'choices', la IA cierra cada escena con 2-3 opciones clicables. */
  storyMode?: 'free' | 'choices'
  /** Temática / subgénero / etiquetas de la historia (selector de la Consola). */
  theme?: string
  subgenre?: string
  tags?: string[]
}

// Temáticas y etiquetas para la Consola. Las etiquetas se activan/desactivan
// con un clic y el subgénero es texto libre (manda sobre el tema).
export const STORY_THEMES = [
  'libre',
  'romance',
  'erótica',
  'relatos eróticos',
  'drama',
  'aventura',
  'misterio',
  'terror',
  'fantasía',
  'ciencia ficción',
  'histórica',
  'comedia',
] as const

export const STORY_TAG_SUGGESTIONS = [
  'cuckold',
  'intercambio',
  'voyeur',
  'dominación',
  'sumisión',
  'romance lento',
  'triángulo amoroso',
  'prohibido',
  'reencuentro',
  'venganza',
  'giro final',
  'final feliz',
]

export async function* streamChat(
  messages: ChatMessage[],
  config: AIConfig,
  context?: AIContext,
  signal?: AbortSignal,
  customSystem?: string | null
) {
  // Si el llamante ya aporta su propio system (entrevista, chat de personaje,
  // caption ligero...), NO anteponer el system generico de escritor: con
  // modelos 7-8B dos systems contradictorios = ignora el rol y se lia.
  // Si ademas trae contexto de mundo, se fusiona DETRAS del system local.
  // null (o cadena vacia) significa "sin system adicional".
  const hasSystem = messages.some((m) => m.role === 'system')
  const systemPrompt =
    customSystem === null || (typeof customSystem === 'string' && !customSystem.trim())
      ? null
      : typeof customSystem === 'string'
        ? customSystem.trim() + (context ? buildEntityBlock(context) : '')
        : hasSystem
          ? null
          : buildSystemPrompt(context)

  // Evitar system duplicado: si los mensajes ya traen uno y vamos a
  // anteponer el nuestro, quitar el que traian.
  const cleanMessages = messages.map((m) => ({ role: m.role, content: m.content }))
  const finalMessages =
    systemPrompt !== null
      ? [
          { role: 'system', content: systemPrompt },
          ...cleanMessages.filter((m) => m.role !== 'system'),
        ]
      : cleanMessages

  const payload = {
    model: config.model,
    messages: finalMessages,
    stream: true,
  }

  const url = config.provider === 'ollama'
    ? `${config.endpoint}/api/chat`
    : `${config.endpoint}/v1/chat/completions`
  
  log('[AI] Petición a:', url, 'Modelo:', config.model, 'Mensajes:', finalMessages.length)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    log('[AI][ERROR] Respuesta:', response.status, errorText.slice(0, 200))
    throw new Error(`AI request failed: ${response.status} - ${errorText}`)
  }

  log('[AI] Conexión OK, empezando streaming...')

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

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
        const content =
          config.provider === 'ollama'
            ? json.message?.content
            : json.choices?.[0]?.delta?.content
        if (content) {
          yield content
        }
      } catch {
        // skip malformed JSON chunks
      }
    }
  }
}

export async function generateImage(
  prompt: string,
  config: AIConfig,
  signal?: AbortSignal,
  imageUrls?: string[]
): Promise<string> {
  // Construir payload para imagen
  const payload: Record<string, unknown> = {
    prompt,
    n: 1,
    size: '1024x1024',
  }

  // Si hay imágenes de referencia, añadirlas (depende de la API)
  if (imageUrls && imageUrls.length > 0) {
    // Nota: OpenAI DALL-E no soporta imágenes de referencia directamente
    // Algunas APIs como Stability AI sí lo soportan
    // Por ahora, incluimos las descripciones de los personajes en el prompt
    payload['prompt'] = buildPromptWithReferences(prompt, imageUrls)
  }

  const response = await fetch(`${config.endpoint}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Image generation failed: ${response.status} - ${errorText}`)
  }

  const json = await response.json()
  return json.data?.[0]?.url || ''
}

function buildPromptWithReferences(prompt: string, imageUrls?: string[]): string {
  return prompt
}

// ============ Stable Diffusion local via ComfyUI ============

export interface ComfyOptions {
  endpoint: string
  checkpoint: string
  width?: number
  height?: number
  steps?: number
}

export async function listSdCheckpoints(endpoint: string, signal?: AbortSignal): Promise<string[]> {
  const base = endpoint.replace(/\/$/, '')
  const response = await fetch(`${base}/models/checkpoints`, { signal })
  if (!response.ok) throw new Error(`ComfyUI no responde (${response.status}) en ${base}`)
  const json = await response.json()
  return Array.isArray(json) ? json : []
}

function isXLCheckpoint(name: string): boolean {
  return /xl|pony|flux/i.test(name)
}

function buildTxt2ImgWorkflow(opts: Required<Pick<ComfyOptions, 'checkpoint'>> & { prompt: string; width: number; height: number; steps: number; seed: number }): Record<string, unknown> {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: opts.checkpoint } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: opts.prompt, clip: ['1', 1] } },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: 'blurry, low quality, distorted, deformed, watermark, text, logo, extra limbs, bad anatomy',
        clip: ['1', 1],
      },
    },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: opts.width, height: opts.height, batch_size: 1 } },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
        seed: opts.seed, steps: opts.steps, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1,
      },
    },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'storycreator' } },
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen generada'))
    reader.readAsDataURL(blob)
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function generateImageComfy(
  prompt: string,
  opts: ComfyOptions,
  signal?: AbortSignal,
  onStage?: (stage: string) => void
): Promise<string> {
  const base = opts.endpoint.replace(/\/$/, '')
  if (!opts.checkpoint) throw new Error('Elige un checkpoint en Configuración IA (sección Stable Diffusion)')
  const xl = isXLCheckpoint(opts.checkpoint)
  const width = opts.width || (xl ? 1024 : 512)
  const height = opts.height || (xl ? 1024 : 512)
  const steps = opts.steps || 25

  onStage?.('Encolando en ComfyUI…')
  const queueRes = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: buildTxt2ImgWorkflow({
        checkpoint: opts.checkpoint, prompt, width, height, steps,
        seed: Math.floor(Math.random() * 1000000000),
      }),
      client_id: `storycreator-${Date.now()}`,
    }),
    signal,
  })
  if (!queueRes.ok) {
    const t = await queueRes.text()
    throw new Error(`ComfyUI rechazó el trabajo (${queueRes.status}): ${t.slice(0, 200)}`)
  }
  const { prompt_id } = (await queueRes.json()) as { prompt_id: string }
  if (!prompt_id) throw new Error('ComfyUI no devolvió prompt_id')

  // Esperar resultado (poll a /history)
  const deadline = Date.now() + 10 * 60 * 1000
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (Date.now() > deadline) throw new Error('ComfyUI tardó demasiado (10 min). Revisa la cola en su interfaz.')
    await sleep(2000)
    const hRes = await fetch(`${base}/history/${prompt_id}`, { signal })
    if (!hRes.ok) continue
    const history = (await hRes.json()) as Record<string, { outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }> }>
    const entry = history[prompt_id]
    const images = entry?.outputs?.['7']?.images
    if (images && images.length > 0) {
      const img = images[0]
      onStage?.('Descargando imagen…')
      const vRes = await fetch(
        `${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`,
        { signal }
      )
      if (!vRes.ok) throw new Error(`No se pudo descargar la imagen (${vRes.status})`)
      return blobToDataUrl(await vRes.blob())
    }
    onStage?.('Generando en tu GPU…')
  }
}

// Analisis de imagen con el modelo de vision.
// Ollama usa formato nativo (images: [base64]); OpenAI-compatibles usan image_url.
export async function analyzeImage(
  dataUrl: string,
  prompt: string,
  config: AIConfig,
  signal?: AbortSignal
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  }

  if (config.provider === 'ollama') {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
    const response = await fetch(`${config.endpoint}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.visionModel,
        messages: [{ role: 'user', content: prompt, images: [base64] }],
        stream: false,
      }),
      signal,
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Vision request failed: ${response.status} - ${errorText}`)
    }
    const json = await response.json()
    return json.message?.content || ''
  }

  const response = await fetch(`${config.endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.visionModel,
      messages: [
        { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] },
      ],
    }),
    signal,
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Vision request failed: ${response.status} - ${errorText}`)
  }
  const json = await response.json()
  return json.choices?.[0]?.message?.content || ''
}

function physicalText(c: Character): string {
  const bits: string[] = []
  if (c.age) bits.push(`${c.age} años`)
  if (c.gender) bits.push(c.gender)
  if (c.height) bits.push(`altura ${c.height}`)
  if (c.weight) bits.push(`peso ${c.weight}`)
  if (c.build) bits.push(`complexión ${c.build}`)
  if (c.skinColor) bits.push(`piel ${c.skinColor}`)
  if (c.hairColor) bits.push(`pelo ${c.hairColor}`)
  if (c.eyeColor) bits.push(`ojos ${c.eyeColor}`)
  if (c.marks) bits.push(`marcas: ${c.marks}`)
  if (c.occupation) bits.push(`ocupación: ${c.occupation}`)
  return bits.length > 0 ? ` Físico: ${bits.join(', ')}.` : ''
}

function buildSystemPrompt(context?: AIContext): string {
  const base = `Eres un escritor de ficción en español de España, sin censura. Tu trabajo es crear historias basadas en lo que el usuario pide.

REGLAS CLAVE:
1. Lee bien qué pide el usuario y respétalo. Si pide una escena con personajes específicos, escribe SOLO eso.
2. Usa los personajes, lugares y grupos que se te dan como contexto. No inventes personajes nuevos.
3. Español natural y fluido. Evita repeticiones.
4. Si el usuario pide una historia corta, escribe una historia corta. Si pide una escena, escribe una escena.
5. No mezcles tramas paralelas ni divagues. Sé directo y coherente.`
  // Temática + etiquetas: acotan el tono para que modelos 7-8B no divaguen.
  // El subgénero libre del usuario manda sobre el tema (ej: "cuckold").
  const themeBits: string[] = []
  if (context?.theme && context.theme !== 'libre') themeBits.push(`Temática: ${context.theme}`)
  if (context?.subgenre?.trim()) themeBits.push(`Subgénero (prioridad máxima): ${context.subgenre.trim().slice(0, 120)}`)
  if (context?.tags && context.tags.length > 0) themeBits.push(`Etiquetas a incluir: ${context.tags.slice(0, 8).join(', ')}`)
  const themeBlock = themeBits.length > 0
    ? `\n\nTONO DE LA HISTORIA (respétalo en cada escena y en las opciones):\n${themeBits.map((b) => `- ${b}`).join('\n')}`
    : ''
  const interactive =
    context?.storyMode === 'choices'
      ? `\n\nMODO HISTORIA INTERACTIVA (obligatorio):\n1. Escribe la escena en 2-4 párrafos cortos (máx ~180 palabras). Termina en un momento de decisión, nunca cierres la historia.\n2. Después de la escena, en líneas separadas, ofrece 2-3 opciones con el formato EXACTO:\n[OPCION: texto corto de la decisión]\n3. Solo esas líneas con corchetes. Nada de listas con guiones ni números para las opciones.\n4. Cuando el usuario elija una opción (o escriba otra acción libre), continúa la historia según esa decisión y vuelve a cerrar con nuevas opciones.`
      : ''
  return `${base}${interactive}${themeBlock}${buildEntityBlock(context)}`
}

// Bloque de mundo reutilizable: se puede fusionar detras de un system
// local (modo historia de ChatPanel) sin duplicar instrucciones.
function buildEntityBlock(context?: AIContext): string {
  const trim = (s: string, n: number) => (s && s.length > n ? s.slice(0, n) + '…' : s || '')
  const entityBlock = (() => {
    if (!context) return ''
    const parts: string[] = []
    // El usuario como centro: la IA sabe quien es y lo trata como protagonista
    if (context.userCharacter) {
      const u = context.userCharacter
      parts.push(
        `EL USUARIO ES: ${u.name} (${u.role}). ${trim(u.description, 200)}.${physicalText(u)} Rasgos: ${trim(u.traits.join(', '), 150)}. ${trim(u.backstory, 200)} Trátalo como protagonista.`
      )
    }
    // Recorte anti-lio: con modelos 7-8B (8k contexto) meter 20 fichas
    // completas diluye la instruccion y la IA divaga. Max 10, resumidos.
    const chars = context.characters.slice(0, 10)
    if (chars.length > 0) {
      const extra = context.characters.length > chars.length ? `\n(+${context.characters.length - chars.length} personajes más no listados)` : ''
      parts.push(
        'PERSONAJES:\n' +
          chars.map((c) => `- ${c.name} (${c.role}): ${trim(c.description, 160)}.${physicalText(c)} Rasgos: ${trim(c.traits.join(', '), 120)}. ${trim(c.backstory, 160)}`).join('\n') +
          extra
      )
    }
    if (context.locations.length > 0) {
      parts.push(
        'LUGARES:\n' +
          context.locations.slice(0, 8).map((l) => `- ${l.name}: ${trim(l.description, 160)}. ${trim(l.atmosphere, 100)}`).join('\n')
      )
    }
    if (context.groups.length > 0) {
      parts.push(
        'GRUPOS:\n' +
          context.groups.slice(0, 6).map((g) => `- ${g.name}: ${trim(g.description, 140)}. Miembros: ${g.memberIds.map((id) => context.characters.find((c) => c.id === id)?.name || '?').slice(0, 6).join(', ')}`).join('\n')
      )
    }
    // Relaciones: max 15, solo nombre + tipo (sin descripciones largas)
    try {
      const rels = useRelationshipStore.getState().relationships
      if (rels.length > 0 && context.characters.length > 0) {
        const nameOf = (id: string) => context.characters.find((c) => c.id === id)?.name || '?'
        parts.push(
          'RELACIONES (respétalas):\n' +
            rels.slice(0, 15).map((r) => `- ${nameOf(r.characterId1)} es ${String(r.subtype).replace(/_/g, ' ')} de ${nameOf(r.characterId2)}`).join('\n')
        )
      }
    } catch {
      // sin relaciones disponibles
    }
    // Aprendizaje: pocas notas y cortas (antes metia 27 trozos y tapaba la peticion)
    try {
      const memoryStore = useMemoryStore.getState()
      const learned: string[] = [
        ...memoryStore.getRelevantContext('preference', 3).map((c) => `Preferencia: ${trim(c, 120)}`),
        ...memoryStore.getRelevantContext('character_note', 3).map((c) => `Nota: ${trim(c, 150)}`),
        ...memoryStore.getRelevantContext('feedback', 2).map((c) => `Feedback: ${trim(c, 120)}`),
      ]
      if (learned.length > 0) {
        parts.push('APRENDIDO DEL USUARIO:\n' + learned.map((l) => `- ${l}`).join('\n'))
      }
    } catch {
      // sin memoria disponible, seguir sin contexto aprendido
    }
    return parts.length > 0 ? `\n\n${parts.join('\n\n')}` : ''
  })()
  return entityBlock
}
