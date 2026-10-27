const { WebSocketServer } = require("ws");
const { setupWSConnection, docs } = require("y-websocket/bin/utils");
const express = require("express");
const http = require("http");
const multer = require("multer");
const crypto = require("crypto");
const cors = require("cors");

const PORT = process.env.PORT || 8080;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
// How long an empty room is kept alive before its notes and files are wiped.
// A short grace period lets people refresh / switch apps on mobile without losing work.
const EMPTY_ROOM_TTL_MS = Number(process.env.EMPTY_ROOM_TTL_MS || 60_000);

const app = express();
app.use(cors({ exposedHeaders: ["Content-Disposition"] }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** key: `${roomId}::${fileId}` */
const fileStore = new Map();
/** roomId -> pending cleanup timer */
const cleanupTimers = new Map();

function getRoomIdFromReq(req) {
  // Must match y-websocket's own doc naming: req.url.slice(1).split('?')[0]
  return (req.url || "").slice(1).split("?")[0];
}

function clearRoomFiles(roomId) {
  for (const key of fileStore.keys()) {
    if (key.startsWith(`${roomId}::`)) fileStore.delete(key);
  }
}

function destroyRoom(roomId) {
  clearRoomFiles(roomId);
  const doc = docs.get(roomId);
  if (doc && doc.conns.size === 0) {
    docs.delete(roomId);
    doc.destroy();
  }
}

function scheduleCleanup(roomId) {
  clearTimeout(cleanupTimers.get(roomId));
  cleanupTimers.set(
    roomId,
    setTimeout(() => {
      cleanupTimers.delete(roomId);
      const doc = docs.get(roomId);
      if (!doc || doc.conns.size === 0) destroyRoom(roomId);
    }, EMPTY_ROOM_TTL_MS),
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: docs.size, files: fileStore.size });
});

app.post("/upload/:roomId", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { roomId } = req.params;
  const fileId = crypto.randomUUID();

  // multer decodes multipart filenames as latin1; recover UTF-8 names (e.g. Hindi, emoji).
  const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

  const fileData = {
    buffer: req.file.buffer,
    originalName,
    mimeType: req.file.mimetype || "application/octet-stream",
    size: req.file.size,
    uploadedAt: Date.now(),
  };
  fileStore.set(`${roomId}::${fileId}`, fileData);

  res.json({
    fileId,
    originalName: fileData.originalName,
    mimeType: fileData.mimeType,
    size: fileData.size,
  });
});

app.get("/file/:roomId/:fileId", (req, res) => {
  const { roomId, fileId } = req.params;
  const fileData = fileStore.get(`${roomId}::${fileId}`);
  if (!fileData) return res.status(404).json({ error: "File not found" });

  // ?inline=1 lets the client show image/PDF previews instead of forcing a download
  if (req.query.inline === "1") {
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(fileData.originalName)}`,
    );
  } else {
    res.attachment(fileData.originalName); // handles non-ASCII filenames correctly
  }
  res.setHeader("Content-Type", fileData.mimeType);
  res.setHeader("Content-Length", fileData.size);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(fileData.buffer);
});

app.delete("/file/:roomId/:fileId", (req, res) => {
  const { roomId, fileId } = req.params;
  const deleted = fileStore.delete(`${roomId}::${fileId}`);
  res.json({ deleted });
});

app.delete("/room/:roomId", (req, res) => {
  clearRoomFiles(req.params.roomId);
  res.json({ cleared: true });
});

// Error handler (must be after routes)
app.use((err, _req, res, _next) => {
  if (err && err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(413)
        .json({ error: "File too large", maxSizeBytes: MAX_FILE_SIZE });
    }
    return res.status(400).json({ error: err.message, code: err.code });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal Server Error" });
});

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);

  const roomId = getRoomIdFromReq(req);
  if (!roomId) return;

  // Someone (re)joined: cancel any pending wipe.
  clearTimeout(cleanupTimers.get(roomId));
  cleanupTimers.delete(roomId);

  ws.on("close", () => {
    const doc = docs.get(roomId);
    if (!doc || doc.conns.size === 0) scheduleCleanup(roomId);
  });
});

server.listen(PORT, () => {
  console.log(`Server and Yjs WebSocket server running on port ${PORT}`);
});
