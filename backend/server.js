const { WebSocketServer } = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);
});

console.log("Yjs WebSocket server running on port 8080");
