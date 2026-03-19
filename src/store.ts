/** In-memory payment state store. */

import type { MppChallenge } from "./mpp";
import type { TokenOption } from "./daimo";

const TTL_MS = 60 * 60 * 1000; // 1 hour

export type PaymentState = {
  id: string;
  createdAt: number;

  // Daimo session
  daimoSessionId: string;
  daimoClientSecret: string;

  // Original request (to replay with auth)
  originalRequest: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  };

  // MPP challenge (to echo back in credential)
  challenge: MppChallenge;

  // Payment info for the agent
  depositAddress: string;
  tokenOptions: TokenOption[];

  // Status
  status: "payment_required" | "processing" | "succeeded" | "failed";
  finalResponse?: { status: number; body: unknown };
  error?: string;
};

const payments = new Map<string, PaymentState>();

export function createPayment(
  init: Omit<PaymentState, "id" | "createdAt" | "status">
): PaymentState {
  cleanup();
  const id = crypto.randomUUID();
  const state: PaymentState = { ...init, id, createdAt: Date.now(), status: "payment_required" };
  payments.set(id, state);
  return state;
}

export function getPayment(id: string): PaymentState | undefined {
  return payments.get(id);
}

export function updatePayment(
  id: string,
  update: Partial<PaymentState>
): void {
  const state = payments.get(id);
  if (state) Object.assign(state, update);
}

function cleanup() {
  const now = Date.now();
  for (const [id, state] of payments) {
    if (now - state.createdAt > TTL_MS) payments.delete(id);
  }
}
