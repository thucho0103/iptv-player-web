import { createPlayer } from '@videojs/react'
import { MinimalLiveVideoSkin, liveVideoFeatures } from '@videojs/react/live-video'
import { HlsVideo } from '@videojs/react/media/hls-video'
import '@videojs/react/live-video/minimal-skin.css'
import type { Channel } from '../lib/m3u'

type PlayerProps = {
  channel: Channel | null
}

const PlayerInstance = createPlayer({ features: liveVideoFeatures })
const LiveSkin = MinimalLiveVideoSkin as any

export const Player = ({ channel }: PlayerProps) => {
  if (!channel) {
    return (
      <div className="player">
        <div className="player__placeholder">
          <p>Chọn một kênh từ danh sách bên trái để bắt đầu.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="player">
      <div className="player__vjs-wrapper">
        <PlayerInstance.Provider>
          <LiveSkin poster={channel.logo || undefined}>
            <HlsVideo src={channel.url} playsInline autoPlay />
          </LiveSkin>
        </PlayerInstance.Provider>
      </div>
    </div>
  )
}
