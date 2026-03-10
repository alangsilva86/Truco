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
- `TRUCO_ALLOWED_ORIGINS`: lista separada por virgula das origens HTTP aceitas pelo backend. Suporta curingas como `https://*.vercel.app`
- `VITE_SERVER_HTTP_URL`: sobrescreve a origem HTTP usada pelo cliente para lookup de sala e endpoints auxiliares. Em dev local pode ficar vazio para usar o proxy.
- `VITE_SERVER_WS_URL`: sobrescreve a origem websocket do Colyseus. Em dev local, o cliente usa `ws://<host-atual>:2567`.

Se você for apontar o frontend para um servidor remoto, defina `VITE_SERVER_HTTP_URL` e `VITE_SERVER_WS_URL`.

## Scripts

- `npm run dev`: sobe server e web em paralelo
- `npm run dev:proxy`: alias de `npm run dev`
- `npm run dev:server`: sobe apenas o servidor
- `npm run dev:web`: sobe apenas o frontend
- `npm run build:web`: gera apenas o bundle do frontend
- `npm run lint`: valida TypeScript em todos os workspaces
- `npm test`: roda unitários da engine e integração do room
- `npm run build`: gera build do servidor e do frontend
- `npm run clean`: remove artefatos de build e cobertura

## Deploy no Vercel

O projeto do Vercel deve publicar apenas `apps/web`. O repositório já inclui [vercel.json](/Users/momentum1/Documents/GitHub/Truco/vercel.json) para isso:

- `buildCommand`: `npm run build:web`
- `outputDirectory`: `apps/web/dist`

Importante: o backend realtime em Colyseus nao deve rodar no Vercel. O frontend pode ficar no Vercel, mas o servidor precisa ficar em outra infra stateful e expor:

- `VITE_SERVER_HTTP_URL`
- `VITE_SERVER_WS_URL`

Sem essas variaveis em Preview/Production, o frontend sobe, mas nao consegue criar/entrar em salas.

## Deploy do backend no Render

O backend realtime deve subir como `Web Service` no Render. O repositório já inclui [render.yaml](/Users/momentum1/Documents/GitHub/Truco/render.yaml) com a configuracao base:

- `runtime`: `node`
- `buildCommand`: `npm ci && npm run build:server`
- `startCommand`: `npm run start:server`
- `healthCheckPath`: `/health`
- `plan`: `starter`
- `region`: `oregon`
- `REDIS_URI`: configurado como secret/env var no serviço

Se voce configurar manualmente pelo painel, use estes valores:

- `Root Directory`: vazio
- `Build Command`: `npm ci && npm run build:server`
- `Start Command`: `npm run start:server`
- `Health Check Path`: `/health`
- `REDIS_URI`: URL de um Redis compartilhado

O servidor usa a porta de `process.env.PORT` automaticamente via `@colyseus/tools`, entao nao e necessario fixar uma porta manualmente no Render.

Para producao realtime, use uma instancia always-on. O plano `free` do Render pode dormir/reiniciar o processo e perder o cache de salas ativas, quebrando reconexao e entrada por codigo.

Se `REDIS_URI` estiver definido, o Colyseus passa a usar Redis shared presence/driver para room cache e matchmaking. Sem `REDIS_URI`, o ambiente local continua usando driver/presence em memoria.

Render recomenda fixar a versao do Node para evitar mudancas no runtime. O repositório inclui [.node-version](/Users/momentum1/Documents/GitHub/Truco/.node-version) com `22.22.0`.

Depois do backend subir, configure no Vercel:

- `VITE_SERVER_HTTP_URL=https://SEU-SERVICO.onrender.com`
- `VITE_SERVER_WS_URL=wss://SEU-SERVICO.onrender.com`

## Validação rápida

```bash
npm run lint
npm test
npm run build
```
