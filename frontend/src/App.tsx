import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { CollabEditor } from "./components/CollabEditor";
import { GitHubStar } from "./components/GitHubStar";
import { LinkIcon, MoonIcon, PaperclipIcon, ShareIcon, SunIcon, UploadIcon } from "./components/Icons";
import { PadTabs } from "./components/PadTabs";
import { SidePanel } from "./components/SidePanel";
import { DEFAULT_PAD_ID } from "./config";
import { padTextKey, useRoom, type Peer } from "./hooks/useRoom";
import { useUploads } from "./hooks/useUploads";
import { downloadText, generateId, isTouchDevice, slugify } from "./lib/utils";
import "./App.css";

const LANGUAGES: [string, string][] = [
  ["plaintext", "Plain text"],
  ["markdown", "Markdown"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["python", "Python"],
  ["java", "Java"],
  ["cpp", "C / C++"],
  ["go", "Go"],
  ["rust", "Rust"],
  ["sol", "Solidity"],
  ["json", "JSON"],
  ["html", "HTML"],
  ["css", "CSS"],
  ["sql", "SQL"],
  ["shell", "Shell"],
  ["yaml", "YAML"],
];

function usePersistentState<T extends string>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) || initial();
    } catch {
      return initial();
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, v);
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [value, set] as const;
}

function useTheme() {
  const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [theme, setTheme] = usePersistentState<"light" | "dark">("nodepad:theme", () =>
    systemDark() ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0b0b0c" : "#ffffff");
  }, [theme]);
  return [theme, setTheme] as const;
}

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 1800);
  }, []);
  return [msg, show] as const;
}

const readPadFromHash = () => decodeURIComponent(window.location.hash.slice(1)) || DEFAULT_PAD_ID;

