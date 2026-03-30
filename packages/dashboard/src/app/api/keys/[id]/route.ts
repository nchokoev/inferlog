import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import pool from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the key belongs to the user's workspace before revoking
  const { rowCount } = await pool.query(
    `UPDATE api_keys
     SET revoked_at = NOW()
     WHERE id = $1
       AND workspace_id IN (
         SELECT id FROM workspaces WHERE owner_user_id = $2
       )
       AND revoked_at IS NULL`,
    [params.id, session.user.id],
  );

  if (!rowCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
