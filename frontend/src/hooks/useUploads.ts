import { useCallback, useRef, useState } from "react";
import { API_BASE, MAX_FILE_SIZE } from "../config";
import { formatBytes, generateId } from "../lib/utils";
import type { SharedFile } from "./useRoom";

export type Upload = {
  id: string;
  name: string;
  size: number;
  percent: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

export function useUploads(
  roomId: string,
  uploaderName: string,
  onUploaded: (f: SharedFile) => void,
) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const xhrs = useRef(new Map<string, XMLHttpRequest>());

  const patch = (id: string, p: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...p } : u)));

  const dismiss = useCallback((id: string) => {
    xhrs.current.get(id)?.abort();
    xhrs.current.delete(id);
    setUploads((list) => list.filter((u) => u.id !== id));
  }, []);

  const uploadOne = useCallback(
    (file: File) => {
      const id = generateId(8);
      const base: Upload = { id, name: file.name, size: file.size, percent: 0, status: "uploading" };

      if (file.size > MAX_FILE_SIZE) {
        setUploads((l) => [
          ...l,
          { ...base, status: "error", error: `Too large — max ${formatBytes(MAX_FILE_SIZE)}` },
        ]);
        setTimeout(() => dismiss(id), 5000);
        return;
      }

      setUploads((l) => [...l, base]);

      const form = new FormData();
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      xhrs.current.set(id, xhr);
      xhr.open("POST", `${API_BASE}/upload/${encodeURIComponent(roomId)}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) patch(id, { percent: Math.round((e.loaded / e.total) * 100) });
      };
      xhr.onload = () => {
        xhrs.current.delete(id);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            onUploaded({ ...data, uploadedAt: Date.now(), uploadedBy: uploaderName });
            patch(id, { status: "done", percent: 100 });
            setTimeout(() => dismiss(id), 1200);
            return;
          } catch {
            /* fall through */
          }
        }
        const msg =
          xhr.status === 413 ? "Too large for the server" : `Upload failed (${xhr.status || "network"})`;
        patch(id, { status: "error", error: msg });
      };
      xhr.onerror = () => {
        xhrs.current.delete(id);
        patch(id, { status: "error", error: "Network error — is the server awake?" });
      };
      xhr.send(form);
    },
    [roomId, uploaderName, onUploaded, dismiss],
  );

  const upload = useCallback(
    (list: FileList | File[]) => Array.from(list).forEach(uploadOne),
    [uploadOne],
  );

  return { uploads, upload, dismiss };
}
