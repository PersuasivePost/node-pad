const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const API_BASE: string =
  import.meta.env.VITE_API_URL ??
  (isLocal ? "http://localhost:8080" : "https://node-pad-1.onrender.com");

export const WS_URL: string =
  import.meta.env.VITE_WS_URL ?? API_BASE.replace(/^http/, "ws");

export const GITHUB_OWNER = "persuasivePost";
export const GITHUB_REPO = "node-pad";
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // must match backend

/** Id of the first pad. Kept as "monaco" so rooms created before multi-pad still load. */
export const DEFAULT_PAD_ID = "monaco";

export const fileUrl = (roomId: string, fileId: string, inline = false) =>
  `${API_BASE}/file/${encodeURIComponent(roomId)}/${encodeURIComponent(fileId)}${inline ? "?inline=1" : ""}`;
