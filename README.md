# Wynnitem-territory

Deployed at [wynnitem-territory.vercel.app](https://wynnitem-territory.vercel.app).

## Monorepo (this folder in Wynnitem-test)

From the parent repo root, push **only** this subtree to GitHub:

```bash
npm run push:territory
```

Pushes remote: `territory` → `Goodmorningqwq/Wynnitem-territory`.

To stop accidental `git push` to Wynnitem-test (local git only):

```bash
git remote set-url --push origin NO_PUSH
```

To push the full monorepo to test again:

```bash
git remote set-url --push origin https://github.com/Goodmorningqwq/Wynnitem-test.git
```

## Eco War (`war.html`) and Socket.io

[Vercel](https://vercel.com/docs/concepts/functions/serverless-functions) does **not** host long-lived WebSocket servers. The static site on `wynnitem-territory.vercel.app` cannot run the Eco War room server.

The game server is a small Node app: folder **`server/`** with **`proxy.js`** (Express + Socket.io, default port `3001`). It is **not** in this repo; copy it from your full Wynnitem monorepo or equivalent.

1. Deploy that folder to **Railway**, **Render**, **Fly.io**, a VPS, or run locally: `cd server && npm install && npm start`. On Render, you can use the monorepo file `render-eco-war.yaml` as a Blueprint (`rootDir: server`).
2. Use an **https** URL for production (e.g. `https://your-service.onrender.com`).
3. In `public/war.html`, uncomment and set:

   ```html
   <meta name="eco-war-socket-url" content="https://your-service.onrender.com">
   ```

   Or set `window.ECO_WAR_SOCKET_URL` before loading `script.js`.

On **localhost**, the client defaults to `http://127.0.0.1:3001` when the meta tag is omitted.