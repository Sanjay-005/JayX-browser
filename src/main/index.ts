
import { app, BrowserWindow, ipcMain, shell, WebContentsView } from 'electron'
import { join } from 'node:path'

type ContentBounds = {
  x: number
  y: number
  width: number
  height: number
}

type NavigationPayload = {
  tabId: string
  input: string
}

let mainWindow: BrowserWindow | null = null
let activeTabId = 'tab-1'

let contentBounds: ContentBounds = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
}

const browserViews = new Map<string, WebContentsView>()
const tabUrls = new Map<string, string>()

function isSafeWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function resolveDestination(input: string): string {
  const value = input.trim()

  if (!value) {
    throw new Error('Enter a URL or search query.')
  }

  if (isSafeWebUrl(value)) {
    return new URL(value).toString()
  }

  // Treat a domain or localhost address as a website.
  if (!/\s/.test(value) && (value.includes('.') || value.startsWith('localhost'))) {
    const candidate = `https://${value}`

    if (isSafeWebUrl(candidate)) {
      return new URL(candidate).toString()
    }
  }

  return `https://www.google.com/search?q=${encodeURIComponent(value)}`
}

function isTrustedRenderer(sender: Electron.WebContents): boolean {
  return Boolean(mainWindow && sender === mainWindow.webContents)
}

function sendNavigationState(tabId: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const view = browserViews.get(tabId)

  mainWindow.webContents.send('jayx:navigation-state', {
    tabId,
    url: tabUrls.get(tabId) ?? '',
    title: view?.webContents.getTitle() || 'New Tab',
    canGoBack: view?.webContents.navigationHistory.canGoBack() ?? false,
    canGoForward: view?.webContents.navigationHistory.canGoForward() ?? false,
    loading: view?.webContents.isLoading() ?? false,
  })
}

function updateViewBounds(): void {
  for (const [tabId, view] of browserViews) {
    const isActive = tabId === activeTabId
    const hasPage = Boolean(tabUrls.get(tabId))

    view.setBounds(
      isActive && hasPage
        ? contentBounds
        : { x: 0, y: 0, width: 0, height: 0 },
    )
  }
}

function activateTab(tabId: string): void {
  activeTabId = tabId
  updateViewBounds()
  sendNavigationState(tabId)
}

function getOrCreateBrowserView(tabId: string): WebContentsView {
  const existingView = browserViews.get(tabId)

  if (existingView) return existingView

  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('The JayX window is not available.')
  }

  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  browserViews.set(tabId, view)
  mainWindow.contentView.addChildView(view)

  view.webContents.on('did-start-loading', () => {
    sendNavigationState(tabId)
  })

  view.webContents.on('did-stop-loading', () => {
    sendNavigationState(tabId)
  })

  view.webContents.on('did-navigate', (_event, url) => {
    tabUrls.set(tabId, url)
    sendNavigationState(tabId)
  })

  view.webContents.on('did-navigate-in-page', (_event, url) => {
    tabUrls.set(tabId, url)
    sendNavigationState(tabId)
  })

  view.webContents.on('page-title-updated', () => {
    sendNavigationState(tabId)
  })

  view.webContents.on('will-navigate', (event, url) => {
    if (!isSafeWebUrl(url)) {
      event.preventDefault()
    }
  })

  view.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeWebUrl(url)) {
      void shell.openExternal(url)
    }

    return { action: 'deny' }
  })

  return view
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.on('resize', () => {
    mainWindow?.webContents.send('jayx:window-resized')
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    for (const view of browserViews.values()) {
      if (!view.webContents.isDestroyed()) {
        view.webContents.close()
      }
    }

    browserViews.clear()
    tabUrls.clear()
    mainWindow = null
  })
}

ipcMain.handle(
  'jayx:navigate',
  async (event, payload: string | NavigationPayload) => {
    if (!isTrustedRenderer(event.sender)) {
      return { ok: false, error: 'Untrusted renderer.' }
    }

    // A string keeps the existing renderer API working during this step.
    const tabId = typeof payload === 'string' ? activeTabId : payload.tabId
    const input = typeof payload === 'string' ? payload : payload.input

    try {
      const destination = resolveDestination(input)
      const view = getOrCreateBrowserView(tabId)

      activeTabId = tabId
      tabUrls.set(tabId, destination)
      updateViewBounds()
      sendNavigationState(tabId)

      await view.webContents.loadURL(destination)

      return { ok: true, url: destination }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Navigation failed.',
      }
    }
  },
)

ipcMain.handle('jayx:activate-tab', (event, tabId: string) => {
  if (!isTrustedRenderer(event.sender) || typeof tabId !== 'string') return

  activateTab(tabId)
})

ipcMain.handle('jayx:back', (event, tabId?: string) => {
  if (!isTrustedRenderer(event.sender)) return

  const view = browserViews.get(tabId ?? activeTabId)
  const history = view?.webContents.navigationHistory

  if (history?.canGoBack()) {
    history.goBack()
  }
})

ipcMain.handle('jayx:forward', (event, tabId?: string) => {
  if (!isTrustedRenderer(event.sender)) return

  const view = browserViews.get(tabId ?? activeTabId)
  const history = view?.webContents.navigationHistory

  if (history?.canGoForward()) {
    history.goForward()
  }
})

ipcMain.handle('jayx:reload', (event, tabId?: string) => {
  if (!isTrustedRenderer(event.sender)) return

  const view = browserViews.get(tabId ?? activeTabId)

  if (view && !view.webContents.isDestroyed()) {
    view.webContents.reload()
  }
})

ipcMain.handle('jayx:hide-page', (event, tabId?: string) => {
  if (!isTrustedRenderer(event.sender)) return

  const targetTabId = tabId ?? activeTabId
  tabUrls.delete(targetTabId)
  updateViewBounds()
  sendNavigationState(targetTabId)
})

ipcMain.on('jayx:set-content-bounds', (event, bounds: ContentBounds) => {
  if (!isTrustedRenderer(event.sender)) return

  const valid =
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width >= 0 &&
    bounds.height >= 0

  if (!valid) return

  contentBounds = bounds
  updateViewBounds()
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
