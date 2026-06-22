import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { ChannelList } from './components/ChannelList'
import { Player } from './components/Player'
import { SourcePicker } from './components/SourcePicker'
import { parseM3U, type Channel } from './lib/m3u'
import { PLAYLIST_SOURCES, type PlaylistSource } from './lib/playlists'
import { fetchPlaylist, loadCached } from './lib/storage'

const DEFAULT_SOURCE_ID = 'vn'

const App = () => {
  const [source, setSource] = useState<PlaylistSource>(
    PLAYLIST_SOURCES.find((s) => s.id === DEFAULT_SOURCE_ID) ?? PLAYLIST_SOURCES[0],
  )
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<Channel | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (next: PlaylistSource) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSource(next)
    setActive(null)
    setError(null)

    const cached = loadCached<string>(`src:${next.id}`)
    setIsCached(!!cached)

    if (cached) {
      setChannels(parseM3U(cached))
      setLoading(false)
    } else {
      setLoading(true)
    }

    try {
      const text = await fetchPlaylist(next.url, `src:${next.id}`, ctrl.signal)
      if (ctrl.signal.aborted) return
      setChannels(parseM3U(text))
      setIsCached(true)
      setLoading(false)
    } catch (e) {
      if (ctrl.signal.aborted) return
      const message = e instanceof Error ? e.message : 'Không tải được playlist.'
      setError(message)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.resolve().then(() => {
      load(source)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const onSelect = (channel: Channel) => setActive(channel)

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <button
            type="button"
            className="topbar__toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Thu hẹp danh sách kênh" : "Mở rộng danh sách kênh"}
          >
            {sidebarOpen ? '◀ Thu hẹp' : '▶ Mở rộng'}
          </button>
          <span className="topbar__logo">📺</span>
          <h1 className="topbar__title">IPTV Web</h1>
          <span className="topbar__subtitle">
            từ <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noreferrer">iptv-org</a>
          </span>
        </div>
        <SourcePicker activeId={source.id} onChange={load} />
      </header>

      <main className={`layout ${sidebarOpen ? '' : 'layout--sidebar-collapsed'}`}>
        <ChannelList
          channels={channels}
          loading={loading}
          error={error}
          activeId={active?.id ?? null}
          onSelect={onSelect}
        />
        <section className="stage">
          <Player channel={active} />
          {active && (
            <div className="stage__info">
              <h2 className="stage__title">{active.name}</h2>
              <div className="stage__meta">
                {active.groups.length > 0 && (
                  <span className="stage__chip">{active.groups.join(' · ')}</span>
                )}
                {active.tvgId && <span className="stage__chip">tvg-id: {active.tvgId}</span>}
                {isCached && <span className="stage__chip stage__chip--ok">cached</span>}
              </div>
            </div>
          )}
          {!active && !loading && channels.length === 0 && !error && (
            <div className="stage__empty">Playlist trống.</div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>
          Dữ liệu từ <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noreferrer">iptv-org/iptv</a> ·
          Một số kênh có thể bị geo-block hoặc chặn CORS.
        </span>
      </footer>
    </div>
  )
}

export default App
