# Node-Pad

Minimal, real‑time collaborative notepad powered by Yjs and Monaco.

## Features

- Peer‑to‑peer sync with Yjs + y‑webrtc (no server required by default)
- Monaco Editor for a fast, code‑like editing experience
- Shareable rooms: a unique 6‑character room ID in the URL
- Minimal black & white sidebar with room ID and “copy link”, collapsible

## Tech

- Frontend: React + Vite + TypeScript
- Collaboration: Yjs, y‑webrtc, y‑monaco
- Optional (alternative): y‑websocket server (not needed for default WebRTC mode)

#

- Anyone with the room URL can join; there is no authentication.
- WebRTC relies on public signaling servers; strict networks may block discovery.

<!--

## License

MIT -->
