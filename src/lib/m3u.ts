export type Stream = {
  url: string
  name: string
  referrer: string | null
  userAgent: string | null
}

export type Channel = {
  id: string
  name: string
  logo: string | null
  groups: string[]
  tvgId: string | null
  streams: Stream[]
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

const cleanChannelName = (name: string): string => {
  let clean = name
  // Remove brackets like [Geo-blocked]
  clean = clean.replace(/\[[^\]]*\]/g, '')
  // Remove parentheses like (1080p)
  clean = clean.replace(/\([^)]*\)/g, '')
  // Remove quality tags
  clean = clean.replace(/\b(1080p|720p|540p|480p|360p|240p|hd|sd|fhd|4k)\b/gi, '')
  // Clean multiple spaces and trim
  return clean.replace(/\s+/g, ' ').trim()
}

export const getStreamLabel = (originalName: string, channelName: string, index: number): string => {
  let label = originalName.replace(channelName, '').trim()
  label = label.replace(/^[-\s,·/|]+/, '').trim()
  if (!label) {
    return `Đường truyền ${index + 1}`
  }
  return label
}

const getCanonicalKey = (name: string, tvgId: string | null): string => {
  if (tvgId) {
    const atIdx = tvgId.indexOf('@')
    const baseTvgId = atIdx >= 0 ? tvgId.slice(0, atIdx) : tvgId
    return `tvg:${baseTvgId.toLowerCase().trim()}`
  }

  // Strip quality tags and special chars to match identical channels without tvg-id
  let clean = name.toLowerCase()
  clean = clean.replace(/\[[^\]]*\]/g, '')
  clean = clean.replace(/\([^)]*\)/g, '')
  clean = clean.replace(/\b(1080p|720p|540p|480p|360p|240p|hd|sd|fhd|4k)\b/gi, '')
  clean = clean.replace(/[^\w\s\u00C0-\u1EF9]/gi, '')
  return `name:${clean.replace(/\s+/g, ' ').trim()}`
}

export const parseM3U = (text: string): Channel[] => {
  const lines = text.split(/\r?\n/)
  const channelMap = new Map<string, Channel>()
  let pending: {
    name: string
    logo: string | null
    groups: string[]
    tvgId: string | null
    referrer: string | null
    userAgent: string | null
  } | null = null
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
        name,
        logo: attrs['tvg-logo'] || null,
        groups,
        tvgId: attrs['tvg-id'] || null,
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
      const originalName = pending.name
      const cleanName = cleanChannelName(originalName) || originalName
      const key = getCanonicalKey(cleanName, pending.tvgId)

      const stream: Stream = {
        url: line,
        name: originalName,
        referrer: pending.referrer,
        userAgent: pending.userAgent,
      }

      if (channelMap.has(key)) {
        const existing = channelMap.get(key)!
        // Avoid adding exact duplicate URLs to streams list
        if (!existing.streams.some((s) => s.url === stream.url)) {
          existing.streams.push(stream)
        }
        if (!existing.logo && pending.logo) {
          existing.logo = pending.logo
        }
        for (const g of pending.groups) {
          if (!existing.groups.includes(g)) {
            existing.groups.push(g)
          }
        }
      } else {
        channelMap.set(key, {
          id: `ch-${counter++}`,
          name: cleanName,
          logo: pending.logo,
          groups: pending.groups,
          tvgId: pending.tvgId,
          streams: [stream],
        })
      }
      pending = null
    } else {
      // bare URL entry
      const key = `bare:${line}`
      if (!channelMap.has(key)) {
        channelMap.set(key, {
          id: `ch-${counter++}`,
          name: line,
          logo: null,
          groups: [],
          tvgId: null,
          streams: [{
            url: line,
            name: line,
            referrer: null,
            userAgent: null,
          }],
        })
      }
    }
  }

  return Array.from(channelMap.values())
}

export const getBaseTvgId = (tvgId: string | null): string | null => {
  if (!tvgId) return null
  const atIdx = tvgId.indexOf('@')
  return atIdx >= 0 ? tvgId.slice(0, atIdx) : tvgId
}

export type ApiStream = {
  channel: string | null
  feed: string | null
  title: string
  url: string
  quality: string | null
  label: string | null
  user_agent: string | null
  referrer: string | null
}

export const enrichChannelsWithStreams = (
  channels: Channel[],
  apiStreams: ApiStream[]
): Channel[] => {
  if (!apiStreams || apiStreams.length === 0) return channels

  const tvgIdMap = new Map<string, ApiStream[]>()
  const nameMap = new Map<string, ApiStream[]>()

  for (const s of apiStreams) {
    if (s.channel) {
      const key = s.channel.toLowerCase().trim()
      if (!tvgIdMap.has(key)) {
        tvgIdMap.set(key, [])
      }
      tvgIdMap.get(key)!.push(s)
    }
    if (s.title) {
      const key = s.title.toLowerCase().trim()
      if (!nameMap.has(key)) {
        nameMap.set(key, [])
      }
      nameMap.get(key)!.push(s)
    }
  }

  return channels.map((channel) => {
    const baseTvgId = getBaseTvgId(channel.tvgId)
    const matchingStreams = baseTvgId
      ? tvgIdMap.get(baseTvgId.toLowerCase().trim()) || []
      : nameMap.get(channel.name.toLowerCase().trim()) || []

    if (matchingStreams.length === 0) return channel

    const combinedStreams = [...channel.streams]

    for (const apiStream of matchingStreams) {
      if (!combinedStreams.some((s) => s.url === apiStream.url)) {
        let streamLabel = ''
        if (apiStream.quality) streamLabel += `(${apiStream.quality})`
        if (apiStream.label) streamLabel += ` [${apiStream.label}]`
        streamLabel = streamLabel.trim()

        combinedStreams.push({
          url: apiStream.url,
          name: streamLabel ? `${channel.name} ${streamLabel}` : `${channel.name} (Alternative)`,
          referrer: apiStream.referrer || null,
          userAgent: apiStream.user_agent || null,
        })
      }
    }

    return {
      ...channel,
      streams: combinedStreams,
    }
  })
}
