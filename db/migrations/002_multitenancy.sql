-- Multi-tenancy: workspaces and API keys

CREATE TABLE IF NOT EXISTS workspaces (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          VARCHAR(255)    NOT NULL,
  owner_user_id TEXT            NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT            NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_hash     VARCHAR(64)     NOT NULL,
  key_prefix   VARCHAR(8)      NOT NULL,
  name         VARCHAR(255)    NOT NULL,
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash);

-- Add workspace_id to calls (nullable — existing rows unattributed)
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id);

CREATE INDEX IF NOT EXISTS calls_workspace_idx ON calls (workspace_id);
