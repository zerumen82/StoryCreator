// Logger en memoria: funciona en navegador, dev y Electron empaquetado.
// (Antes intentaba usar fs/path de Node en el renderer y fallaba en silencio.)

const buffer: string[] = []
const listeners = new Set<() => void>()
const MAX_LINES = 500

function notify() {
  listeners.forEach((fn) => {
    try {
      fn()
    } catch {
      // ignorar listeners rotos
    }
  })
}

export function log(message: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${message}${args.length > 0 ? ' ' + args.map(String).join(' ') : ''}`
  buffer.push(line)
  if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES)
  console.debug(line)
  notify()
}

export function clearLog() {
  buffer.length = 0
  notify()
}

export function getLogs(): string[] {
  return [...buffer]
}

export function subscribeLogs(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getLoggerPath() {
  return '(memoria)'
}
