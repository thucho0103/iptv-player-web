import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import './App.css'
import { ChannelList } from './components/ChannelList'
import { Player } from './components/Player'

import { parseM3U, getStreamLabel, enrichChannelsWithStreams, type Channel, type ApiStream, type Stream } from './lib/m3u'
import { PLAYLIST_SOURCES, type PlaylistSource } from './lib/playlists'
import { fetchPlaylist, loadCached, clearCachedPlaylists } from './lib/storage'

const DEFAULT_SOURCE_ID = 'vn'

const slugify = (text: string): string => {
  return text.trim().replace(/\s+/g, '-')
}

const parseHash = () => {
  const hash = window.location.hash
  if (!hash.startsWith('#/')) {
    return { sourceId: null, channelName: null, group: '__all__', search: '' }
  }
  const parts = hash.slice(2).split('?')
  const pathPart = parts[0]
  const queryPart = parts[1] || ''

  const pathSegments = pathPart.split('/').filter(Boolean)
  const sourceId = pathSegments[0] || null
  const channelName = pathSegments[1] ? decodeURIComponent(pathSegments[1]) : null

  const searchParams = new URLSearchParams(queryPart)
  const group = searchParams.get('group') || '__all__'
  const search = searchParams.get('q') || ''

  return { sourceId, channelName, group, search }
}

