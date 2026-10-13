
export {}

declare global {
  interface Window {
    jayxBrowser: {
      navigate: (
        input: string,
      ) => Promise<
        | { ok: true; url: string }
        | { ok: false; error: string }
      >

      back: () => Promise<void>
      forward: () => Promise<void>
      reload: () => Promise<void>
      hidePage: () => Promise<void>

      setContentBounds: (bounds: {
        x: number
        y: number
        width: number
        height: number
      }) => void

      onNavigationState: (
        callback: (state: {
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
