# Thian Men Game Server

Cloudflare Workers + Durable Objects. One `MatchRoom` per active match.

## First-time deploy (from your own machine, once)

1. Install Node 20+ if you haven't.
2. In this folder:
   ```
   cd server
   npm install
   npx wrangler login
   npx wrangler deploy
   ```
3. `wrangler deploy` prints your worker URL, e.g. `https://thian-men-game.<subdomain>.workers.dev`.
4. If your subdomain isn't `thianman`, update `SERVER_URL` in `../src/net/cfTransport.js`.

## Redeploy after code changes

```
cd server
npx wrangler deploy
```

## Local dev

```
cd server
npx wrangler dev
```

Runs a local worker at `http://localhost:8787`. Point the client at it by
setting `VITE_GAME_SERVER_URL=http://localhost:8787` in `.env.local`.

## Endpoints

- `POST /matches` — create a room, returns `{ code: "ABC123" }`
- `GET  /ws/:code` — WebSocket upgrade, routes to the DO for that code
- `GET  /` — health check
