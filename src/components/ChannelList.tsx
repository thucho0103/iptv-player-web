import { useMemo, useState } from 'react'
import type { Channel } from '../lib/m3u'

type ChannelListProps = {
  channels: Channel[]
  loading: boolean
  error: string | null
  activeId: string | null
  onSelect: (channel: Channel) => void
}

export const ChannelList = ({
  channels,
  loading,
  error,
  activeId,
  onSelect,
}: ChannelListProps) => {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>('__all__')

  const groups = useMemo(() => {
    const set = new Set<string>()
    for (const c of channels) {
      for (const g of c.groups) {
        if (g) set.add(g)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [channels])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return channels.filter((c) => {
      if (group !== '__all__' && !c.groups.includes(group)) return false
      if (!q) return true
      if (c.name.toLowerCase().includes(q)) return true
      if (c.tvgId && c.tvgId.toLowerCase().includes(q)) return true
      return false
    })
  }, [channels, query, group])

  return (
    <aside className="sidebar">
      <div className="sidebar__controls">
        <input
          type="search"
          className="sidebar__search"
          placeholder="Tìm kênh…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="sidebar__group"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          disabled={groups.length === 0}
        >
          <option value="__all__">Tất cả thể loại</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="sidebar__meta">
        {loading && 'Đang tải danh sách…'}
        {error && <span className="sidebar__error">{error}</span>}
        {!loading && !error && (
          <>
            {filtered.length} / {channels.length} kênh
          </>
        )}
      </div>

      {filtered.length === 0 && !loading && !error && (
        <div className="sidebar__empty">Không có kênh khớp với bộ lọc.</div>
      )}

      <ul className="channel-list">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`channel ${c.id === activeId ? 'channel--active' : ''}`}
              onClick={() => onSelect(c)}
            >
              <span className="channel__logo">
                {c.logo ? (
                  <img
                    src={c.logo}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget.style.display = 'none')
                    }}
                  />
                ) : (
                  <span className="channel__logo-fallback" aria-hidden>
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="channel__meta">
                <span className="channel__name">{c.name}</span>
                {c.groups.length > 0 && (
                  <span className="channel__groups">{c.groups.join(' · ')}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
