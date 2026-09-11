import { useEffect, useState, useCallback } from 'react'

export interface SdStatus {
  supported: boolean
  running: boolean
  managed: boolean
  port: number
}

// Control de la instancia ComfyUI propia via proceso principal (IPC).
// Fuera de Electron (navegador) no hay control: solo lectura via .bat manual.
function sdApi(): NonNullable<NonNullable<Window['electronAPI']>['sd']> | null {
  try {
    return window.electronAPI?.sd || null
  } catch {
    return null
  }
}

export function isSdControlSupported(): boolean {
  return !!sdApi()
}

export async function getSdStatus(): Promise<SdStatus> {
  const api = sdApi()
  if (!api) return { supported: false, running: false, managed: false, port: 8189 }
  try {
    const r = await api.status()
    return { supported: true, running: !!r.running, managed: !!r.managed, port: r.port || 8189 }
  } catch {
    return { supported: true, running: false, managed: false, port: 8189 }
  }
}

export async function startSd(): Promise<void> {
  const api = sdApi()
  if (!api) throw new Error('Sin control integrado: arranca iniciar_SD_StoryCreator.bat')
  await api.start()
}

export async function stopSd(): Promise<void> {
  const api = sdApi()
  if (!api) throw new Error('Sin control integrado')
  await api.stop()
}

export async function waitSdReady(timeoutMs = 180000, stepMs = 3000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const s = await getSdStatus()
    if (s.running) return true
    if (Date.now() > deadline) return false
    await new Promise((r) => setTimeout(r, stepMs))
  }
}

export function useSdStatus(pollMs = 10000): { status: SdStatus; refresh: () => void } {
  const [status, setStatus] = useState<SdStatus>({ supported: false, running: false, managed: false, port: 8189 })
  const refresh = useCallback(() => {
    getSdStatus().then(setStatus).catch(() => {})
  }, [])
  useEffect(() => {
    refresh()
    if (pollMs > 0) {
      const t = setInterval(refresh, pollMs)
      return () => clearInterval(t)
    }
  }, [refresh, pollMs])
  return { status, refresh }
}
