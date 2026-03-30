import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { Readable, Transform } from "stream";
import { logCall, lookupApiKey } from "./db";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = parseInt(process.env.PORT ?? "3001", 10);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  bodyLimit: 10 * 1024 * 1024, // 10 MB – for vision requests
});

type Provider = "openai" | "anthropic";

const UPSTREAM: Record<Provider, string> = {
  openai:    "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
};

// Headers that must not be copied verbatim to/from upstream
const SKIP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
]);

function pickHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SKIP_HEADERS.has(k.toLowerCase()) || v === undefined) continue;
    out[k] = Array.isArray(v) ? v.join(", ") : v;
  }
  return out;
}

// ── streaming response handler ──────────────────────────────────────────────

function streamWithUsage(
  reply: FastifyReply,
  upstream: Response,
  provider: Provider,
  model: string,
  startTime: number,
  tag: string | null,
  workspaceId: string | null,
): void {
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let resolvedModel = model;
  let sseBuffer = "";

  const transform = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      sseBuffer += chunk.toString("utf8");
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;
        try {
          const evt = JSON.parse(raw) as Record<string, unknown>;

          // OpenAI: usage arrives in the last chunk when stream_options.include_usage=true
          if (evt.usage && typeof (evt.usage as Record<string, unknown>).prompt_tokens === "number") {
            const u = evt.usage as { prompt_tokens: number; completion_tokens: number };
            inputTokens  = u.prompt_tokens;
            outputTokens = u.completion_tokens;
          }
          if (typeof evt.model === "string") resolvedModel = evt.model;

          // Anthropic: message_start carries input token count
          if (
            evt.type === "message_start" &&
            evt.message &&
            typeof (evt.message as Record<string, unknown>) === "object"
          ) {
            const msg = evt.message as Record<string, unknown>;
            const u = msg.usage as Record<string, number> | undefined;
            if (u) inputTokens = u.input_tokens ?? null;
            if (typeof msg.model === "string") resolvedModel = msg.model;
          }

          // Anthropic: message_delta carries output token count
          if (
            evt.type === "message_delta" &&
            evt.usage &&
            typeof (evt.usage as Record<string, unknown>).output_tokens === "number"
          ) {
            outputTokens = (evt.usage as { output_tokens: number }).output_tokens;
          }
        } catch {
          // non-JSON SSE line – ignore
        }
      }

      this.push(chunk);
      cb();
    },
    flush(cb) {
      if (sseBuffer) this.push(Buffer.from(sseBuffer));
      cb();
    },
  });

  transform.on("finish", () => {
    const latencyMs = Date.now() - startTime;
    logCall({
      provider,
      model: resolvedModel,
      inputTokens,
      outputTokens,
      latencyMs,
      tag,
      statusCode: upstream.status,
      workspaceId,
    }).catch((err: unknown) => app.log.error(err, "logCall failed"));
  });

  // Remove content-length (stream has no fixed size)
  reply.removeHeader("content-length");

  const nodeStream = Readable.fromWeb(
    upstream.body as Parameters<typeof Readable.fromWeb>[0],
  );
  nodeStream.pipe(transform);
  void reply.send(transform);
}

// ── core proxy logic ─────────────────────────────────────────────────────────

async function proxy(
  request: FastifyRequest,
  reply: FastifyReply,
  provider: Provider,
  upstreamPath: string,
): Promise<void> {
  const tag = (request.headers["x-llm-tag"] as string | undefined) ?? null;
  const monitorKey = (request.headers["x-inferlog-key"] as string | undefined) ?? null;
  const startTime = Date.now();

  // Resolve workspace from monitor key (if provided)
  let workspaceId: string | null = null;
  if (monitorKey) {
    workspaceId = await lookupApiKey(monitorKey).catch(() => null);
  }

  // Determine whether this is a completion/messages endpoint worth logging
  const isCompletionEndpoint =
    (provider === "openai"    && upstreamPath.includes("chat/completions")) ||
    (provider === "anthropic" && upstreamPath.includes("messages"));

  let body = request.body as Record<string, unknown> | null | undefined;
  const isStreaming = body?.stream === true;

  // Ask OpenAI to include token usage in the stream
  if (provider === "openai" && isStreaming && body) {
    body = { ...body, stream_options: { include_usage: true } };
  }

  const targetUrl = `${UPSTREAM[provider]}/${upstreamPath}`;
  const forwardHeaders = pickHeaders(request.headers as Record<string, string | string[] | undefined>);

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: {
        ...forwardHeaders,
        ...(body != null ? { "content-type": "application/json" } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    app.log.error(err, "upstream fetch error");
    void reply.status(502).send({ error: "Bad gateway" });
    return;
  }

  // Copy upstream response headers (minus hop-by-hop)
  upstream.headers.forEach((value, key) => {
    if (!SKIP_HEADERS.has(key.toLowerCase())) {
      reply.header(key, value);
    }
  });
  reply.status(upstream.status);

  if (!isCompletionEndpoint || !upstream.body) {
    // Simple pass-through – no usage logging needed
    const buf = await upstream.arrayBuffer();
    void reply.send(Buffer.from(buf));
    return;
  }

  const model = (body?.model as string | undefined) ?? "unknown";
  const contentType = upstream.headers.get("content-type") ?? "";

  if (isStreaming || contentType.includes("text/event-stream")) {
    streamWithUsage(reply, upstream, provider, model, startTime, tag, workspaceId);
  } else {
    // Non-streaming completion
    const data = (await upstream.json()) as Record<string, unknown>;
    const resolvedModel = (data.model as string | undefined) ?? model;

    let inputTokens: number | null  = null;
    let outputTokens: number | null = null;
    const u = data.usage as Record<string, number> | undefined;
    if (u) {
      // OpenAI
      if (typeof u.prompt_tokens === "number") {
        inputTokens  = u.prompt_tokens;
        outputTokens = u.completion_tokens;
      }
      // Anthropic
      if (typeof u.input_tokens === "number") {
        inputTokens  = u.input_tokens;
        outputTokens = u.output_tokens;
      }
    }

    logCall({
      provider,
      model: resolvedModel,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      tag,
      statusCode: upstream.status,
      workspaceId,
    }).catch((err: unknown) => app.log.error(err, "logCall failed"));

    void reply.send(data);
  }
}

// ── routes ───────────────────────────────────────────────────────────────────

app.all("/openai/*", async (req: FastifyRequest, reply: FastifyReply) => {
  const path = (req.params as { "*": string })["*"];
  await proxy(req, reply, "openai", path);
});

app.all("/anthropic/*", async (req: FastifyRequest, reply: FastifyReply) => {
  const path = (req.params as { "*": string })["*"];
  await proxy(req, reply, "anthropic", path);
});

app.get("/health", async () => ({ status: "ok" }));

// ── boot ─────────────────────────────────────────────────────────────────────

app.listen({ host: HOST, port: PORT }, (err, address) => {
  if (err) { app.log.error(err); process.exit(1); }
  app.log.info(`inferlog proxy listening at ${address}`);
  app.log.info("Route OpenAI  →  <proxy>/openai/v1/...");
  app.log.info("Route Anthropic → <proxy>/anthropic/v1/...");
});
