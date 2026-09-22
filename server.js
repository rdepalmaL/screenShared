import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

// Rota básica para teste
app.get("/", (req, res) => {
  res.send("Servidor HuskySharedScreen ativo!");
});

// WebSocket para sinalização
const wss = new WebSocketServer({ noServer: true });
const streams = new Map();

wss.on("connection", (ws, request) => {
  const params = new URLSearchParams(request.url.replace("/?", ""));
  const streamId = params.get("stream");

  if (!streamId) {
    ws.close();
    return;
  }

  if (!streams.has(streamId)) {
    streams.set(streamId, []);
  }
  streams.get(streamId).push(ws);

  ws.on("message", (msg) => {
    // Repassa mensagens de sinalização para todos os clientes do mesmo streamId
    streams.get(streamId).forEach(client => {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(msg);
      }
    });
  });

  ws.on("close", () => {
    const arr = streams.get(streamId) || [];
    streams.set(streamId, arr.filter(c => c !== ws));
  });
});

// Integrar WebSocket com servidor HTTP
const server = app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
