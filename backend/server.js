const { WebSocketServer } = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");
const express = require("express");
const http = require("http");

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);
});

server.listen(8080, () => {
  console.log("Server and Yjs WebSocket server running on port 8080");
});
