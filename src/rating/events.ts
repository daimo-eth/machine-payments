/** Event logging for payment lifecycle. */

import type { SQLQueryBindings } from "bun:sqlite";
import { getDb } from "./db";
import type { Event, EventType } from "./schema";

export function logEvent(params: {
  type: EventType;
  providerUrl?: string;
  paymentId?: string;
  daimoSessionId?: string;
  agentWallet?: string;
  amount?: string;
  metadata?: Record<string, unknown>;
}): Event {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();

  db.run(
    `INSERT INTO events (id, type, provider_url, payment_id, daimo_session_id, agent_wallet, amount, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.type,
      params.providerUrl ?? null,
      params.paymentId ?? null,
      params.daimoSessionId ?? null,
      params.agentWallet ?? null,
      params.amount ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      now,
    ]
  );

  return {
    id,
    type: params.type,
    provider_url: params.providerUrl ?? null,
    payment_id: params.paymentId ?? null,
    daimo_session_id: params.daimoSessionId ?? null,
    agent_wallet: params.agentWallet ?? null,
    amount: params.amount ?? null,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    created_at: now,
  };
}

export function queryEvents(params: {
  type?: string;
  providerUrl?: string;
  since?: number;
  limit?: number;
}): Event[] {
  const db = getDb();
  const conditions: string[] = [];
  const args: SQLQueryBindings[] = [];

  if (params.type) {
    conditions.push("type = ?");
    args.push(params.type);
  }
  if (params.providerUrl) {
    conditions.push("provider_url = ?");
    args.push(params.providerUrl);
  }
  if (params.since) {
    conditions.push("created_at >= ?");
    args.push(params.since);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(params.limit ?? 50, 200);

  return db
    .query<Event, SQLQueryBindings[]>(
      `SELECT * FROM events ${where} ORDER BY created_at DESC LIMIT ?`
    )
    .all(...args, limit);
}
