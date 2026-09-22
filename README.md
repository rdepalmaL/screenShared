# HuskySharedScreen

Aplicação de compartilhamento de tela usando WebRTC e WebSocket.

## Requisitos

- Node.js 18+
- npm

## Instalação

```bash
npm install
```

## Execução local

```bash
npm start
```

Depois abra:

```text
http://localhost:3000/index.html
```

## WebSocket

O backend da sinalização fica em `api/vdo.js` e usa a URL de WebSocket no mesmo host por padrão.

Se você estiver hospedando o frontend em outro domínio ou em um serviço estático, defina antes da página carregar:

```html
<script>
  window.SCREEN_SHARED_WS_URL = "wss://seu-servidor-websocket.example.com";
</script>
```

ou então rode o frontend e o WebSocket no mesmo domínio/porta.

## Deploy

Para uso real com Discord Activity e WebRTC, o ideal é:

- frontend em Vercel, Netlify ou outro host estático;
- WebSocket em Render, Railway, Fly.io ou VPS;
- HTTPS obrigatório para `getDisplayMedia()` e `wss://`.

## Observação

O `viewer.html` só exibirá o compartilhamento quando o publicador e o visualizador conseguirem negociar a oferta WebRTC via WebSocket.
