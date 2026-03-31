# Inferlog

**Open-source LLM cost & usage monitoring.** See exactly what your LLMs are costing you — without changing how you build.

Point your existing LLM client at the Inferlog proxy instead of the provider. Every call gets logged. Nothing else changes.

---

## Quick start (3 lines)

```bash
# 1. Start the proxy + dashboard
docker run -d -p 3001:3001 -p 3000:3000 inferlog/inferlog

# 2. Point your client at the proxy
base_url = "http://localhost:3001/openai/v1"   # OpenAI
# base_url = "http://localhost:3001/anthropic"  # Anthropic

# 3. Done — open http://localhost:3000 to see your usage dashboard
```

---

## Features

- **Per-model cost breakdown** — know exactly how much GPT-4o vs Claude Sonnet vs o1 cost you
- **Tag calls by feature** — group costs by `x-llm-tag` header (e.g. `production`, `staging`, `my-feature`)
- **Multi-tenancy** — isolated workspaces, per-workspace API keys
- **API key auth** — pass `x-inferlog-key` to attribute calls to your workspace
- **Latency tracking** — spot slow responses that are burning budget
- **Privacy-first** — no prompt or response content ever logged. Only metadata: model, tokens, cost, latency, tag

---

## Supported providers

| Provider | Status |
|----------|--------|
| OpenAI   | ✅ |
| Anthropic | ✅ |
| Azure OpenAI | coming soon |
| Google AI (Gemini) | coming soon |

---

## Integration

### OpenAI

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3001/openai/v1",
    api_key="sk-...",                          # your real API key
    default_headers={"x-inferlog-key": "ilg_..."}  # your Inferlog API key
)

# Tag by feature (optional)
client = OpenAI(
    base_url="http://localhost:3001/openai/v1",
    api_key="sk-...",
    default_headers={
        "x-inferlog-key": "ilg_...",
        "x-llm-tag": "checkout-flow"
    }
)
```

### Anthropic

```python
import anthropic

client = anthropic.Anthropic(
    base_url="http://localhost:3001/anthropic",
    api_key="sk-ant-...",
    headers={"x-inferlog-key": "ilg_...", "x-llm-tag": "code-review"}
)
```

### Any HTTP client

```bash
curl -X POST http://localhost:3001/openai/v1/chat/completions \
  -H "Authorization: Bearer sk-..." \
  -H "x-inferlog-key: ilg_..." \
  -H "x-llm-tag: my-feature" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]}'
```

---

## Self-hosting

Inferlog runs entirely on your infrastructure:

```bash
git clone https://github.com/nchokoev/inferlog.git
cd inferlog
cp .env.example .env   # set BETTER_AUTH_SECRET
cd docker
docker compose up --build
```

- Dashboard: `http://your-server:3000`
- Proxy: `http://your-server:3001`

### Get your free API key

Sign up at the dashboard (it's just a local account) and create workspace API keys from the Settings page.

---

## Privacy & Security

**We take privacy seriously — your prompts never leave your infrastructure.**

- **Self-hosted:** Everything runs on your servers. Zero data leaves your network. We have no access.
- **Hosted (when available):** Only metadata is logged — model name, token count, cost, latency, tag, status code. Prompt content and responses are forwarded to the LLM provider and **never stored** by us.
- **API keys:** Your real provider API keys pass through the proxy and are never persisted — only a SHA256 hash of your Inferlog API key is stored.
- **Open source:** Verify every claim in the code at [github.com/nchokoev/inferlog](https://github.com/nchokoev/inferlog)

---

## Pricing

Inferlog is free for self-hosting (MIT license).

Managed hosted service (coming soon): **€29/month** per workspace — everything hosted for you, zero infra work.

---

## Tech stack

- **Proxy:** Node.js + Fastify
- **Dashboard:** Next.js + React
- **Database:** PostgreSQL
- **Auth:** Better Auth

---

## License

MIT — free to use, modify, and distribute. See [LICENSE](LICENSE).
