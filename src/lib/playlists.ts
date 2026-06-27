export type PlaylistSource = {
  id: string
  label: string
  url: string
  description: string
}

const BASE = 'https://iptv-org.github.io/iptv'

export const PLAYLIST_SOURCES: PlaylistSource[] = [
  {
    id: 'vn',
    label: 'Vietnam',
    url: `${BASE}/countries/vn.m3u`,
    description: 'Kênh phát từ Việt Nam',
  },
]

export const findSource = (id: string): PlaylistSource | undefined =>
  PLAYLIST_SOURCES.find((s) => s.id === id)
