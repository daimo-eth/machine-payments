/** Postgres connection and schema. All tables defined here. */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL env var is required");

const sql = postgres(DATABASE_URL);
export default sql;

/** Create all tables if they don't exist. No migration system -- just idempotent DDL. */
export async function migrate() {
  // -- Payment proxy tables --

  await sql`
    CREATE TABLE IF NOT EXISTS mpp_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      daimo_session_id TEXT NOT NULL,
      daimo_client_secret TEXT NOT NULL,
      original_request JSONB NOT NULL,
      challenge JSONB NOT NULL,
      deposit_address TEXT NOT NULL,
      token_options JSONB NOT NULL,
      output_tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      final_completion_attempt_id UUID,
      failure_reason TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mpp_completion_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id UUID NOT NULL REFERENCES mpp_payments(id),
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      delivery_tx_hash TEXT,
      request_url TEXT NOT NULL,
      request_method TEXT NOT NULL,
      request_headers JSONB NOT NULL,
      request_body TEXT,
      response_status INT,
      response_headers JSONB,
      response_body TEXT,
      outcome TEXT NOT NULL,
      error TEXT,
      duration_ms INT
    )
  `;

  // -- Directory tables --

  await sql`
    CREATE TABLE IF NOT EXISTS mpp_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      url TEXT UNIQUE NOT NULL,
      name TEXT,
      description TEXT,
      category TEXT,
      metadata JSONB,
      search_vector TSVECTOR,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE mpp_providers ADD COLUMN IF NOT EXISTS endpoints JSONB
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mpp_providers_search
    ON mpp_providers USING GIN (search_vector)
  `;

  // Auto-update search_vector on insert/update
  await sql`
    CREATE OR REPLACE FUNCTION mpp_providers_search_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english',
        coalesce(NEW.name, '') || ' ' ||
        coalesce(NEW.description, '') || ' ' ||
        coalesce(NEW.category, '')
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;

  await sql`
    DROP TRIGGER IF EXISTS mpp_providers_search_trigger ON mpp_providers
  `;

  await sql`
    CREATE TRIGGER mpp_providers_search_trigger
    BEFORE INSERT OR UPDATE ON mpp_providers
    FOR EACH ROW EXECUTE FUNCTION mpp_providers_search_update()
  `;

  // -- Rating tables --

  await sql`
    CREATE TABLE IF NOT EXISTS mpp_ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id UUID NOT NULL REFERENCES mpp_providers(id),
      payment_id UUID UNIQUE NOT NULL REFERENCES mpp_payments(id),
      agent_id TEXT,
      score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
      comment TEXT,
      tags JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mpp_ratings_provider_id
    ON mpp_ratings(provider_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mpp_ratings_created_at
    ON mpp_ratings(created_at)
  `;

  // -- Proxy request log --

  await sql`
    CREATE TABLE IF NOT EXISTS mpp_proxy_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      target_url TEXT NOT NULL,
      method TEXT NOT NULL,
      has_payment_credential BOOLEAN NOT NULL DEFAULT false,
      response_status INT,
      duration_ms INT,
      error TEXT
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mpp_proxy_requests_target_url
    ON mpp_proxy_requests(target_url)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mpp_proxy_requests_created_at
    ON mpp_proxy_requests(created_at)
  `;
}
