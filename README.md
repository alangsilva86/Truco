# Truco Platform

Monorepo do Truco online 1v1 em dupla, com servidor autoritativo em Colyseus, engine compartilhada e cliente React.

## Estrutura

```text
apps/
  server/   servidor realtime, salas e endpoints auxiliares
  web/      lobby, mesa e cliente Colyseus
packages/
  contracts/ tipos, comandos, eventos e projeções compartilhadas
  engine/    regras puras, determinísticas e testáveis
```

## Requisitos

- Node.js 20+
- npm 10+

## Subir localmente

1. Instale dependências:

   ```bash
   npm install
   ```

2. Opcionalmente copie o arquivo de ambiente:

   ```bash
   cp .env.example .env
   ```

3. Suba web e server juntos:

   ```bash
   npm run dev
   ```

4. Abra a aplicação em `http://localhost:3000`.

## Endereços locais

- Web: `http://localhost:3000`
- Server Colyseus/HTTP: `http://127.0.0.1:2567`
- Health check: `http://localhost:3000/health`
- Version: `http://localhost:3000/version`
- Lookup de sala: `http://localhost:3000/api/rooms/:roomCode`
- Monitor do Colyseus: `http://localhost:3000/monitor`
- Playground do Colyseus em dev: `http://127.0.0.1:2567/`

O `apps/web` usa proxy do Vite para `/api`, `/health`, `/version` e `/monitor`, então o fluxo local não precisa configurar a origem HTTP manualmente.

## Variáveis de ambiente

Todas as variáveis são lidas a partir do root do monorepo.

- `TRUCO_PROXY_TARGET`: alvo do proxy HTTP do Vite em desenvolvimento. Default: `http://127.0.0.1:2567`
- `VITE_SERVER_HTTP_URL`: sobrescreve a origem HTTP usada pelo cliente para lookup de sala e endpoints auxiliares. Em dev local pode ficar vazio para usar o proxy.
- `VITE_SERVER_WS_URL`: sobrescreve a origem websocket do Colyseus. Em dev local, o cliente usa `ws://<host-atual>:2567`.

Se você for apontar o frontend para um servidor remoto, defina `VITE_SERVER_HTTP_URL` e `VITE_SERVER_WS_URL`.

## Scripts

- `npm run dev`: sobe server e web em paralelo
- `npm run dev:proxy`: alias de `npm run dev`
- `npm run dev:server`: sobe apenas o servidor
- `npm run dev:web`: sobe apenas o frontend
- `npm run lint`: valida TypeScript em todos os workspaces
- `npm test`: roda unitários da engine e integração do room
- `npm run build`: gera build do servidor e do frontend
- `npm run clean`: remove artefatos de build e cobertura

## Validação rápida

```bash
npm run lint
npm test
npm run build
```
