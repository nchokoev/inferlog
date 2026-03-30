import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { auth } from "@/lib/auth";
import pool from "@/lib/db";

async function getWorkspaceId(userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM workspaces WHERE owner_user_id = $1 LIMIT 1`,
    [userId],
  );
  return rows[0]?.id ?? null;
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = await getWorkspaceId(session.user.id);
  if (!workspaceId) return NextResponse.json([]);

  const { rows } = await pool.query(
    `SELECT id, key_prefix, name, created_at, last_used_at
     FROM api_keys
     WHERE workspace_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = await getWorkspaceId(session.user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const body = await request.json() as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Generate key: lm_ + 32 random alphanumeric chars
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(32);
  const random = Array.from(bytes).map((b) => chars[b % chars.length]).join("");
  const key = `lm_${random}`;

  const keyPrefix = key.slice(0, 8);
  const keyHash = createHash("sha256").update(key).digest("hex");

  const { rows } = await pool.query<{ id: string; created_at: string }>(
    `INSERT INTO api_keys (workspace_id, key_hash, key_prefix, name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [workspaceId, keyHash, keyPrefix, name],
  );

  return NextResponse.json({
    id: rows[0].id,
    key,          // shown once — never stored
    key_prefix: keyPrefix,
    name,
    created_at: rows[0].created_at,
    last_used_at: null,
  });
}