const App = () => {
  const [source, setSource] = useState<PlaylistSource>(
    PLAYLIST_SOURCES.find((s) => s.id === DEFAULT_SOURCE_ID) ?? PLAYLIST_SOURCES[0],
  )
  const [channels, setChannels] = useState<Channel[]>([])
  const [apiStreams, setApiStreams] = useState<ApiStream[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<Channel | null>(null)
  const [activeStreamIndex, setActiveStreamIndex] = useState(0)
  const [isCached, setIsCached] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>('__all__')

  // Fetch streams list in background to enrich channels with alternative streams
  useEffect(() => {
    fetch('https://iptv-org.github.io/api/streams.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setApiStreams(data)
      })
      .catch((err) => {
        console.error('Không tải được danh sách stream từ API:', err)
      })
  }, [])

  // Reset active stream index to 0 when active channel changes
  useEffect(() => {
    setActiveStreamIndex(0)
  }, [active?.id])

  const enrichedChannels = useMemo<Channel[]>(() => {
    return enrichChannelsWithStreams(channels, apiStreams)
  }, [channels, apiStreams])

  const activeEnriched = useMemo<Channel | null>(() => {
    if (!active) return null
    return enrichedChannels.find((c: Channel) => c.id === active.id) || active
  }, [active, enrichedChannels])

  const abortRef = useRef<AbortController | null>(null)
  const pendingChannelNameRef = useRef<string | null>(null)
  const activeRef = useRef<Channel | null>(null)
  const lastProcessedHashRef = useRef<string | null>(null)

  // Keep activeRef in sync
  useEffect(() => {
    activeRef.current = active
  }, [active])

  const load = useCallback(async (next: PlaylistSource) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSource(next)
    setActive(null)
    setError(null)

    const cached = loadCached<string>(`src:${next.id}`)
    setIsCached(!!cached)

    let loadedChannels: Channel[] = []

    if (cached) {
      loadedChannels = parseM3U(cached)
      setChannels(loadedChannels)
      setLoading(false)

      const targetName = pendingChannelNameRef.current || activeRef.current?.name
      if (targetName) {
        const found = loadedChannels.find(
          (c) => slugify(c.name).toLowerCase() === slugify(targetName).toLowerCase(),
        )
        if (found) {
          setActive(found)
          pendingChannelNameRef.current = null
        }
      }
    } else {
      setLoading(true)
    }

    try {
      const text = await fetchPlaylist(next.url, `src:${next.id}`, ctrl.signal)
      if (ctrl.signal.aborted) return
      loadedChannels = parseM3U(text)
      setChannels(loadedChannels)
      setIsCached(true)
      setLoading(false)

      const targetName = pendingChannelNameRef.current || activeRef.current?.name
      if (targetName) {
        const found = loadedChannels.find(
          (c) => slugify(c.name).toLowerCase() === slugify(targetName).toLowerCase(),
        )
        if (found) {
          setActive(found)
        } else {
          setActive(null)
        }
        pendingChannelNameRef.current = null
      }
    } catch (e) {
      if (ctrl.signal.aborted) return
      const message = e instanceof Error ? e.message : 'Không tải được playlist.'
      setError(message)
      setLoading(false)
      pendingChannelNameRef.current = null
    }
  }, [])

  // Synchronize React state to URL hash
  useEffect(() => {
    const currentSourceId = source.id
    const currentChannelName = active ? active.name : null

    // If we are at the default state (default source, no channel, no filters),
    // and the window has no hash, we don't set any hash (keep it as clean root path /)
    const isDefaultState =
      currentSourceId === DEFAULT_SOURCE_ID &&
      !currentChannelName &&
      group === '__all__' &&
      !query.trim()

    if (isDefaultState && (!window.location.hash || window.location.hash === '#')) {
      return
    }

    let targetHash = `#/${currentSourceId}`
    if (currentChannelName) {
      targetHash += `/${encodeURIComponent(slugify(currentChannelName))}`
    }
    const params = new URLSearchParams()
    if (group !== '__all__') {
      params.set('group', group)
    }
    if (query.trim()) {
      params.set('q', query.trim())
    }
    const paramStr = params.toString()
    if (paramStr) {
      targetHash += `?${paramStr}`
    }

    if (window.location.hash !== targetHash) {
      lastProcessedHashRef.current = targetHash
      window.location.hash = targetHash
    }
  }, [source.id, active, group, query])

  // 1. Initial URL load on mount
  useEffect(() => {
    const initialHash = window.location.hash
    if (!initialHash.startsWith('#/')) {
      const nextSource = PLAYLIST_SOURCES.find((s) => s.id === DEFAULT_SOURCE_ID) || PLAYLIST_SOURCES[0]
      load(nextSource)
    } else {
      const { sourceId, channelName, group: nextGroup, search: nextSearch } = parseHash()
      const nextSourceId = sourceId || DEFAULT_SOURCE_ID
      const nextSource = PLAYLIST_SOURCES.find((s) => s.id === nextSourceId) || PLAYLIST_SOURCES[0]

      pendingChannelNameRef.current = channelName
      load(nextSource)
      setGroup(nextGroup)
      setQuery(nextSearch)
    }
  }, [load])

  // 2. Synchronize URL hash back to React state on hash change
  useEffect(() => {
    const handleHashChange = () => {
      const currentHash = window.location.hash
      if (currentHash === lastProcessedHashRef.current) return
      lastProcessedHashRef.current = currentHash

      const { sourceId, channelName, group: nextGroup, search: nextSearch } = parseHash()

      const nextSourceId = sourceId || DEFAULT_SOURCE_ID
      const nextSource = PLAYLIST_SOURCES.find((s) => s.id === nextSourceId) || PLAYLIST_SOURCES[0]

      if (nextSource.id !== source.id) {
        pendingChannelNameRef.current = channelName
        load(nextSource)
      } else {
        if (channelName) {
          const found = enrichedChannels.find(
            (c: Channel) => slugify(c.name).toLowerCase() === channelName.toLowerCase(),
          )
          if (found) {
            setActive(found)
          } else {
            if (loading) {
              pendingChannelNameRef.current = channelName
            } else {
              setActive(null)
            }
          }
        } else {
          setActive(null)
        }
      }

      setGroup(nextGroup)
      setQuery(nextSearch)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [source.id, channels, loading, load])

  const onSelect = (channel: Channel) => setActive(channel)

  const goHome = () => {
    window.location.hash = ''
    if (!window.location.hash) {
      setQuery('')
      setGroup('__all__')
      setActive(null)
    }
  }

  const handleClearCache = () => {
    clearCachedPlaylists()
    setIsCached(false)
    setClearing(true)
    setTimeout(() => setClearing(false), 2000)
    load(source)
  }

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
            <span className="topbar__toggle-text">
              {sidebarOpen ? '◀ Thu hẹp' : '▶ Mở rộng'}
            </span>
            <span className="topbar__toggle-icon">
              {sidebarOpen ? '✕ Kênh' : '☰ Kênh'}
            </span>
          </button>
          <button
            type="button"
            className="topbar__logo-btn"
            onClick={goHome}
            title="Về trang chủ"
          >
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} className="topbar__logo" alt="IPTV Web Logo" />
          </button>
          <h1 className="topbar__title" onClick={goHome} title="Về trang chủ">
            IPTV Web
          </h1>
          <span className="topbar__subtitle">
            từ <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noreferrer">iptv-org</a>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

          <button
            type="button"
            className={`topbar__clear-cache-btn ${clearing ? 'topbar__clear-cache-btn--success' : ''}`}
            onClick={handleClearCache}
            title="Xóa cache danh sách kênh và tải lại"
          >
            <span className="topbar__clear-cache-text">
              {clearing ? '✔️ Đã xóa' : '🗑️ Xóa cache'}
            </span>
            <span className="topbar__clear-cache-icon">
              {clearing ? '✔️' : '🗑️'}
            </span>
          </button>
          <button
            type="button"
            className="topbar__home-btn"
            onClick={goHome}
            title="Về trang chủ"
          >
            <span className="topbar__home-text">🏠 Trang chủ</span>
            <span className="topbar__home-icon">🏠</span>
          </button>
        </div>
      </header>

      <main className={`layout ${sidebarOpen ? '' : 'layout--sidebar-collapsed'} ${active ? 'layout--has-active' : ''}`}>
        <ChannelList
          channels={enrichedChannels}
          loading={loading}
          error={error}
          activeId={activeEnriched?.id ?? null}
          onSelect={onSelect}
          query={query}
          setQuery={setQuery}
          group={group}
          setGroup={setGroup}
        />
        <section className="stage">
          <Player channel={activeEnriched} activeStreamIndex={activeStreamIndex} />
          {activeEnriched && (
            <div className="stage__info">
              <h2 className="stage__title">{activeEnriched.name}</h2>
              {activeEnriched.streams.length > 1 && (
                <div className="stage__streams">
                  <span className="stage__streams-label">Đường truyền:</span>
                  <div className="stage__streams-list">
                    {activeEnriched.streams.map((stream: Stream, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        className={`stage__stream-btn ${idx === activeStreamIndex ? 'stage__stream-btn--active' : ''}`}
                        onClick={() => setActiveStreamIndex(idx)}
                      >
                        {getStreamLabel(stream.name, activeEnriched.name, idx)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="stage__meta">
                {activeEnriched.groups.length > 0 && (
                  <span className="stage__chip">{activeEnriched.groups.join(' · ')}</span>
                )}
                {activeEnriched.tvgId && <span className="stage__chip">tvg-id: {activeEnriched.tvgId}</span>}
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
