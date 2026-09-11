// Persistencia local sin dependencias Node.
// Funciona en: Vite dev (navegador), Electron renderer y build empaquetado.
// Antes usaba better-sqlite3 + electron directamente en el renderer y Vite lo
// externalizaba -> la app arrancaba y la DB reventaba. Ahora todo va a localStorage.

const PREFIX = 'storycreator:'

export function loadTable<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + name)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveTable(name: string, data: unknown): void {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(data))
  } catch (e) {
    console.error('[db] No se pudo guardar', name, e)
  }
}

export function generateId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

// Compat: el codigo antiguo llamaba a getDatabase().prepare(...).
// Se deja un stub que avisa en vez de reventar con imports Node.
export function getDatabase(): never {
  throw new Error(
    '[db] getDatabase() ya no existe: la persistencia ahora es localStorage (src/db/repositories.ts).'
  )
}

export function closeDatabase(): void {
  // no-op, sin conexion nativa que cerrar
}
