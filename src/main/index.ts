
import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  WebContentsView,
} from 'electron'
import { join } from 'node:path'

let mainWindow: BrowserWindow | null = null
let browserView: WebContentsView | null = null
let currentUrl = ''

const hiddenBounds = {
  x: -10000,
  y: -10000,
  width: 1,
  height: 1,
}

let contentBounds = {
  x: 0,
  y: 110,
  width: 1000,
  height: 600,
}

function isSafeWebUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function resolveDestination(input: string): string {
  const value = input.trim()

  if (!value || value.length > 2048) {
    throw new Error('Enter a valid website or search query.')
  }

  let candidate: string

  if (/^https?:\/\//i.test(value)) {
    candidate = value
  } else if (
    !/\s/.test(value) &&
    /^[\w.-]+(?::\d+)?(?:\/.*)?$/.test(value) &&
    value.includes('.')
  ) {
    candidate = `https://${value}`
  } else {
    candidate = `https://www.google.com/search?q=${encodeURIComponent(value)}`
  }

  if (!isSafeWebUrl(candidate)) {
    throw new Error('Only HTTP and HTTPS destinations are allowed.')
  }

  return candidate
}

function sendNavigationState() {
  if (!mainWindow || !browserView || mainWindow.isDestroyed()) return

  mainWindow.webContents.send('jayx:navigation-state', {
    url: browserView.webContents.getURL(),
    title: browserView.webContents.getTitle(),
    canGoBack: browserView.webContents.navigationHistory.canGoBack(),
    canGoForward: browserView.webContents.navigationHistory.canGoForward(),
    loading: browserView.webContents.isLoading(),
  })
}

function setBrowserBounds() {
  if (!browserView) return

  browserView.setBounds(
    currentUrl ? contentBounds : hiddenBounds,
  )
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#101216',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  browserView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.contentView.addChildView(browserView)
  setBrowserBounds()

  const contents = browserView.webContents

  contents.on('did-start-loading', sendNavigationState)
  contents.on('did-stop-loading', sendNavigationState)
  contents.on('did-navigate', sendNavigationState)
  contents.on('did-navigate-in-page', sendNavigationState)
  contents.on('page-title-updated', sendNavigationState)

  contents.on('will-navigate', (event, url) => {
    if (!isSafeWebUrl(url)) {
      event.preventDefault()
    }
  })

  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeWebUrl(url)) {
      void shell.openExternal(url)
    }

    return { action: 'deny' }
  })

  mainWindow.on('resize', () => {
    // The renderer will report the actual content area's bounds.
    mainWindow?.webContents.send('jayx:window-resized')
  })

  mainWindow.on('closed', () => {
    browserView?.webContents.close()
    browserView = null
    mainWindow = null
    currentUrl = ''
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(
      join(__dirname, '../renderer/index.html'),
    )
  }
}

function isTrustedRenderer(sender: Electron.WebContents): boolean {
  return Boolean(
    mainWindow &&
    !mainWindow.isDestroyed() &&
    sender === mainWindow.webContents,
  )
}

ipcMain.handle('jayx:navigate', async (event, input: unknown) => {
  if (!isTrustedRenderer(event.sender)) {
    throw new Error('Untrusted navigation request.')
  }

  if (typeof input !== 'string') {
    throw new Error('The destination must be text.')
  }

  const destination = resolveDestination(input)

  if (!browserView) {
    throw new Error('The browser surface is not ready.')
  }

  currentUrl = destination
  setBrowserBounds()

  try {
    await browserView.webContents.loadURL(destination)
    sendNavigationState()
    return { ok: true, url: destination }
  } catch {
    return {
      ok: false,
      error: 'Unable to load this destination. Check your connection or URL.',
    }
  }
})

ipcMain.handle('jayx:back', (event) => {
  if (!isTrustedRenderer(event.sender) || !browserView) return

  const history = browserView.webContents.navigationHistory

  if (history.canGoBack()) {
    history.goBack()
  }
})

ipcMain.handle('jayx:forward', (event) => {
  if (!isTrustedRenderer(event.sender) || !browserView) return

  const history = browserView.webContents.navigationHistory

  if (history.canGoForward()) {
    history.goForward()
  }
})

ipcMain.handle('jayx:reload', (event) => {
  if (!isTrustedRenderer(event.sender) || !browserView) return

  browserView.webContents.reload()
})

ipcMain.handle('jayx:hide-page', (event) => {
  if (!isTrustedRenderer(event.sender)) return

  currentUrl = ''
  setBrowserBounds()
})

ipcMain.on('jayx:set-content-bounds', (event, value: unknown) => {
  if (!isTrustedRenderer(event.sender) || !value || typeof value !== 'object') {
    return
  }

  const bounds = value as Record<string, unknown>
  const { x, y, width, height } = bounds

  if (
    ![x, y, width, height].every(
      (number) => typeof number === 'number' && Number.isFinite(number),
    )
  ) {
    return
  }

  contentBounds = {
    x: Math.max(0, Math.round(x as number)),
    y: Math.max(0, Math.round(y as number)),
    width: Math.max(1, Math.round(width as number)),
    height: Math.max(1, Math.round(height as number)),
  }

  setBrowserBounds()
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
