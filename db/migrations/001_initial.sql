-- Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
  "id"            TEXT PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "email"         TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image"         TEXT,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"          TEXT PRIMARY KEY,
  "expiresAt"   TIMESTAMP NOT NULL,
  "token"       TEXT NOT NULL UNIQUE,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "userId"      TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id"                     TEXT PRIMARY KEY,
  "accountId"              TEXT NOT NULL,
  "providerId"             TEXT NOT NULL,
  "userId"                 TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken"            TEXT,
  "refreshToken"           TEXT,
  "idToken"                TEXT,
  "accessTokenExpiresAt"   TIMESTAMP,
  "refreshTokenExpiresAt"  TIMESTAMP,
  "scope"                  TEXT,
  "password"               TEXT,
  "createdAt"              TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id"         TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "expiresAt"  TIMESTAMP NOT NULL,
  "createdAt"  TIMESTAMP,
  "updatedAt"  TIMESTAMP
);

-- LLM calls table
CREATE TABLE IF NOT EXISTS calls (
  id           BIGSERIAL PRIMARY KEY,
  provider     VARCHAR(50)     NOT NULL,
  model        VARCHAR(100)    NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd     DECIMAL(14, 8),
  latency_ms   INTEGER,
  timestamp    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  tag          VARCHAR(255),
  status_code  INTEGER
);

CREATE INDEX IF NOT EXISTS calls_timestamp_idx ON calls (timestamp DESC);
CREATE INDEX IF NOT EXISTS calls_provider_idx  ON calls (provider);
