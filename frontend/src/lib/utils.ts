const ANIMALS = [
  "Elephant", "Tiger", "Lion", "Giraffe", "Zebra", "Panda", "Koala", "Kangaroo",
  "Monkey", "Bear", "Wolf", "Fox", "Rabbit", "Deer", "Horse", "Owl", "Eagle",
  "Hawk", "Falcon", "Sparrow", "Robin", "Finch", "Parrot", "Macaw", "Toucan",
  "Flamingo", "Swan", "Pelican", "Heron", "Crane", "Otter", "Lynx", "Bison",
  "Yak", "Gecko", "Orca", "Puffin", "Hedgehog", "Badger", "Raccoon",
];

// Distinct, readable on both light and dark backgrounds
const COLORS = [
  "#e5484d", "#f76b15", "#ffb224", "#46a758", "#12a594", "#0090ff",
  "#3e63dd", "#8e4ec6", "#d6409f", "#978365",
];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function generateId(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export type Identity = { name: string; color: string };

/** Same animal across refreshes in this tab, so peers don't see you "change". */
export function getIdentity(): Identity {
  try {
    const saved = sessionStorage.getItem("nodepad:me");
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  const me = { name: pick(ANIMALS), color: pick(COLORS) };
  try {
    sessionStorage.setItem("nodepad:me", JSON.stringify(me));
  } catch {
    /* ignore */
  }
  return me;
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function timeAgo(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function fileExt(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1, dot + 5).toUpperCase() : "FILE";
}

export function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export function slugify(name: string) {
  return name.trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").toLowerCase() || "note";
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
