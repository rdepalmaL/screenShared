import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const rootDir = path.join(__dirname, "..");

app.use(express.static(rootDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

const wss = new WebSocketServer({ noServer: true });
const streams = new Map();

function getStream(streamId) {
  if (!streams.has(streamId)) {
    streams.set(streamId, { clients: new Set(), offer: null });
  }
  return streams.get(streamId);
}

wss.on("connection", (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const streamId = url.searchParams.get("stream");

  if (!streamId || !/^husky_[0-9]{6}$/.test(streamId)) {
    ws.close(1008, "Invalid stream ID");
    return;
  }

  const stream = getStream(streamId);
  stream.clients.add(ws);

  // A viewer that joins later receives the current offer and can answer it.
  if (stream.offer && stream.offer.type === "offer") {
    ws.send(JSON.stringify({ offer: stream.offer }));
  }

  ws.on("message", (rawMessage) => {
    try {
      const message = JSON.parse(rawMessage.toString());

      if (message.offer?.type === "offer") {
        stream.offer = message.offer;
      }

      for (const client of stream.clients) {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(message));
        }
      }
    } catch (error) {
      console.error("Mensagem WebSocket inválida:", error);
    }
  });

  ws.on("close", () => {
    stream.clients.delete(ws);
    if (stream.clients.size === 0) {
      streams.delete(streamId);
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname !== "/api/vdo") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
