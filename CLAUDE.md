# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Inferlog is a monorepo (pnpm workspaces) with two packages:
- `packages/proxy` — Fastify HTTP proxy that intercepts OpenAI/Anthropic API calls, extracts token/cost data, and logs to PostgreSQL (port 3001)
- `packages/dashboard` — Next.js 14 App Router dashboard with Better Auth, showing usage analytics (port 3000)

Shared PostgreSQL database stores both auth tables (managed by Better Auth) and the `calls` table for call logs.

## Commands

```bash
# Install dependencies
pnpm install

# Development (three separate terminals)
docker compose -f docker/docker-compose.yml up postgres -d
pnpm dev:proxy       # runs ts-node-dev on packages/proxy
pnpm dev:dashboard   # runs next dev on packages/dashboard

# First-time DB setup
psql $DATABASE_URL -f db/migrations/001_initial.sql

# Build all packages
pnpm build

# Production (Docker)
cp .env.example .env   # set BETTER_AUTH_SECRET to 32+ char random string
cd docker && docker compose up --build
```

There are no test commands — the project currently has no test suite.

## Proxy Architecture (`packages/proxy/src/`)

- **`index.ts`** — Fastify server. Routes `/openai/*` → `https://api.openai.com` and `/anthropic/*` → `https://api.anthropic.com`. For completion endpoints (`/chat/completions`, `/messages`), intercepts the response to extract token counts before forwarding to the client. Streaming responses are handled via a Transform stream that parses SSE events; non-streaming responses are buffered and parsed as JSON. Injects `stream_options: { include_usage: true }` for OpenAI streams automatically.
- **`pricing.ts`** — Static pricing table (8 models). Matches model names by prefix. Returns `null` for unknown models (cost stored as null).
- **`db.ts`** — Singleton `pg.Pool`. Exports `logCall()` which inserts one row per completion call.

### Call Tagging
Clients can send `x-llm-tag: <string>` in request headers; the proxy extracts this and stores it in `calls.tag`.

## Dashboard Architecture (`packages/dashboard/src/`)

- **`middleware.ts`** — Protects `/dashboard/*` (redirects to `/login`) and redirects authenticated users away from `/login`.
- **`app/dashboard/page.tsx`** — Server component. Reads session, queries PostgreSQL directly for 30-day daily stats and last 100 calls, passes data to `<DashboardClient />`.
- **`app/api/calls/route.ts`** — Returns last 100 calls as JSON (session-gated).
- **`app/api/stats/daily/route.ts`** — Returns 30-day daily aggregated stats (session-gated).
- **`app/api/auth/[...all]/route.ts`** — Better Auth catch-all handler.
- **`lib/auth.ts`** / **`lib/auth-client.ts`** — Better Auth server/client configuration.
- **`lib/db.ts`** — Singleton `pg.Pool` (separate instance from proxy).

### Dashboard data flow
Dashboard page is a server component that queries PostgreSQL directly — it does **not** call the `/api/*` routes. The API routes exist for potential client-side refresh use.

## Database Schema

Single migration at `db/migrations/001_initial.sql`. Key table:

```sql
calls (
  id, provider, model,
  input_tokens, output_tokens,
  cost_usd DECIMAL(14,8),
  latency_ms, timestamp, tag, status_code
)
```

Better Auth manages its own tables (`user`, `session`, `account`, `verification`).

## Environment Variables

```
DATABASE_URL=postgresql://llmmonitor:llmmonitor@localhost:5432/llmmonitor
PORT=3001
BETTER_AUTH_SECRET=<32+ char secret>
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
