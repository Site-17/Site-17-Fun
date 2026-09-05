# Site-17 Backend — Real Authentication

Real backend so `handleLogin` is **not** client-side. All auth runs on the server with `bcrypt` + `JWT`.

## Quick start (local)

```bash
cd backend
npm install
cp .env.example .env   # edit JWT_SECRET!
npm start              # http://localhost:3000
```

Frontend expects `http://localhost:3000` — open `index.html` via `http://localhost:3000` (serve it) or keep `file://` but set `API_BASE` in `index.html` to `http://localhost:3000`.

## Deploy (permanent link)

- **Render / Railway / Fly.io**: `npm start` , set `PORT` and `JWT_SECRET` env.
- **Vercel**: not ideal for file JSON — use `Vercel + Supabase` or keep `data/*.json` on persistent disk.
- After deploy, set `API_BASE` in `index.html` to `https://your-backend.onrender.com`

## API

- `POST /api/login {username,password}` → `{token,user}`
- `GET /api/scp` → list (auth)
- `POST /api/scp` → create (director)
- `PUT /api/scp/:id` → update (director)
- `DELETE /api/scp/:id` → delete (director)
- `GET /api/users` → list (director)
- `POST /api/users` → create (director) `{username,password,role,clearance,rank}`
- `GET /api/chat` / `POST /api/chat {text}` → staff chat (auth)
- `GET /health` → ok

All `Authorization: Bearer <token>` except `/api/login` and `/health`.

Data is persisted as JSON in `backend/data/*.json` — survives logout/login forever (and across devices when deployed). Commit `data/*.json` to GitHub if you want it versioned.

Default director: `director / Keter-7-Blackbox`
