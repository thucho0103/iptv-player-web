import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { ChannelList } from './components/ChannelList'
import { Player } from './components/Player'
import { SourcePicker } from './components/SourcePicker'
import { parseM3U, type Channel } from './lib/m3u'
import { PLAYLIST_SOURCES, type PlaylistSource } from './lib/playlists'
import { fetchPlaylist, loadCached } from './lib/storage'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<Channel | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>('__all__')

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
          const found = channels.find(
            (c) => slugify(c.name).toLowerCase() === channelName.toLowerCase(),
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

  const onSourceChange = (next: PlaylistSource) => {
    // Reset filters when switching sources manually
    setQuery('')
    setGroup('__all__')
    window.location.hash = `#/${next.id}`
  }

  const goHome = () => {
    window.location.hash = ''
    if (!window.location.hash) {
      setQuery('')
      setGroup('__all__')
      setActive(null)
    }
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
          <SourcePicker activeId={source.id} onChange={onSourceChange} />
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
          channels={channels}
          loading={loading}
          error={error}
          activeId={active?.id ?? null}
          onSelect={onSelect}
          query={query}
          setQuery={setQuery}
          group={group}
          setGroup={setGroup}
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
