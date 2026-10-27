import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { API_BASE, DEFAULT_PAD_ID, WS_URL, fileUrl } from "../config";
import { generateId, getIdentity, type Identity } from "../lib/utils";

export type PadMeta = { name: string; createdAt: number; lang?: string };
export type Pad = PadMeta & { id: string };

export type SharedFile = {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
  uploadedBy?: string;
};

export type Peer = { clientId: number; name: string; color: string; isMe: boolean };
export type ConnStatus = "connecting" | "connected" | "disconnected";

const DEFAULT_PAD: Pad = { id: DEFAULT_PAD_ID, name: "Note 1", createdAt: 0 };

/** Each pad's text lives in its own Y.Text. The first pad keeps the legacy "monaco" key. */
export const padTextKey = (padId: string) =>
  padId === DEFAULT_PAD_ID ? "monaco" : `pad:${padId}`;

export function useRoom(roomId: string) {
  const me: Identity = useMemo(() => getIdentity(), []);

  const [conn, setConn] = useState<{ doc: Y.Doc; provider: WebsocketProvider } | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [pads, setPads] = useState<Pad[]>([DEFAULT_PAD]);
  const [files, setFiles] = useState<SharedFile[]>([]);

  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(WS_URL, roomId, doc);
    const awareness = provider.awareness;
    awareness.setLocalStateField("user", me);

    const padsMap = doc.getMap<PadMeta>("pads");
    const filesArr = doc.getArray<SharedFile>("files");

    const readPads = () => {
      const list: Pad[] = [];
      padsMap.forEach((meta, id) => list.push({ id, ...meta }));
      list.sort((a, b) => a.createdAt - b.createdAt);
      setPads(list.length ? list : [DEFAULT_PAD]);
    };
    const readFiles = () => setFiles(filesArr.toArray());
    const readPeers = () => {
      const list: Peer[] = [];
      awareness.getStates().forEach((state, clientId) => {
        const u = state.user as Identity | undefined;
        if (u) list.push({ clientId, ...u, isMe: clientId === doc.clientID });
      });
      list.sort((a, b) => Number(b.isMe) - Number(a.isMe));
      setPeers(list);
    };

    // Drop file entries the server no longer has (server restarted / room expired).
    // Only 404s are removed — a flaky network must not wipe the list.
    const pruneMissingFiles = async () => {
      const items = filesArr.toArray();
      const missing = new Set<string>();
      await Promise.all(
        items.map(async (f) => {
          try {
            const r = await fetch(fileUrl(roomId, f.fileId), { method: "HEAD" });
            if (r.status === 404) missing.add(f.fileId);
          } catch {
            /* keep it */
          }
        }),
      );
      if (!missing.size) return;
      doc.transact(() => {
        const arr = filesArr.toArray();
        for (let i = arr.length - 1; i >= 0; i--) {
          if (missing.has(arr[i].fileId)) filesArr.delete(i, 1);
        }
      });
    };

    const onStatus = ({ status }: { status: ConnStatus }) => setStatus(status);
    const onSync = (isSynced: boolean) => {
      setSynced(isSynced);
      if (isSynced) void pruneMissingFiles();
    };

    padsMap.observe(readPads);
    filesArr.observe(readFiles);
    awareness.on("change", readPeers);
    provider.on("status", onStatus);
    provider.on("sync", onSync);

    readPads();
    readFiles();
    readPeers();
    setConn({ doc, provider });

    return () => {
      padsMap.unobserve(readPads);
      filesArr.unobserve(readFiles);
      awareness.off("change", readPeers);
      provider.off("status", onStatus);
      provider.off("sync", onSync);
      provider.destroy();
      doc.destroy();
      setConn(null);
      setSynced(false);
      setStatus("connecting");
    };
  }, [roomId, me]);

  const doc = conn?.doc ?? null;
  const provider = conn?.provider ?? null;

  /** The default pad is "virtual" until the map has entries; write it before the first edit. */
  const materializeDefault = useCallback((d: Y.Doc) => {
    const map = d.getMap<PadMeta>("pads");
    if (map.size === 0) {
      map.set(DEFAULT_PAD.id, { name: DEFAULT_PAD.name, createdAt: Date.now() - 1 });
    }
  }, []);

  const addPad = useCallback(() => {
    if (!doc) return null;
    const id = generateId(8);
    doc.transact(() => {
      materializeDefault(doc);
      const map = doc.getMap<PadMeta>("pads");
      const n = map.size + 1;
      map.set(id, { name: `Note ${n}`, createdAt: Date.now() });
    });
    return id;
  }, [doc, materializeDefault]);

  const updatePad = useCallback(
    (id: string, patch: Partial<PadMeta>) => {
      if (!doc) return;
      doc.transact(() => {
        materializeDefault(doc);
        const map = doc.getMap<PadMeta>("pads");
        const cur = map.get(id);
        if (cur) map.set(id, { ...cur, ...patch });
      });
    },
    [doc, materializeDefault],
  );

  const deletePad = useCallback(
    (id: string) => {
      if (!doc) return;
      doc.transact(() => {
        materializeDefault(doc);
        const map = doc.getMap<PadMeta>("pads");
        if (map.size <= 1) return;
        map.delete(id);
        const text = doc.getText(padTextKey(id));
        if (text.length) text.delete(0, text.length);
      });
    },
    [doc, materializeDefault],
  );

  const addFile = useCallback(
    (file: SharedFile) => doc?.getArray<SharedFile>("files").push([file]),
    [doc],
  );

  const removeFile = useCallback(
    async (fileId: string) => {
      if (!doc) return;
      try {
        await fetch(fileUrl(roomId, fileId), { method: "DELETE" });
      } catch {
        /* still remove locally */
      }
      const arr = doc.getArray<SharedFile>("files");
      const idx = arr.toArray().findIndex((f) => f.fileId === fileId);
      if (idx >= 0) arr.delete(idx, 1);
    },
    [doc, roomId],
  );

  const clearRoom = useCallback(async () => {
    if (!doc) return;
    try {
      await fetch(`${API_BASE}/room/${encodeURIComponent(roomId)}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    doc.transact(() => {
      const map = doc.getMap<PadMeta>("pads");
      const ids = new Set([DEFAULT_PAD.id, ...map.keys()]);
      ids.forEach((id) => {
        const t = doc.getText(padTextKey(id));
        if (t.length) t.delete(0, t.length);
      });
      map.clear();
      const filesArr = doc.getArray<SharedFile>("files");
      filesArr.delete(0, filesArr.length);
    });
  }, [doc, roomId]);

  return {
    me,
    doc,
    provider,
    status,
    synced,
    peers,
    pads,
    files,
    addPad,
    updatePad,
    deletePad,
    addFile,
    removeFile,
    clearRoom,
  };
}

export type Room = ReturnType<typeof useRoom>;
