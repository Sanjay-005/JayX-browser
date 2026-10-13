
import { useState, type FormEvent } from 'react'
import './assets/main.css'

type BrowserTab = {
  id: number
  title: string
  url: string
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
  const [notice, setNotice] = useState(
    'Your browser workspace, ready to explore.'
  )

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  function addTab() {
    const id = Math.max(0, ...tabs.map((tab) => tab.id)) + 1
    setTabs((current) => [
      ...current,
      { id, title: 'New Tab', url: '' },
    ])
    setActiveId(id)
    setAddress('')
    setNotice('New tab created. Website navigation comes next.')
  }

  function closeTab(id: number) {
    if (tabs.length === 1) {
      setTabs([{ id, title: 'New Tab', url: '' }])
      setActiveId(id)
      setAddress('')
      return
    }

    const remaining = tabs.filter((tab) => tab.id !== id)
    setTabs(remaining)

    if (activeId === id) {
      const nextTab = remaining[remaining.length - 1]
      setActiveId(nextTab.id)
      setAddress(nextTab.url)
    }
  }

  function navigate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = address.trim()
    if (!input) return

    const destination = /^https?:\/\//i.test(input)
      ? input
      : input.includes('.') && !input.includes(' ')
        ? `https://${input}`
        : `https://www.google.com/search?q=${encodeURIComponent(input)}`

    setTabs((current) =>
      current.map((tab) =>
        tab.id === activeId
          ? {
              ...tab,
              url: destination,
              title: getDisplayTitle(destination),
            }
          : tab
      )
    )

    setNotice(
      'Address recognized. Real website loading will be connected in the next step.'
    )
  }

  function selectTab(tab: BrowserTab) {
    setActiveId(tab.id)
    setAddress(tab.url)
    setNotice(
      tab.url
        ? `Selected ${tab.title}. Website rendering is not connected yet.`
        : 'Your browser workspace, ready to explore.'
    )
  }

  function openShortcut(url: string) {
    setAddress(url)
    setNotice(
      `Selected ${getDisplayTitle(url)}. Website loading comes in the next step.`
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
              onClick={() => selectTab(tab)}
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
                  closeTab(tab.id)
                }}
              >
                ×
              </span>
            </button>
          ))}
          <button className="new-tab" onClick={addTab} title="New tab">
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
          <button className="icon-button" disabled title="Back — coming soon">
            ←
          </button>
          <button className="icon-button" disabled title="Forward — coming soon">
            →
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setAddress(activeTab.url)
              setNotice('Reload will work when website rendering is connected.')
            }}
            title="Reload"
          >
            ↻
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setAddress('')
              setNotice('Returned to the JayX new-tab workspace.')
              setTabs((current) =>
                current.map((tab) =>
                  tab.id === activeId
                    ? { ...tab, title: 'New Tab', url: '' }
                    : tab
                )
              )
            }}
            title="Home"
          >
            ⌂
          </button>
        </div>

        <form className="address-form" onSubmit={navigate}>
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

      <div className="workspace">
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

          <form className="hero-search" onSubmit={navigate}>
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
                <span className="shortcut-icon">{shortcut.symbol}</span>
                <span className="shortcut-name">{shortcut.name}</span>
                <span className="shortcut-arrow">↗</span>
              </button>
            ))}
          </div>

          <div className="feature-card">
            <div className="feature-icon">✳</div>
            <div className="feature-copy">
              <span className="feature-label">INTRODUCING JAYX AI</span>
              <h2>Your next idea starts here.</h2>
              <p>
                Understand pages, explore research, and find connections
                with an assistant designed to work locally.
              </p>
              <button
                className="text-button"
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
            {notice}
          </p>
        </section>

        {showAI && (
          <aside className="ai-panel">
            <div className="ai-panel-header">
              <div>
                <span className="feature-label">JAYX INTELLIGENCE</span>
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
              <span className="coming-soon">AI ENGINE · COMING SOON</span>
            </div>
          </aside>
        )}
      </div>

      <footer className="status-bar">
        <span><span className="status-dot" /> JayX Browser</span>
        <span>Local-first by design</span>
        <span>Build 0.1.0 · Preview</span>
      </footer>
    </main>
  )
}

export default App
