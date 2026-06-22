import { PLAYLIST_SOURCES, type PlaylistSource } from '../lib/playlists'

type SourcePickerProps = {
  activeId: string
  onChange: (source: PlaylistSource) => void
}

export const SourcePicker = ({ activeId, onChange }: SourcePickerProps) => (
  <div className="source-picker">
    <label htmlFor="source" className="source-picker__label">
      Nguồn:
    </label>
    <select
      id="source"
      className="source-picker__select"
      value={activeId}
      onChange={(e) => {
        const next = PLAYLIST_SOURCES.find((s) => s.id === e.target.value)
        if (next) onChange(next)
      }}
    >
      {PLAYLIST_SOURCES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  </div>
)
