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
  {
    id: 'all',
    label: 'All Channels',
    url: `${BASE}/index.m3u`,
    description: 'Toàn bộ kênh trên thế giới (~hơn 100k)',
  },
  {
    id: 'news',
    label: 'News',
    url: `${BASE}/categories/news.m3u`,
    description: 'Kênh tin tức',
  },
  {
    id: 'sports',
    label: 'Sports',
    url: `${BASE}/categories/sports.m3u`,
    description: 'Kênh thể thao',
  },
  {
    id: 'movies',
    label: 'Movies',
    url: `${BASE}/categories/movies.m3u`,
    description: 'Kênh phim',
  },
  {
    id: 'music',
    label: 'Music',
    url: `${BASE}/categories/music.m3u`,
    description: 'Kênh âm nhạc',
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    url: `${BASE}/categories/entertainment.m3u`,
    description: 'Kênh giải trí',
  },
  {
    id: 'kids',
    label: 'Kids',
    url: `${BASE}/categories/kids.m3u`,
    description: 'Kênh thiếu nhi',
  },
  {
    id: 'english',
    label: 'English',
    url: `${BASE}/languages/eng.m3u`,
    description: 'Kênh tiếng Anh',
  },
]

export const findSource = (id: string): PlaylistSource | undefined =>
  PLAYLIST_SOURCES.find((s) => s.id === id)
