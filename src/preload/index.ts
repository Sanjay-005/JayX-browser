
import { contextBridge, ipcRenderer } from 'electron'

export type JayXNavigationState = {
  tabId: string
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
}

export type JayXContentBounds = {
  x: number
  y: number
  width: number
  height: number
}

contextBridge.exposeInMainWorld('jayxBrowser', {
  loadWorkspace: () =>
    ipcRenderer.invoke('jayx:load-workspace'),

  saveWorkspace: (state: {
    tabs: { id: number; title: string; url: string }[]
    activeId: number
    bookmarks: { id: string; title: string; url: string }[]
  }) => ipcRenderer.invoke('jayx:save-workspace', state),

  navigate: (input: string, tabId?: string) =>
    ipcRenderer.invoke(
      'jayx:navigate',
      tabId ? { tabId, input } : input,
    ),

  activateTab: (tabId: string) =>
    ipcRenderer.invoke('jayx:activate-tab', tabId),

  closeTab: (tabId: string) =>
    ipcRenderer.invoke('jayx:close-tab', tabId),


  back: (tabId?: string) =>
    ipcRenderer.invoke('jayx:back', tabId),

  forward: (tabId?: string) =>
    ipcRenderer.invoke('jayx:forward', tabId),

  reload: (tabId?: string) =>
    ipcRenderer.invoke('jayx:reload', tabId),

  hidePage: (tabId?: string) =>
    ipcRenderer.invoke('jayx:hide-page', tabId),

  setContentBounds: (bounds: JayXContentBounds) =>
    ipcRenderer.send('jayx:set-content-bounds', bounds),

  onNavigationState: (
    callback: (state: JayXNavigationState) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: JayXNavigationState,
    ) => callback(state)

    ipcRenderer.on('jayx:navigation-state', listener)

    return () => {
      ipcRenderer.removeListener('jayx:navigation-state', listener)
    }
  },

  onWindowResized: (callback: () => void) => {
    const listener = () => callback()

    ipcRenderer.on('jayx:window-resized', listener)

    return () => {
      ipcRenderer.removeListener('jayx:window-resized', listener)
    }
  },
})
