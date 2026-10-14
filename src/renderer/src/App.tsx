
import { useEffect, useRef, useState, type FormEvent } from 'react'
import './assets/main.css'

type BrowserTab = {
  id: number
  title: string
  url: string
}

type SavedBookmark = {
  id: string
  title: string
  url: string
}

type WorkspaceState = {
  tabs: BrowserTab[]
  activeId: number
  bookmarks: SavedBookmark[]
}

const shortcuts = [
  { name: 'Google', url: 'https://www.google.com', symbol: 'G' },
  { name: 'GitHub', url: 'https://github.com', symbol: '⌘' },
  { name: 'YouTube', url: 'https://www.youtube.com', symbol: '▶' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org', symbol: 'W' },
]

function getDisplayTitle(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value || 'New Tab'
  }
}

function App() {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: 1, title: 'New Tab', url: '' },
  ])

  const [activeId, setActiveId] = useState(1)
  const [address, setAddress] = useState('')
  const [showAI, setShowAI] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)

  const [notice, setNotice] = useState(
    'Your browser workspace, ready to explore.',
  )

  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [bookmarks, setBookmarks] = useState<SavedBookmark[]>([])
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)

  const workspaceRef = useRef<HTMLDivElement>(null)
  const contentSlotRef = useRef<HTMLDivElement>(null)
  const nextTabIdRef = useRef(2)

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  const isCurrentPageBookmarked = bookmarks.some(
    (bookmark) => bookmark.url === activeTab?.url && bookmark.url !== '',
  )

  // Keep the native Chromium view aligned with the React workspace.
  useEffect(() => {
    const updateBounds = () => {
      const slot = contentSlotRef.current
      if (!slot) return

      const rect = slot.getBoundingClientRect()

      window.jayxBrowser.setContentBounds({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      })
    }

    const observer = new ResizeObserver(updateBounds)

    if (workspaceRef.current) {
      observer.observe(workspaceRef.current)
    }

    if (contentSlotRef.current) {
      observer.observe(contentSlotRef.current)
    }

    updateBounds()

    const unsubscribeNavigation =
      window.jayxBrowser.onNavigationState((state) => {
        setTabs((currentTabs) =>
          currentTabs.map((tab) =>
            String(tab.id) === state.tabId
              ? {
                  ...tab,
                  url: state.url,
                  title: state.url
                    ? state.title || getDisplayTitle(state.url)
                    : 'New Tab',
                }
              : tab,
          ),
        )

        if (String(activeId) === state.tabId) {
          setAddress(state.url)
          setCanGoBack(state.canGoBack)
          setCanGoForward(state.canGoForward)
          setIsLoading(state.loading)
        }
      })

    const unsubscribeResize =
      window.jayxBrowser.onWindowResized(updateBounds)

    return () => {
      observer.disconnect()
      unsubscribeNavigation()
      unsubscribeResize()
    }
  }, [activeId, activeTab.url, showAI, showBookmarks])

  // Restore saved tabs and bookmarks when JayX starts.
  useEffect(() => {
    let cancelled = false

    const restoreWorkspace = async () => {
      try {
        const saved = await window.jayxBrowser.loadWorkspace()

        if (cancelled) return

        const restoredTabs =
          saved.tabs.length > 0
            ? saved.tabs
            : [{ id: 1, title: 'New Tab', url: '' }]

        const restoredActiveId = restoredTabs.some(
          (tab) => tab.id === saved.activeId,
        )
          ? saved.activeId
          : restoredTabs[0].id

        setTabs(restoredTabs)
        setActiveId(restoredActiveId)
        setBookmarks(saved.bookmarks)
        setAddress(
          restoredTabs.find((tab) => tab.id === restoredActiveId)?.url ?? '',
        )

        // Avoid reusing an ID that belongs to a restored tab.
        nextTabIdRef.current =
          Math.max(...restoredTabs.map((tab) => tab.id)) + 1

        setWorkspaceLoaded(true)

        // Reopen saved pages.
        for (const tab of restoredTabs) {
          if (tab.url) {
            void window.jayxBrowser.navigate(tab.url, String(tab.id))
          }
        }

        await window.jayxBrowser.activateTab(String(restoredActiveId))

        const restoredActiveTab = restoredTabs.find(
          (tab) => tab.id === restoredActiveId,
        )

        if (!restoredActiveTab?.url) {
          await window.jayxBrowser.hidePage(String(restoredActiveId))
        }
      } catch (error) {
        console.error('Failed to restore JayX workspace:', error)

        if (!cancelled) {
          setNotice('Could not restore the saved workspace.')
          setWorkspaceLoaded(true)
        }
      }
    }

    void restoreWorkspace()

    return () => {
      cancelled = true
    }
  }, [])

  // Persist changes after the user finishes making them.
  useEffect(() => {
    if (!workspaceLoaded) return

    const workspace: WorkspaceState = {
      tabs,
      activeId,
      bookmarks,
    }

    const timeoutId = window.setTimeout(() => {
      void window.jayxBrowser.saveWorkspace(workspace).catch((error) => {
        console.error('Failed to save JayX workspace:', error)
        setNotice('Could not save the workspace.')
      })
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [tabs, activeId, bookmarks, workspaceLoaded])

  async function addTab() {
    const id = nextTabIdRef.current
    nextTabIdRef.current += 1

    const newTab: BrowserTab = {
      id,
      title: 'New Tab',
      url: '',
    }

    setTabs((current) => [...current, newTab])
    setActiveId(id)
    setAddress('')
    setNotice('New tab created. Enter a URL or search query to begin.')
    setCanGoBack(false)
    setCanGoForward(false)
    setIsLoading(false)

    await window.jayxBrowser.activateTab(String(id))
  }

  async function closeTab(id: number) {
    const tabToClose = tabs.find((tab) => tab.id === id)
    if (!tabToClose) return

    const remaining = tabs.filter((tab) => tab.id !== id)

    // Release the Chromium resources for this tab.
    await window.jayxBrowser.closeTab(String(id))

    if (remaining.length === 0) {
      // Keep one empty UI tab available after the last tab is closed.
      setTabs([{ id, title: 'New Tab', url: '' }])
      setActiveId(id)
      setAddress('')
      setCanGoBack(false)
      setCanGoForward(false)
      setIsLoading(false)
      setNotice('Your browser workspace is ready.')

      await window.jayxBrowser.activateTab(String(id))
      return
    }

    setTabs(remaining)

    if (activeId === id) {
      const nextTab = remaining[remaining.length - 1]

      setActiveId(nextTab.id)
      setAddress(nextTab.url)
      setCanGoBack(false)
      setCanGoForward(false)
      setIsLoading(false)

      await window.jayxBrowser.activateTab(String(nextTab.id))

      if (!nextTab.url) {
        await window.jayxBrowser.hidePage(String(nextTab.id))
      }
    }
  }

  async function navigate(input: string, tabId: number = activeId) {
    const trimmedInput = input.trim()

    if (!trimmedInput) return

    setNotice('')

    if (tabId === activeId) {
      setAddress(trimmedInput)
      setIsLoading(true)
    }

    try {
      const result = await window.jayxBrowser.navigate(
        trimmedInput,
        String(tabId),
      )

      if (!result.ok && tabId === activeId) {
        setNotice(result.error)
        setIsLoading(false)
      }
    } catch (error) {
      if (tabId === activeId) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'Navigation failed. Please try again.',
        )
        setIsLoading(false)
      }
    }
  }

  function handleNavigateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void navigate(address)
  }

  async function selectTab(tab: BrowserTab) {
    setActiveId(tab.id)
    setAddress(tab.url)
    setNotice('')
    setCanGoBack(false)
    setCanGoForward(false)
    setIsLoading(false)

    await window.jayxBrowser.activateTab(String(tab.id))

    if (!tab.url) {
      await window.jayxBrowser.hidePage(String(tab.id))
    }
  }

  function openShortcut(url: string) {
    void navigate(url)
  }

  async function goHome() {
    setAddress('')
    setNotice('Returned to the JayX new-tab workspace.')
    setCanGoBack(false)
    setCanGoForward(false)
    setIsLoading(false)

    setTabs((current) =>
      current.map((tab) =>
        tab.id === activeId
          ? { ...tab, title: 'New Tab', url: '' }
          : tab,
      ),
    )

    await window.jayxBrowser.hidePage(String(activeId))
  }

  // Add or remove the active page from bookmarks.
  function toggleBookmark() {
    if (!activeTab?.url) {
      setNotice('Navigate to a page before bookmarking it.')
      return
    }

    if (isCurrentPageBookmarked) {
      setBookmarks((current) =>
        current.filter((bookmark) => bookmark.url !== activeTab.url),
      )
      setNotice('Bookmark removed.')
      return
    }

    const bookmark: SavedBookmark = {
      id: crypto.randomUUID(),
      title: activeTab.title || activeTab.url,
      url: activeTab.url,
    }

    setBookmarks((current) => [...current, bookmark])
    setNotice('Page bookmarked successfully.')
  }

  function openBookmark(bookmark: SavedBookmark) {
    setShowBookmarks(false)
    void navigate(bookmark.url)
  }

  function removeBookmark(id: string) {
    setBookmarks((current) =>
      current.filter((bookmark) => bookmark.id !== id),
    )
  }

  return (
    <main className="browser">
      <header className="tab-bar">
        <div className="brand">
          <span className="brand-mark">J</span>
          <span className="brand-name">JayX</span>
        </div>

        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeId === tab.id ? 'active' : ''}`}
              onClick={() => void selectTab(tab)}
              title={tab.title}
            >
              <span className="tab-dot" />
              <span className="tab-title">{tab.title}</span>

              <span
                className="tab-close"
                role="button"
                aria-label={`Close ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  void closeTab(tab.id)
                }}
              >
                ×
              </span>
            </button>
          ))}

          <button
            className="new-tab"
            onClick={() => void addTab()}
            title="New tab"
            aria-label="New tab"
          >
            +
          </button>
        </div>

        <button
          className="window-action"
          onClick={() => setShowAI((current) => !current)}
          aria-label="Toggle AI assistant"
          title="AI assistant"
        >
          ✳
        </button>
      </header>

      <div className="toolbar">
        <div className="nav-controls">
          <button
            className="icon-button"
            onClick={() => void window.jayxBrowser.back(String(activeId))}
            disabled={!canGoBack}
            title="Back"
          >
            ←
          </button>

          <button
            className="icon-button"
            onClick={() => void window.jayxBrowser.forward(String(activeId))}
            disabled={!canGoForward}
            title="Forward"
          >
            →
          </button>

          <button
            className="icon-button"
            onClick={() => void window.jayxBrowser.reload(String(activeId))}
            title="Reload"
          >
            ↻
          </button>

          <button
            className="icon-button"
            onClick={() => void goHome()}
            title="Home"
          >
            ⌂
          </button>

          <button
            type="button"
            className="toolbar-button"
            onClick={toggleBookmark}
            disabled={!activeTab?.url}
            title={
              isCurrentPageBookmarked
                ? 'Remove bookmark'
                : 'Bookmark this page'
            }
            aria-label={
              isCurrentPageBookmarked
                ? 'Remove bookmark'
                : 'Bookmark this page'
            }
          >
            {isCurrentPageBookmarked ? '★' : '☆'}
          </button>

          <button
            type="button"
            className="toolbar-button"
            onClick={() => setShowBookmarks((current) => !current)}
            title="Show bookmarks"
            aria-label="Show bookmarks"
          >
            Bookmarks ({bookmarks.length})
          </button>
        </div>

        <form className="address-form" onSubmit={handleNavigateSubmit}>
          <span className="address-lock">◇</span>

          <input
            aria-label="Address and search"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Search the web or enter an address"
            spellCheck={false}
          />

          <button className="address-submit" type="submit" title="Go">
            ↵
          </button>
        </form>

        <button
          className={`ai-button ${showAI ? 'selected' : ''}`}
          onClick={() => setShowAI((current) => !current)}
        >
          <span>✳</span> JayX AI
        </button>
      </div>

      {/* Bookmarks panel */}
      {showBookmarks && (
        <section className="bookmarks-panel">
          <div className="bookmarks-panel-header">
            <h3>Saved bookmarks</h3>

            <button
              type="button"
              className="toolbar-button"
              onClick={() => setShowBookmarks(false)}
              aria-label="Close bookmarks"
            >
              ×
            </button>
          </div>

          {bookmarks.length === 0 ? (
            <p className="bookmarks-empty">
              No bookmarks yet. Open a website and click ☆ to save it.
            </p>
          ) : (
            <div className="bookmarks-list">
              {bookmarks.map((bookmark) => (
                <div className="bookmark-item" key={bookmark.id}>
                  <button
                    type="button"
                    className="bookmark-open"
                    onClick={() => openBookmark(bookmark)}
                    title={bookmark.url}
                  >
                    <span className="bookmark-title">
                      {bookmark.title}
                    </span>
                    <span className="bookmark-url">{bookmark.url}</span>
                  </button>

                  <button
                    type="button"
                    className="bookmark-remove"
                    onClick={() => removeBookmark(bookmark.id)}
                    aria-label={`Remove ${bookmark.title}`}
                    title="Remove bookmark"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="workspace" ref={workspaceRef}>
        {activeTab.url ? (
          <div
            className="web-content-slot"
            ref={contentSlotRef}
            aria-label="Website content"
          />
        ) : (
          <section className="home-content">
            <div className="eyebrow">
              <span className="status-dot" />
              YOUR PRIVATE WORKSPACE
            </div>

            <h1>
              Browse beyond
              <br />
              <span>the ordinary.</span>
            </h1>

            <p className="hero-description">
              One workspace for the web, your research, and your ideas.
              Built with privacy and local AI in mind.
            </p>

            <form
              className="hero-search"
              onSubmit={handleNavigateSubmit}
            >
              <span className="search-symbol">⌕</span>

              <input
                aria-label="Search or enter a website"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Where would you like to go?"
                spellCheck={false}
              />

              <button type="submit">Explore ↗</button>
            </form>

            <div className="section-heading">
              <span>QUICK ACCESS</span>
              <span className="muted">Your starting points</span>
            </div>

            <div className="shortcuts">
              {shortcuts.map((shortcut) => (
                <button
                  className="shortcut"
                  key={shortcut.name}
                  onClick={() => openShortcut(shortcut.url)}
                >
                  <span className="shortcut-icon">
                    {shortcut.symbol}
                  </span>
                  <span className="shortcut-name">
                    {shortcut.name}
                  </span>
                  <span className="shortcut-arrow">↗</span>
                </button>
              ))}
            </div>

            <div className="feature-card">
              <div className="feature-icon">✳</div>

              <div className="feature-copy">
                <span className="feature-label">
                  INTRODUCING JAYX AI
                </span>

                <h2>Your next idea starts here.</h2>

                <p>
                  Understand pages, explore research, and find connections
                  with an assistant designed to work locally.
                </p>

                <button
                  className="text-button"
                  type="button"
                  onClick={() => setShowAI(true)}
                >
                  Explore the AI workspace <span>→</span>
                </button>
              </div>

              <div className="feature-orbit orbit-one" />
              <div className="feature-orbit orbit-two" />
            </div>

            <p className="status-message" role="status">
              <span className="status-dot" />
              {isLoading ? 'Loading website...' : notice}
            </p>
          </section>
        )}

        {showAI && (
          <aside className="ai-panel">
            <div className="ai-panel-header">
              <div>
                <span className="feature-label">
                  JAYX INTELLIGENCE
                </span>
                <h2>AI Assistant</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowAI(false)}
                aria-label="Close AI assistant"
              >
                ×
              </button>
            </div>

            <div className="ai-placeholder">
              <div className="ai-orb">✳</div>
              <h3>Think beyond the tab.</h3>

              <p>
                Local AI will help summarize pages, answer questions,
                and search your saved research.
              </p>

              <span className="coming-soon">
                AI ENGINE · COMING SOON
              </span>
            </div>
          </aside>
        )}
      </div>

      <footer className="status-bar">
        <span>
          <span className="status-dot" /> JayX Browser
        </span>
        <span>Local-first by design</span>
        <span>Build 0.1.0 · Preview</span>
      </footer>
    </main>
  )
}

export default App
