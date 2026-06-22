# IPTV Web

Xem TV trực tiếp trên trình duyệt, sử dụng playlist từ
[iptv-org/iptv](https://github.com/iptv-org/iptv) — bộ sưu tập ~100.000 kênh IPTV công khai.

## Tính năng

- **Nhiều nguồn playlist**: Vietnam, toàn bộ thế giới, theo thể loại (News, Sports, Movies,
  Music, Kids, Entertainment…), theo ngôn ngữ (English, v.v.).
- **Tìm kiếm + lọc** theo tên, `tvg-id`, hoặc thể loại.
- **HLS player** dùng `hls.js`, hỗ trợ stream có yêu cầu `Referer` / `User-Agent` (qua
  `http-referrer` và `http-user-agent` trong M3U).
- **Cache localStorage** — playlist được cache 6 giờ để lần sau mở tức thì.
- **Dark theme**, responsive.

## Cài đặt

```bash
npm install
```

Yêu cầu Node 18+.

## Chạy dev

```bash
npm run dev
```

Mở `http://localhost:5173/`.

## Build production

```bash
npm run build
```

Output ra thư mục `dist/`. Có thể deploy lên bất kỳ static host nào
(GitHub Pages, Netlify, Vercel, Cloudflare Pages…).

## Type-check

```bash
npx tsc --noEmit
```

## Cấu trúc

```
src/
├── App.tsx                  # Layout chính, fetch playlist, state
├── components/
│   ├── Player.tsx           # HLS player (hls.js)
│   ├── ChannelList.tsx      # Sidebar danh sách kênh + search/filter
│   └── SourcePicker.tsx     # Chọn playlist source
└── lib/
    ├── m3u.ts               # Parser M3U + EXTVLCOPT
    ├── playlists.ts         # Danh sách nguồn playlist
    └── storage.ts           # Cache localStorage
```

## Thêm nguồn playlist

Mở `src/lib/playlists.ts`, thêm phần tử vào mảng `PLAYLIST_SOURCES`:

```ts
{
  id: 'mysource',
  label: 'My Source',
  url: 'https://example.com/playlist.m3u',
  description: 'Mô tả ngắn',
}
```

## Lưu ý

- iptv-org chỉ tổng hợp link stream công khai. **Nhiều kênh có thể bị geo-block** ngoài
  quốc gia phát sóng, hoặc **chặn CORS** khi phát trực tiếp từ trình duyệt. Trong những
  trường hợp đó, player sẽ báo lỗi — không phải lỗi của app.
- Stream yêu cầu `Referer` / `User-Agent` được parser tự động nhận diện từ
  `#EXTVLCOPT:http-referrer=...` / `#EXTVLCOPT:http-user-agent=...` và áp dụng qua
  `xhrSetup` của hls.js.
- DASH (`.mpd`) chưa được hỗ trợ.

## Credit

Dữ liệu playlist: [iptv-org/iptv](https://github.com/iptv-org/iptv) — CC0.
