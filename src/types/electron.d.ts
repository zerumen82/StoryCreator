export {}

declare global {
  interface Window {
    electronAPI?: {
      platform?: string
      sd?: {
        status: () => Promise<{ running: boolean; managed: boolean; port: number }>
        start: () => Promise<unknown>
        stop: () => Promise<unknown>
        getAutostart: () => Promise<{ enabled: boolean }>
        setAutostart: (enabled: boolean) => Promise<unknown>
      }
      log?: {
        read: () => Promise<{ path: string; lines: string[]; error?: string }>
        clear: () => Promise<{ ok?: boolean; error?: string }>
      }
      version?: () => Promise<{ version: string }>
    }
  }
}
