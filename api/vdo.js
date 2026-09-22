import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const rootDir = path.join(__dirname, "..");

// The Discord connection entry point must open the Activity itself.
app.get("/auth/discord", (_req, res) => {
  res.redirect(302, "/");
});

app.use(express.static(rootDir));
app.get("/health", (_req, res) => res.json({ ok: true }));

const wss = new WebSocketServer({ noServer: true });
const streams = new Map();

function getStream(id) {
  if (!streams.has(id)) {
    streams.set(id, {
      publisher: null,
      offer: null,
      publisherCandidates: [],
      viewers: new Set()
    });
  }
  return streams.get(id);
}

function send(ws, message) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
}

wss.on("connection", (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const streamId = url.searchParams.get("stream");
  const role = url.searchParams.get("role");

  if (!streamId || !/^husky_[0-9]{6}$/.test(streamId) || !["publisher", "viewer"].includes(role)) {
    ws.close(1008, "Invalid stream or role");
    return;
  }

  const stream = getStream(streamId);

  if (role === "publisher") {
    if (stream.publisher && stream.publisher !== ws) stream.publisher.close(1000, "Replaced publisher");
    stream.publisher = ws;
    if (stream.offer) send(ws, { offer: stream.offer });
  } else {
    stream.viewers.add(ws);
    if (stream.offer) {
      send(ws, { offer: stream.offer });
      for (const candidate of stream.publisherCandidates) send(ws, { candidate });
    }
  }

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (role === "publisher") {
        if (message.offer) stream.offer = message.offer;
        if (message.candidate) {
          stream.publisherCandidates.push(message.candidate);
          for (const viewer of stream.viewers) send(viewer, { candidate: message.candidate });
        }
        if (message.publisherStopped) {
          stream.offer = null;
          stream.publisherCandidates = [];
          for (const viewer of stream.viewers) send(viewer, { publisherStopped: true });
        }
      } else if (message.answer || message.candidate) {
        send(stream.publisher, message);
      }
    } catch (error) {
      console.error("Invalid WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    if (role === "publisher" && stream.publisher === ws) {
      stream.publisher = null;
      stream.offer = null;
      stream.publisherCandidates = [];
      for (const viewer of stream.viewers) send(viewer, { publisherStopped: true });
    }
    if (role === "viewer") stream.viewers.delete(ws);
    if (!stream.publisher && stream.viewers.size === 0) streams.delete(streamId);
  });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname !== "/api/vdo") return socket.destroy();
  wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
});
