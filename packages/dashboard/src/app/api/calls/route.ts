import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows: wsRows } = await pool.query<{ id: string }>(
    `SELECT id FROM workspaces WHERE owner_user_id = $1 LIMIT 1`,
    [session.user.id],
  );
  if (wsRows.length === 0) return NextResponse.json([]);
  const workspaceId = wsRows[0].id;

  const { rows } = await pool.query<{
    id: string;
    provider: string;
    model: string;
    input_tokens: number | null;
    output_tokens: number | null;
    cost_usd: string | null;
    latency_ms: number | null;
    timestamp: string;
    tag: string | null;
    status_code: number | null;
  }>(
    `SELECT id, provider, model, input_tokens, output_tokens,
            ROUND(cost_usd::numeric, 6)::text AS cost_usd,
            latency_ms, timestamp, tag, status_code
     FROM calls
     WHERE workspace_id = $1
     ORDER BY timestamp DESC
     LIMIT 100`,
    [workspaceId],
  );

  return NextResponse.json(rows);
}
