const { WebSocketServer } = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");
const express = require("express");
const http = require("http");
const multer = require("multer");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

const fileStore = new Map();
const roomClientCounts = new Map();

function getRoomIdFromReq(req) {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    return decodeURIComponent(pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

function getRoomFiles(roomId) {
  const result = [];
  for (const [key, value] of fileStore.entries()) {
    if (key.startsWith(`${roomId}::`)) {
      const { buffer, ...metadata } = value;
      const fileId = key.split("::")[1];
      result.push({ fileId, ...metadata });
    }
  }
  return result;
}

function clearRoomFiles(roomId) {
  for (const key of fileStore.keys()) {
    if (key.startsWith(`${roomId}::`)) {
      fileStore.delete(key);
    }
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

app.post("/upload/:roomId", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { roomId } = req.params;
  const fileId = crypto.randomUUID();
  const key = `${roomId}::${fileId}`;

  const fileData = {
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedAt: Date.now(),
  };

  fileStore.set(key, fileData);

  res.json({
    fileId,
    originalName: fileData.originalName,
    mimeType: fileData.mimeType,
    size: fileData.size,
  });
});

app.get("/file/:roomId/:fileId", (req, res) => {
  const { roomId, fileId } = req.params;
  const key = `${roomId}::${fileId}`;

  const fileData = fileStore.get(key);
  if (!fileData) {
    return res.status(404).json({ error: "File not found" });
  }

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileData.originalName}"`,
  );
  res.setHeader("Content-Type", fileData.mimeType);
  res.send(fileData.buffer);
});

app.delete("/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  clearRoomFiles(roomId);
  res.json({ cleared: true });
});

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);

  const roomId = getRoomIdFromReq(req);
  if (roomId) {
    roomClientCounts.set(roomId, (roomClientCounts.get(roomId) || 0) + 1);

    ws.on("close", () => {
      const next = (roomClientCounts.get(roomId) || 1) - 1;
      if (next <= 0) {
        roomClientCounts.delete(roomId);
        clearRoomFiles(roomId);
      } else {
        roomClientCounts.set(roomId, next);
      }
    });
  }
});

server.listen(8080, () => {
  console.log("Server and Yjs WebSocket server running on port 8080");
});
