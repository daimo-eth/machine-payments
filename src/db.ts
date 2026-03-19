/** Postgres connection and migrations. */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL env var is required");

const sql = postgres(DATABASE_URL);
export default sql;

export async function migrate() {
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
      delivery_tx_hash TEXT NOT NULL,
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
}
