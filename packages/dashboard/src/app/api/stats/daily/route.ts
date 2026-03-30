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

  const { rows } = await pool.query<{ date: string; total_cost: string; call_count: string }>(
    `SELECT
       DATE(timestamp)::text           AS date,
       COALESCE(SUM(cost_usd), 0)::text AS total_cost,
       COUNT(*)::text                  AS call_count
     FROM calls
     WHERE timestamp >= NOW() - INTERVAL '30 days'
       AND workspace_id = $1
     GROUP BY DATE(timestamp)
     ORDER BY date ASC`,
    [workspaceId],
  );

  return NextResponse.json(rows);
}
