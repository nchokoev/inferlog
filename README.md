# Inferlog

LLM inference cost & usage monitoring — transparent proxy + dashboard.

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env: set BETTER_AUTH_SECRET to a random 32+ char string

cd docker
docker compose up --build
```

- Proxy:     http://localhost:3001
- Dashboard: http://localhost:3000

## Usage

Point your LLM client at the proxy instead of the provider:

**OpenAI**
```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:3001/openai/v1", api_key="sk-...")
```

**Anthropic**
```python
import anthropic
client = anthropic.Anthropic(base_url="http://localhost:3001/anthropic", api_key="sk-ant-...")
```

**Tag calls** for grouping by passing `x-llm-tag` header:
```python
client = OpenAI(
    base_url="http://localhost:3001/openai/v1",
    api_key="sk-...",
    default_headers={"x-llm-tag": "my-feature"},
)
```

**Authenticate requests** using an Inferlog API key via `x-inferlog-key` header:
```python
client = OpenAI(
    base_url="http://localhost:3001/openai/v1",
    api_key="sk-...",
    default_headers={"x-inferlog-key": "ilg-..."},
)
```

## Development

```bash
# Install deps
pnpm install

# Start postgres (or use docker compose up postgres)
docker compose -f docker/docker-compose.yml up postgres -d

# Copy and fill env
cp .env.example .env

# Run migrations
psql $DATABASE_URL -f db/migrations/001_initial.sql

# Start proxy + dashboard in separate terminals
pnpm dev:proxy
pnpm dev:dashboard
```

## Pricing (per 1M tokens, input/output)

| Model              | Input   | Output  |
|--------------------|---------|---------|
| gpt-4o             | $2.50   | $10.00  |
| gpt-4o-mini        | $0.15   | $0.60   |
| gpt-4-turbo        | $10.00  | $30.00  |
| o1                 | $15.00  | $60.00  |
| claude-3-5-sonnet  | $3.00   | $15.00  |
| claude-3-5-haiku   | $0.80   | $4.00   |
| claude-3-opus      | $15.00  | $75.00  |
| claude-sonnet-4    | $3.00   | $15.00  |

Versioned model names (e.g. `gpt-4o-2024-08-06`) are matched by prefix.
