export type Channel = {
  id: string
  name: string
  logo: string | null
  groups: string[]
  tvgId: string | null
  url: string
  referrer: string | null
  userAgent: string | null
}

const ATTR_RE = /([a-zA-Z-]+)="([^"]*)"/g

const parseAttributes = (line: string): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const match of line.matchAll(ATTR_RE)) {
    out[match[1]] = match[2]
  }
  return out
}

const stripPrefix = (line: string, prefix: string): string =>
  line.startsWith(prefix) ? line.slice(prefix.length).trim() : ''

export const parseM3U = (text: string): Channel[] => {
  const lines = text.split(/\r?\n/)
  const channels: Channel[] = []
  let pending: Partial<Channel> | null = null
  let counter = 0

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('#EXTM3U')) continue

    if (line.startsWith('#EXTINF')) {
      const attrs = parseAttributes(line)
      const commaIdx = line.lastIndexOf(',')
      const name = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : ''
      const groups = attrs['group-title']
        ? attrs['group-title'].split(';').map((g) => g.trim()).filter(Boolean)
        : []
      pending = {
        id: `ch-${counter++}`,
        name,
        logo: attrs['tvg-logo'] || null,
        groups,
        tvgId: attrs['tvg-id'] || null,
        url: '',
        referrer: attrs['http-referrer'] || null,
        userAgent: attrs['http-user-agent'] || null,
      }
      continue
    }

    if (line.startsWith('#EXTVLCOPT:')) {
      const body = stripPrefix(line, '#EXTVLCOPT:')
      const eq = body.indexOf('=')
      if (eq < 0 || !pending) continue
      const key = body.slice(0, eq).trim()
      const value = body.slice(eq + 1).trim()
      if (key === 'http-referrer' && !pending.referrer) pending.referrer = value
      if (key === 'http-user-agent' && !pending.userAgent) pending.userAgent = value
      continue
    }

    if (line.startsWith('#')) continue

    if (pending) {
      pending.url = line
      channels.push(pending as Channel)
      pending = null
    } else {
      // bare URL entry, no #EXTINF header
      channels.push({
        id: `ch-${counter++}`,
        name: line,
        logo: null,
        groups: [],
        tvgId: null,
        url: line,
        referrer: null,
        userAgent: null,
      })
    }
  }

  return channels
}
