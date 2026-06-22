import { useEffect, useRef, useState } from 'react'
import videojs from 'video.js'
import type VideoJsPlayer from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'
import type { Channel } from '../lib/m3u'

type PlayerProps = {
  channel: Channel | null
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'playing' }
  | { kind: 'error'; message: string }

const isHlsUrl = (url: string): boolean => /\.m3u8(\?|$)/i.test(url)
const isDashUrl = (url: string): boolean => /\.mpd(\?|$)/i.test(url)

export const Player = ({ channel }: PlayerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<VideoJsPlayer | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  // Initialise video.js once on mount
  useEffect(() => {
    if (!containerRef.current) return

    // Create the <video> element dynamically so video.js owns it entirely
    const videoEl = document.createElement('video')
    videoEl.className = 'video-js vjs-big-play-centered'
    containerRef.current.appendChild(videoEl)
    videoElRef.current = videoEl

    const player = videojs(videoEl, {
      controls: true,
      autoplay: true,
      muted: false,
      preload: 'auto',
      fluid: false,
      fill: true,
      playsinline: true,
      html5: {
        vhs: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false,
      },
    })

    playerRef.current = player

    player.on('playing', () => setStatus({ kind: 'playing' }))
    player.on('waiting', () => setStatus({ kind: 'loading' }))
    player.on('error', () => {
      const err = player.error()
      const msg =
        err?.code === 2
          ? 'Lỗi mạng hoặc CORS. Kênh có thể chặn phát từ trình duyệt.'
          : err?.code === 3
            ? 'Lỗi giải mã media. Định dạng có thể không tương thích.'
            : err?.code === 4
              ? 'Định dạng không được hỗ trợ.'
              : 'Không phát được luồng.'
      setStatus({ kind: 'error', message: msg })
    })

    return () => {
      player.dispose()
      playerRef.current = null
      videoElRef.current = null
    }
  }, [])

  // Load a new source whenever the selected channel changes
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (!channel) {
      player.pause()
      player.src('')
      setStatus({ kind: 'idle' })
      return
    }

    const url = channel.url

    if (isDashUrl(url)) {
      setStatus({ kind: 'error', message: 'DASH (.mpd) chưa được hỗ trợ trong player này.' })
      return
    }

    setStatus({ kind: 'loading' })

    const sourceType = isHlsUrl(url) ? 'application/x-mpegURL' : 'video/mp4'

    player.src({ src: url, type: sourceType })
    player.play()?.catch(() => {
      setStatus({ kind: 'error', message: 'Trình duyệt chặn autoplay. Hãy nhấn Play.' })
    })
  }, [channel])

  return (
    <div className="player">
      <div ref={containerRef} className="player__vjs-wrapper" />

      {!channel && (
        <div className="player__placeholder">
          <p>Chọn một kênh từ danh sách bên trái để bắt đầu.</p>
        </div>
      )}
      {channel && status.kind === 'loading' && (
        <div className="player__status">Đang tải {channel.name}…</div>
      )}
      {channel && status.kind === 'error' && (
        <div className="player__status player__status--error">{status.message}</div>
      )}
    </div>
  )
}
