const CACHE_PREFIX = 'iptv-playlist:'
const CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6 hours

type Cached<T> = {
  ts: number
  data: T
}

export const loadCached = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cached<T>
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

export const saveCached = <T>(key: string, data: T): void => {
  try {
    const payload: Cached<T> = { ts: Date.now(), data }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload))
  } catch {
    // quota exceeded; ignore
  }
}

export const clearCachedPlaylists = (): void => {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
}

export const fetchPlaylist = async (
  url: string,
  cacheKey: string,
  signal?: AbortSignal,
): Promise<string> => {
  const cached = loadCached<string>(cacheKey)
  if (cached) return cached

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải ${url}`)
  const text = await res.text()
  saveCached(cacheKey, text)
  return text
}
