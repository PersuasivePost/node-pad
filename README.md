# Node-Pad

Minimal, real-time collaborative notepad. Open a room, share the link, type together and swap files — no sign-up.

**Live:** https://node-pad-psi.vercel.app · ⭐ If it's useful, [star the repo](https://github.com/persuasivePost/node-pad)!

## Features

- **Multiple notes per room** — hit **+** in the top bar; double-click (or long-press on mobile) a tab to rename it
- **Live collaboration** with coloured, named cursors (Yjs CRDTs over WebSocket)
- **Mobile-first UI** — native text editor on phones, bottom-sheet panel, safe-area aware
- **File sharing** — drag & drop anywhere, multi-file, paste screenshots, progress + cancel, image previews, copy link, remove
- Syntax highlighting per note (JS/TS, Python, Solidity, Go, Rust, SQL, Markdown…)
- Light / dark mode, word & character count, download note
- Shareable links point at the exact note (`/room/<id>#<noteId>`)
- Ephemeral by design: a room's notes and files are wiped ~60s after the last person leaves

## Tech

- **Frontend:** React 19 + Vite + TypeScript, Monaco (desktop) / textarea (mobile), Yjs, y-websocket, y-monaco
- **Backend:** Node + Express + `ws`, y-websocket server, Multer (in-memory file store, 20 MB/file)

## Run locally

```bash
# backend → http://localhost:8080
cd backend && npm install && npm run dev

# frontend → http://localhost:5173
cd frontend && npm install && npm run dev
```

Optional env vars — frontend: `VITE_API_URL`, `VITE_WS_URL`; backend: `PORT`, `EMPTY_ROOM_TTL_MS`.

## Notes

- Anyone with the room URL can join; there is no authentication.
- Files and notes live in server memory only.

## License

MIT
