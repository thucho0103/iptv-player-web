import { createPlayer } from '@videojs/react'
import { MinimalLiveVideoSkin, liveVideoFeatures } from '@videojs/react/live-video'
import { HlsVideo } from '@videojs/react/media/hls-video'
import '@videojs/react/live-video/minimal-skin.css'
import type { Channel } from '../lib/m3u'

type PlayerProps = {
  channel: Channel | null
  activeStreamIndex: number
}

const PlayerInstance = createPlayer({ features: liveVideoFeatures })
const LiveSkin = MinimalLiveVideoSkin as any

export const Player = ({ channel, activeStreamIndex }: PlayerProps) => {
  if (!channel) {
    return (
      <div className="player">
        <div className="player__placeholder">
          <p>Chọn một kênh từ danh sách bên trái để bắt đầu.</p>
        </div>
      </div>
    )
  }

  const activeStream = channel.streams[activeStreamIndex] || channel.streams[0]

  return (
    <div className="player">
      <div className="player__vjs-wrapper">
        {activeStream ? (
          <PlayerInstance.Provider key={activeStream.url}>
            <LiveSkin poster={channel.logo || undefined}>
              <HlsVideo src={activeStream.url} playsInline autoPlay />
            </LiveSkin>
          </PlayerInstance.Provider>
        ) : (
          <div className="player__placeholder">
            <p>Không có đường truyền khả dụng cho kênh này.</p>
          </div>
        )}
      </div>
    </div>
  )
}
