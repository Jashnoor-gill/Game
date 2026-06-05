Docker (single-container) quick start
-----------------------------------
Build and run locally (requires Docker):
```bash
docker build -t bhabhi-game .
docker run -p 3000:3000 -p 3001:3001 -e NEXT_PUBLIC_API_URL=http://localhost:3001 -e NODE_ENV=production bhabhi-game
```

Or with docker-compose (includes Redis):

```bash
docker-compose up --build
```

Note: For production multi-instance scaling prefer separate services (Vercel + Render) with a managed Redis instance.
# Bhabhi — Real-time prototype

This repository contains a minimal Next.js frontend and a small Express + Socket.IO server to prototype a real-time implementation of the card game "Bhabhi".

Quick start (Windows):

1. Install dependencies

```bash
npm install
```

2. Run in development (starts Next on :3000 and server on :3001)

```bash
npm run dev
```

3. Open `http://localhost:3000` in your browser. Create a room and open it in another tab to emulate multiplayer.

Notes:
- This is a minimal prototype: game rules and logic are intentionally simple and in-memory.
- For production: persist rooms, secure room access, and add matchmaking, tests, and scalability.

Production notes & deployment (Vercel frontend + Render backend)
------------------------------------------------------------

1) Backend (Render)
- Create a new Web Service on Render and connect your `Jashnoor-gill/Game` repo.
- Set the build command: `npm install --production` and the start command: `node server/index.js`.
- Add environment variables:
	- `REDIS_URL` (recommended) — a Redis instance URL if you plan to scale horizontally.
	- `NODE_ENV=production`
- Deploy. Render will assign a public URL like `https://your-backend.onrender.com`.

2) Redis (optional but recommended for scaling)
- Provision a managed Redis (Render Redis, Upstash, Redis Cloud). Copy the Redis URL and set it as `REDIS_URL` in Render.
- The server uses the Socket.IO Redis adapter when `REDIS_URL` is set, enabling multiple backend instances to share socket rooms/state.

3) Frontend (Vercel)
- Import the same GitHub repo into Vercel.
- Set an environment variable in Vercel: `NEXT_PUBLIC_API_URL` to your backend URL from Render (include `https://`).
- Deploy; Vercel will build the Next.js app and serve it. The client uses `NEXT_PUBLIC_API_URL` to connect to the Socket.IO backend.

4) Additional production checklist
- Use a persistent DB (Postgres) or Redis for room/game state to survive restarts.
- Configure CORS to allow your Vercel domain.
- Add TLS/HTTPS (Render/Vercel handle this automatically).
- Add health checks, logging, and monitoring. Use Redis adapter as above.

Local testing after deployment
- Point `NEXT_PUBLIC_API_URL` to your Render backend and open the Vercel app URL in multiple tabs.