function Notepad({ roomId }: { roomId: string }) {
  const room = useRoom(roomId);
  const { doc, provider, pads, peers, files, status, synced } = room;

  const [theme, setTheme] = useTheme();
  const [editorMode, setEditorMode] = usePersistentState<"code" | "simple">("nodepad:editor", () =>
    isTouchDevice() ? "simple" : "code",
  );
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1024);
  const [activeId, setActiveId] = useState(readPadFromHash);
  const [toast, showToast] = useToast();
  const [dragging, setDragging] = useState(false);
  const [stats, setStats] = useState({ chars: 0, words: 0 });
  const [slowServer, setSlowServer] = useState(false);

  const activePad = pads.find((p) => p.id === activeId) ?? pads[0];
  const { uploads, upload, dismiss } = useUploads(roomId, room.me.name, room.addFile);

  // Keep the active note in the URL hash so a shared link opens the same note.
  useEffect(() => {
    if (!synced) return;
    const hash = activePad.id === DEFAULT_PAD_ID ? "" : `#${encodeURIComponent(activePad.id)}`;
    if (window.location.hash !== hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search + hash);
    }
  }, [activePad.id, synced]);

  // Word / character count for the active note
  useEffect(() => {
    if (!doc) return;
    const text = doc.getText(padTextKey(activePad.id));
    const update = () => {
      const s = text.toString();
      setStats({ chars: s.length, words: s.trim() ? s.trim().split(/\s+/).length : 0 });
    };
    update();
    text.observe(update);
    return () => text.unobserve(update);
  }, [doc, activePad.id]);

  // Free-tier backends cold-start slowly; tell people instead of looking broken.
  useEffect(() => {
    if (status === "connected") return setSlowServer(false);
    const t = window.setTimeout(() => setSlowServer(true), 3500);
    return () => window.clearTimeout(t);
  }, [status]);

  // Drag files anywhere onto the page
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) {
        upload(e.dataTransfer.files);
        setPanelOpen(true);
      }
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [upload]);

  // Paste a file / screenshot to share it
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const list = e.clipboardData?.files;
      if (!list?.length) return;
      e.preventDefault();
      upload(list);
      setPanelOpen(true);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [upload]);

  const canNativeShare = typeof navigator.share === "function" && isTouchDevice();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied — send it to anyone");
    } catch {
      showToast("Couldn't copy, copy the URL from the address bar");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: "Node-Pad", text: "Join my Node-Pad room", url: window.location.href });
    } catch {
      /* user cancelled */
    }
  };

  const addPad = () => {
    const id = room.addPad();
    if (id) setActiveId(id);
  };

  const closePad = (id: string) => {
    if (!doc) return;
    const pad = pads.find((p) => p.id === id);
    const hasText = doc.getText(padTextKey(id)).length > 0;
    if (hasText && !window.confirm(`Delete "${pad?.name}" for everyone in this room?`)) return;
    if (id === activePad.id) {
      const idx = pads.findIndex((p) => p.id === id);
      setActiveId((pads[idx + 1] ?? pads[idx - 1]).id);
    }
    room.deletePad(id);
  };

  const clearRoom = async () => {
    if (!window.confirm("Clear all notes and files in this room for everyone?")) return;
    await room.clearRoom();
    setActiveId(DEFAULT_PAD_ID);
    showToast("Room cleared");
  };

  const downloadPad = () => {
    if (!doc) return;
    const ext = activePad.lang && activePad.lang !== "plaintext" ? ({ markdown: "md", javascript: "js", typescript: "ts", python: "py", rust: "rs", shell: "sh", sol: "sol" } as Record<string, string>)[activePad.lang] ?? activePad.lang : "txt";
    downloadText(`${slugify(activePad.name)}.${ext}`, doc.getText(padTextKey(activePad.id)).toString());
  };

  const statusLabel =
    status === "connected" ? (synced ? "Live" : "Syncing…") : status === "connecting" ? "Connecting…" : "Offline";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            N
          </span>
          <span className="brand-name">Node-Pad</span>
        </div>

        <PadTabs
          pads={pads}
          activeId={activePad.id}
          onSelect={setActiveId}
          onAdd={addPad}
          onRename={(id, name) => room.updatePad(id, { name })}
          onClose={closePad}
        />

        <div className="top-actions">
          <AvatarStack peers={peers} />
          <button
            className="btn primary"
            onClick={canNativeShare ? nativeShare : copyLink}
            aria-label="Share room link"
          >
            {canNativeShare ? <ShareIcon size={14} /> : <LinkIcon size={14} />}
            <span className="hide-sm">Share</span>
          </button>
          <GitHubStar />
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title="Toggle theme"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            className={`icon-btn files-toggle ${panelOpen ? "on" : ""}`}
            onClick={() => setPanelOpen((o) => !o)}
            aria-label="Files and people"
            aria-expanded={panelOpen}
            title="Files & people"
          >
            <PaperclipIcon />
            {files.length > 0 && <span className="badge">{files.length}</span>}
          </button>
        </div>
      </header>

      {slowServer && status !== "connected" && (
        <div className="banner" role="status">
          <span className="spinner" /> Waking up the server — free-tier cold starts can take ~30–60s. You can start typing.
        </div>
      )}

      <div className="workspace">
        <main className="editor-area">
          {doc && provider ? (
            <CollabEditor
              doc={doc}
              awareness={provider.awareness}
              padId={activePad.id}
              lang={activePad.lang ?? "plaintext"}
              mode={editorMode}
              dark={theme === "dark"}
              peers={peers}
            />
          ) : (
            <div className="editor-loading">Connecting…</div>
          )}
        </main>

        <aside className={`panel ${panelOpen ? "open" : ""}`} aria-label="Room panel">
          <SidePanel
            roomId={roomId}
            peers={peers}
            files={files}
            uploads={uploads}
            onUpload={upload}
            onDismissUpload={dismiss}
            onRemoveFile={room.removeFile}
            onCopyLink={copyLink}
            onShare={canNativeShare ? nativeShare : undefined}
            onClearRoom={clearRoom}
            editorMode={editorMode}
            onEditorMode={setEditorMode}
            onClose={() => setPanelOpen(false)}
            toast={showToast}
          />
        </aside>
        {panelOpen && <div className="backdrop" onClick={() => setPanelOpen(false)} />}
      </div>

      <footer className="statusbar">
        <span className={`conn ${status}`} title={`Server: ${status}`}>
          <i className="dot" /> {statusLabel}
          <span className="hide-sm"> · {peers.length} online</span>
        </span>
        <span className="spacer" />
        <span className="stats">
          {stats.words.toLocaleString()} words<span className="hide-sm"> · {stats.chars.toLocaleString()} chars</span>
        </span>
        {editorMode === "code" && (
          <select
            className="lang"
            value={activePad.lang ?? "plaintext"}
            onChange={(e) => room.updatePad(activePad.id, { lang: e.target.value })}
            aria-label="Syntax highlighting"
          >
            {LANGUAGES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
        <button className="link-btn" onClick={downloadPad} title="Download this note">
          Download
        </button>
      </footer>

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-card">
            <UploadIcon size={28} />
            <strong>Drop to share with the room</strong>
            <span>Up to 20 MB per file</span>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function AvatarStack({ peers }: { peers: Peer[] }) {
  const shown = peers.slice(0, 4);
  return (
    <div className="avatar-stack" title={peers.map((p) => p.name + (p.isMe ? " (you)" : "")).join(", ")}>
      {shown.map((p) => (
        <span key={p.clientId} className="avatar sm" style={{ background: p.color }}>
          {p.name.charAt(0)}
        </span>
      ))}
      {peers.length > shown.length && <span className="avatar sm more">+{peers.length - shown.length}</span>}
    </div>
  );
}

function RoomRoute() {
  const { roomId } = useParams<{ roomId: string }>();
  if (!roomId) return <Navigate to="/" replace />;
  return <Notepad key={roomId} roomId={roomId} />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/room/:roomId" element={<RoomRoute />} />
        <Route path="*" element={<Navigate to={`/room/${generateId(6)}`} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
