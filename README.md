# Truco Platform

Monorepo do Truco online com frontend React/Vite, backend autoritativo em Colyseus, engine compartilhada e contratos TypeScript compartilhados.

## Estado atual do produto

Esta fase entrega deploy em producao, lobby com area do usuario, usuario convidado persistido, criacao/listagem/entrada em salas, escolha entre `rodada unica` e `melhor de 3`, alem de reconnect basico.

Importante: a runtime de jogo atual continua suportando `2` usuarios humanos por sala, cada um controlando uma dupla. A modelagem de persistencia ja deixa o projeto preparado para evoluir depois para fluxos com `4` usuarios humanos sem reescrever a base agora.

## Estrutura

```text
apps/
  server/   servidor realtime, salas, API HTTP e persistencia
  web/      lobby, area do usuario, sala e cliente Colyseus
packages/
  contracts/ tipos, DTOs, comandos e eventos compartilhados
  engine/    regras puras, deterministicas e testaveis
```

## Requisitos

- Node.js 20+
- npm 10+
- Postgres para usuario/sala/participantes
- Redis opcional em dev e recomendado em producao

## Subir localmente

1. Instale dependencias:

   ```bash
   npm install
   ```

2. Copie o ambiente:

   ```bash
   cp .env.example .env
   ```

3. Gere o Prisma Client:

   ```bash
   npm run db:generate -w @truco/server
   ```

4. Se quiser testar a camada completa de lobby/persistencia, configure `DATABASE_URL` e rode a migration:

   ```bash
   npm run db:dev -w @truco/server
   ```

5. Suba web e server:

   ```bash
   npm run dev
   ```

6. Abra `http://localhost:3000`.

## Enderecos locais

- Web: `http://localhost:3000`
- Server HTTP/WebSocket: `http://127.0.0.1:2567`
- Health: `http://127.0.0.1:2567/health`
- Version: `http://127.0.0.1:2567/version`
- Monitor do Colyseus: `http://127.0.0.1:2567/monitor`

Em desenvolvimento, o frontend usa o proxy do Vite para `/api`, `/health`, `/version` e `/monitor`.

## Variaveis de ambiente

Todas as variaveis sao lidas a partir da raiz do monorepo.

### Backend

- `TRUCO_ALLOWED_ORIGINS`: origens HTTP aceitas pelo backend
- `PUBLIC_SERVER_URL`: URL publica do backend em producao
- `PUBLIC_WEB_URL`: URL publica do frontend em producao
- `DATABASE_URL`: conexao Postgres usada pelo Prisma
- `REDIS_URI`: conexao Redis para presence/room directory
- `RECONNECT_WINDOW_SECONDS`: janela de reconnect do Colyseus. Default `60`
- `LOG_LEVEL`: `info`, `warn` ou `error`

### Frontend

- `VITE_SERVER_HTTP_URL`: origem HTTP do backend
- `VITE_SERVER_WS_URL`: origem WebSocket/WSS do backend
- `VITE_CLIENT_RECONNECT_BUDGET_MS`: budget total de recovery no cliente. Default `55000`

### Railway

- `APP_RUNTIME`: `server` no servico de API/realtime, `web` no servico do frontend

## API HTTP

Endpoints principais:

- `GET /health`
- `GET /version`
- `POST /api/users/guest`
- `GET /api/users/:userId`
- `GET /api/users/:userId/rooms`
- `GET /api/rooms`
- `POST /api/rooms`
- `GET /api/rooms/:roomCode`
- `POST /api/rooms/:roomCode/join`

Ao criar uma sala com `POST /api/rooms`, o payload aceita `matchFormat` com os valores `single` ou `best_of_3`.

## Scripts

- `npm run dev`: sobe web + server em paralelo
- `npm run dev:server`: sobe apenas o backend
- `npm run dev:web`: sobe apenas o frontend
- `npm run build`: build completo
- `npm run build:server`: build do backend
- `npm run build:web`: build do frontend
- `npm run start:server`: sobe o backend compilado
- `npm run start:web`: serve o frontend compilado
- `npm run railway:predeploy`: roda migration no servico backend antes do deploy
- `npm test`: testes unitarios e de integracao
- `npm run lint`: tipagem + eslint

## Railway

O repositorio inclui [railway.toml](./railway.toml), que faz o seguinte em cada deploy:

- build compartilhado com `npm run build`
- pre-deploy com `npm run railway:predeploy`
- healthcheck em `/health`
- restart policy `ON_FAILURE`

Como os dois servicos compartilham o mesmo monorepo, o comando `npm start` escolhe o processo correto pelo valor de `APP_RUNTIME`.

### 1. Criar projeto e servicos

```bash
railway init -n Truco
railway add --service truco-server
railway add --service truco-web
railway add --database postgres
railway add --database redis
```

### 2. Gerar dominios publicos

```bash
railway domain -s truco-server
railway domain -s truco-web
```

### 3. Configurar variaveis do backend

```bash
railway variable set -s truco-server \
  APP_RUNTIME=server \
  DATABASE_URL='${{Postgres.DATABASE_URL}}' \
  REDIS_URI='${{Redis.REDIS_URL}}' \
  PUBLIC_SERVER_URL='https://${{truco-server.RAILWAY_PUBLIC_DOMAIN}}' \
  PUBLIC_WEB_URL='https://${{truco-web.RAILWAY_PUBLIC_DOMAIN}}' \
  TRUCO_ALLOWED_ORIGINS='https://${{truco-web.RAILWAY_PUBLIC_DOMAIN}}' \
  RECONNECT_WINDOW_SECONDS=60 \
  LOG_LEVEL=info
```

### 4. Configurar variaveis do frontend

```bash
railway variable set -s truco-web \
  APP_RUNTIME=web \
  VITE_SERVER_HTTP_URL='https://${{truco-server.RAILWAY_PUBLIC_DOMAIN}}' \
  VITE_SERVER_WS_URL='wss://${{truco-server.RAILWAY_PUBLIC_DOMAIN}}' \
  VITE_CLIENT_RECONNECT_BUDGET_MS=55000
```

### 5. Fazer deploy

```bash
railway up --service truco-server
railway up --service truco-web
```

### 6. Verificacao rapida

```bash
curl https://SEU_BACKEND.up.railway.app/health
curl https://SEU_BACKEND.up.railway.app/version
```

Depois valide no navegador:

1. Abrir o frontend.
2. Criar usuario convidado.
3. Criar sala.
4. Copiar o link da sala.
5. Abrir o link em aba anonima.
6. Entrar com outro nickname.
7. Atualizar as duas abas para validar reconnect.

## Validacao local

```bash
npm run lint
npm test
npm run build
```
