import { Pool } from "pg";
import { createHash } from "crypto";
import { calculateCost } from "./pricing";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface CallData {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  tag: string | null;
  statusCode: number;
  workspaceId: string | null;
}

export async function lookupApiKey(key: string): Promise<string | null> {
  const hash = createHash("sha256").update(key).digest("hex");
  const { rows } = await pool.query<{ id: string; workspace_id: string }>(
    `SELECT id, workspace_id FROM api_keys
     WHERE key_hash = $1 AND revoked_at IS NULL
     LIMIT 1`,
    [hash],
  );
  if (rows.length === 0) return null;
  // Fire-and-forget last_used_at update
  pool
    .query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [rows[0].id])
    .catch(() => {});
  return rows[0].workspace_id;
}

export async function logCall(data: CallData): Promise<void> {
  const { provider, model, inputTokens, outputTokens, latencyMs, tag, statusCode, workspaceId } = data;

  const costUsd =
    inputTokens !== null && outputTokens !== null
      ? calculateCost(model, inputTokens, outputTokens)
      : null;

  await pool.query(
    `INSERT INTO calls
       (provider, model, input_tokens, output_tokens, cost_usd, latency_ms, tag, status_code, workspace_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [provider, model, inputTokens, outputTokens, costUsd, latencyMs, tag, statusCode, workspaceId],
  );
}
