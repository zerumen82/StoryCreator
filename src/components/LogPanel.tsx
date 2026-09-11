import { useState, useEffect, useCallback } from 'react'
import { getLogs, subscribeLogs, clearLog } from '../utils/logger'

export default function LogPanel() {
  const [mainLines, setMainLines] = useState<string[]>([])
  const [mainPath, setMainPath] = useState('')
  const [mainError, setMainError] = useState<string | null>(null)
  const [appLines, setAppLines] = useState<string[]>(() => getLogs())
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<'main' | 'app'>('main')

  const hasMainBridge = (() => {
    try {
      return !!window.electronAPI?.log
    } catch {
      return false
    }
  })()

  const loadMain = useCallback(async () => {
    try {
      const api = window.electronAPI?.log
      if (!api) {
        setMainError('Solo disponible en la app instalada (Electron).')
        return
      }
      const res = await api.read()
      setMainPath(res.path)
      setMainLines(res.lines)
      setMainError(res.error || null)
    } catch (e) {
      setMainError(e instanceof Error ? e.message : 'No se pudo leer')
    }
  }, [])

  useEffect(() => {
    loadMain()
    const unsub = subscribeLogs(() => setAppLines(getLogs()))
    const t = setInterval(loadMain, 5000)
    return () => {
      unsub()
      clearInterval(t)
    }
  }, [loadMain])

  const clearMain = async () => {
    try {
      await window.electronAPI?.log?.clear()
      loadMain()
    } catch (e) {
      setMainError(e instanceof Error ? e.message : 'No se pudo limpiar')
    }
  }

  const lines = (tab === 'main' ? mainLines : appLines).filter((l) =>
    filter ? l.toLowerCase().includes(filter.toLowerCase()) : true
  )

  return (
    <div className="h-full flex flex-col p-6">
      <div className="max-w-6xl mx-auto w-full space-y-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold">📋 Registros</h2>
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            <button
              onClick={() => setTab('main')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'main' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Principal ({mainLines.length})
            </button>
            <button
              onClick={() => setTab('app')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'app' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              App en vivo ({appLines.length})
            </button>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar…"
            className="ml-auto px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
          />
          <button onClick={loadMain} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs">
            🔄 Actualizar
          </button>
          <button
            onClick={() => (tab === 'main' ? clearMain() : clearLog())}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs"
          >
            🧹 Limpiar
          </button>
        </div>

        {tab === 'main' && mainPath && (
          <p className="text-[11px] text-gray-500 break-all">Archivo: {mainPath}</p>
        )}
        {tab === 'main' && mainError && (
          <p className="text-xs text-amber-300">{mainError}</p>
        )}
        {tab === 'app' && (
          <p className="text-[11px] text-gray-500">Lo que la app registra mientras la usas (se actualiza solo).</p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto bg-black/60 border border-gray-800 rounded-xl p-4 font-mono text-[11px] leading-relaxed">
          {lines.length === 0 ? (
            <p className="text-gray-600">Sin líneas{filter ? ' para este filtro' : ''}.</p>
          ) : (
            lines.map((l, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all ${/ERROR|FAIL|error|❌/.test(l) ? 'text-red-300' : /WARN|⚠/.test(l) ? 'text-amber-300' : 'text-gray-300'}`}>
                {l}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
