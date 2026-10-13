
import { contextBridge, ipcRenderer } from 'electron'

export type JayXNavigationState = {
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
}

contextBridge.exposeInMainWorld('jayxBrowser', {
  navigate: (input: string) =>
    ipcRenderer.invoke('jayx:navigate', input),

  back: () => ipcRenderer.invoke('jayx:back'),
  forward: () => ipcRenderer.invoke('jayx:forward'),
  reload: () => ipcRenderer.invoke('jayx:reload'),
  hidePage: () => ipcRenderer.invoke('jayx:hide-page'),

  setContentBounds: (bounds: {
    x: number
    y: number
    width: number
    height: number
  }) => ipcRenderer.send('jayx:set-content-bounds', bounds),

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
