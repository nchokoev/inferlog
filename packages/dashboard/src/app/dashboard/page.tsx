import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import pool from "@/lib/db";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

async function ensureWorkspace(userId: string, email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM workspaces WHERE owner_user_id = $1 LIMIT 1`,
    [userId],
  );
  if (rows.length > 0) return rows[0].id;

  const { rows: created } = await pool.query<{ id: string }>(
    `INSERT INTO workspaces (name, owner_user_id)
     VALUES ($1, $2)
     RETURNING id`,
    [email, userId],
  );
  return created[0].id;
}

async function getDailyStats(workspaceId: string) {
  const { rows } = await pool.query<{ date: string; total_cost: string; call_count: string }>(
    `SELECT
       DATE(timestamp)::text            AS date,
       COALESCE(SUM(cost_usd), 0)::text AS total_cost,
       COUNT(*)::text                   AS call_count
     FROM calls
     WHERE timestamp >= NOW() - INTERVAL '30 days'
       AND workspace_id = $1
     GROUP BY DATE(timestamp)
     ORDER BY date ASC`,
    [workspaceId],
  );
  return rows;
}

async function getCalls(workspaceId: string) {
  const { rows } = await pool.query(
    `SELECT id, provider, model, input_tokens, output_tokens,
            ROUND(cost_usd::numeric, 6)::text AS cost_usd,
            latency_ms, timestamp, tag, status_code
     FROM calls
     WHERE workspace_id = $1
     ORDER BY timestamp DESC
     LIMIT 100`,
    [workspaceId],
  );
  return rows;
}

async function getApiKeys(workspaceId: string) {
  const { rows } = await pool.query<{
    id: string;
    key_prefix: string;
    name: string;
    created_at: string;
    last_used_at: string | null;
  }>(
    `SELECT id, key_prefix, name, created_at, last_used_at
     FROM api_keys
     WHERE workspace_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows;
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const workspaceId = await ensureWorkspace(session.user.id, session.user.email);

  const [dailyStats, calls, apiKeys] = await Promise.all([
    getDailyStats(workspaceId),
    getCalls(workspaceId),
    getApiKeys(workspaceId),
  ]);

  return (
    <DashboardClient
      user={{ name: session.user.name, email: session.user.email }}
      workspaceId={workspaceId}
      dailyStats={dailyStats}
      calls={calls}
      initialApiKeys={apiKeys}
    />
  );
}
