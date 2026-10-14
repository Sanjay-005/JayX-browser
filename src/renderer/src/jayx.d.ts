
export {}

declare global {
  interface Window {
    jayxBrowser: {
      loadWorkspace: () => Promise<{
        tabs: { id: number; title: string; url: string }[]
        activeId: number
        bookmarks: { id: string; title: string; url: string }[]
     }>

      saveWorkspace: (state: {
        tabs: { id: number; title: string; url: string }[]
        activeId: number
        bookmarks: { id: string; title: string; url: string }[]
      }) => Promise<{ ok: boolean }>

      navigate: (
        input: string,
        tabId?: string,
      ) => Promise<
        | { ok: true; url: string }
        | { ok: false; error: string }
      >

      activateTab: (tabId: string) => Promise<void>
      closeTab: (tabId: string) => Promise<void>
      back: (tabId?: string) => Promise<void>
      forward: (tabId?: string) => Promise<void>
      reload: (tabId?: string) => Promise<void>
      hidePage: (tabId?: string) => Promise<void>

      setContentBounds: (bounds: {
        x: number
        y: number
        width: number
        height: number
      }) => void

      onNavigationState: (
        callback: (state: {
          tabId: string
          url: string
          title: string
          canGoBack: boolean
          canGoForward: boolean
          loading: boolean
        }) => void,
      ) => () => void

      onWindowResized: (
        callback: () => void,
      ) => () => void
    }
  }
}
