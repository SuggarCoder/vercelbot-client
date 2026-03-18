# Chatbot Frontend

`chatbot` is now a pure frontend SPA built with `Vite + React + React Router`.

All business APIs go directly to `chatbot-central-server`. This repo no longer contains local auth, database, or chat backend logic.

## Requirements

- Node.js 20+
- pnpm 9+
- A running `chatbot-central-server`

## Frontend Env

The frontend now calls `VITE_CENTRAL_API_BASE_URL` directly from the browser.

If your frontend and backend are served from the same origin, you can keep the default relative base:

```bash
VITE_CENTRAL_API_BASE_URL=/api
```

If your backend is on another origin, create `.env.local` and point it to the full API origin:

```bash
touch .env.local
```

```bash
VITE_CENTRAL_API_BASE_URL=https://ai.floatcapital.com/api
```

When you use an absolute URL, the backend must already allow the browser origin via CORS.

## How To Run

1. Start the backend first.

Example:

```bash
cd /home/pi/chatbot-central-server
pnpm install
pnpm dev
```

2. Start the frontend.

```bash
cd /home/pi/chatbot
pnpm install
pnpm dev
```

3. If needed, set `VITE_CENTRAL_API_BASE_URL` before starting the frontend.

Example:

```bash
cat > .env.local <<'EOF'
VITE_CENTRAL_API_BASE_URL=http://127.0.0.1:3001/api
EOF
```

4. Open the frontend in the browser.

```text
http://127.0.0.1:3000
```

## Frontend Commands

```bash
cd /home/pi/chatbot

pnpm dev
pnpm typecheck
pnpm build
pnpm preview
pnpm test
```

## Production Preview

Build and preview locally:

```bash
cd /home/pi/chatbot
pnpm build
pnpm preview -- --host 127.0.0.1 --port 3000
```

## Notes

- Authentication is handled entirely in the browser with `accessToken` and `refreshToken` persistence.
- Chat uses SSE via `POST {VITE_CENTRAL_API_BASE_URL}/chat`.
- The frontend depends on `chatbot-central-server` for auth, models, history, chat detail, document versions, suggestions, votes, and message trailing.
