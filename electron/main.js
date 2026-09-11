const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const LOG_PATH = path.join(app.getPath('userData'), 'storycreator.log')

function log(message, ...args) {
  const timestamp = new Date().toISOString()
  const fullMessage = `[${timestamp}] [MAIN] ${message}${args.length > 0 ? ' ' + args.map(String).join(' ') : ''}\n`
  try {
    fs.appendFileSync(LOG_PATH, fullMessage)
  } catch (e) {
    console.error('Failed to write main log:', e)
  }
}

// ============ Stable Diffusion local (instancia propia, puerto 8189) ============
// NO toca el ComfyUI del usuario (puerto 8188): es una instalacion aparte.
const SD_PORT = 8189
const SD_DIR_FILE = path.join(app.getPath('userData'), 'storycreator-sd-dir.txt')
const SD_AUTOSTART_FILE = path.join(app.getPath('userData'), 'storycreator-sd-autostart.txt')
let sdProcess = null

function getSdDir() {
  try {
    if (fs.existsSync(SD_DIR_FILE)) {
      const custom = fs.readFileSync(SD_DIR_FILE, 'utf8').trim()
      if (custom) return custom
    }
  } catch (e) {
    log('[SD] No se pudo leer dir override:', e.message)
  }
  return 'D:\\PROJECTS\\STORYCREATOR-SD\\ComfyUI'
}

function sdAutostartEnabled() {
  try {
    if (fs.existsSync(SD_AUTOSTART_FILE)) {
      return fs.readFileSync(SD_AUTOSTART_FILE, 'utf8').trim() !== 'off'
    }
  } catch (e) {
    log('[SD] No se pudo leer autostart:', e.message)
  }
  return true // por defecto: arrancar solo
}

async function checkSdRunning() {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(`http://127.0.0.1:${SD_PORT}/system_stats`, { signal: ctrl.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}

function startSdProcess() {
  if (sdProcess) return { already: true }
  const dir = getSdDir()
  const python = path.join(path.dirname(dir), 'venv', 'Scripts', 'python.exe')
  if (!fs.existsSync(python) || !fs.existsSync(path.join(dir, 'main.py'))) {
    const msg = `Instalación SD no encontrada en ${dir}`
    log('[SD]', msg)
    return { error: msg }
  }
  log('[SD] Arrancando ComfyUI propio en puerto', SD_PORT)
  try {
    sdProcess = spawn(python, ['main.py', '--port', String(SD_PORT), '--normalvram', '--enable-cors-header', '*'], {
      cwd: dir,
      windowsHide: true,
    })
    sdProcess.on('error', (err) => {
      log('[SD] Error proceso:', err.message)
      sdProcess = null
    })
    sdProcess.on('exit', (code) => {
      log('[SD] Proceso terminado, codigo=', code)
      sdProcess = null
    })
    return { started: true }
  } catch (e) {
    log('[SD] No se pudo arrancar:', e.message)
    return { error: e.message }
  }
}

function stopSdProcess() {
  if (!sdProcess) return { stopped: false }
  try {
    sdProcess.kill()
    sdProcess = null
    log('[SD] Proceso detenido por el usuario')
    return { stopped: true }
  } catch (e) {
    return { error: e.message }
  }
}

ipcMain.handle('sd:status', async () => {
  return { running: await checkSdRunning(), managed: !!sdProcess, port: SD_PORT }
})

ipcMain.handle('sd:start', async () => {
  if (await checkSdRunning()) return { already: true }
  return startSdProcess()
})

ipcMain.handle('sd:stop', async () => {
  return stopSdProcess()
})

ipcMain.handle('sd:get-autostart', async () => {
  return { enabled: sdAutostartEnabled() }
})

ipcMain.handle('sd:set-autostart', async (_event, enabled) => {
  try {
    fs.writeFileSync(SD_AUTOSTART_FILE, enabled ? 'on' : 'off')
    return { enabled: !!enabled }
  } catch (e) {
    return { error: e.message }
  }
})

// ============ Logs visibles desde la UI ============

ipcMain.handle('app:version', async () => {
  return { version: app.getVersion() }
})

ipcMain.handle('log:read', async () => {
  try {
    if (!fs.existsSync(LOG_PATH)) return { path: LOG_PATH, lines: [] }
    const content = fs.readFileSync(LOG_PATH, 'utf8')
    const lines = content.split('\n').filter((l) => l.trim().length > 0)
    return { path: LOG_PATH, lines: lines.slice(-400) }
  } catch (e) {
    return { path: LOG_PATH, lines: [], error: e.message }
  }
})

ipcMain.handle('log:clear', async () => {
  try {
    fs.writeFileSync(LOG_PATH, '')
    log('Log principal limpiado desde la UI')
    return { ok: true }
  } catch (e) {
    return { error: e.message }
  }
})

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  log('Creando ventana, isDev=', isDev)
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: `StoryCreator v${app.getVersion()}`,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log('[MAIN][RENDERER FAIL]', errorCode, errorDescription)
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    log('[MAIN][RENDERER GONE]', details.reason, details.exitCode)
  })

  win.webContents.on('unresponsive', () => {
    log('[MAIN][RENDERER UNRESPONSIVE]')
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    log('Cargando index:', indexPath, 'exists=', fs.existsSync(indexPath))
    win.loadFile(indexPath)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  log('App lista, userData=', app.getPath('userData'))
  createWindow()
  // Arranque automatico del SD propio (no toca el ComfyUI del usuario)
  setTimeout(async () => {
    if (!sdAutostartEnabled()) {
      log('[SD] Autostart desactivado por el usuario')
      return
    }
    if (await checkSdRunning()) {
      log('[SD] Ya estaba corriendo')
      return
    }
    const res = startSdProcess()
    log('[SD] Autostart:', JSON.stringify(res))
  }, 3000)
})

app.on('window-all-closed', () => {
  log('Todas las ventanas cerradas')
  stopSdProcess()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  log('Activate')
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

process.on('uncaughtException', (err) => {
  log('[MAIN][UNCAUGHT]', err.message)
})
