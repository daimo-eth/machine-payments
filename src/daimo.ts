/** Daimo Session API client. */

const DAIMO_API_URL = "https://daimo.com";

function getApiKey(): string {
  const key = process.env.DAIMO_API_KEY;
  if (!key) throw new Error("DAIMO_API_KEY env var is required");
  return key;
}

function apiHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey()}`,
  };
}

// -- Types --

export type DaimoSession = {
  sessionId: string;
  status: string;
  clientSecret: string;
  destination: {
    type: string;
    address: string;
    chainId: number;
    chainName: string;
    tokenAddress: string;
    tokenSymbol: string;
    amountUnits: string;
    delivery?: { txHash: string; receivedUnits: string };
  };
  paymentMethod?: {
    type: string;
    receiverAddress?: string;
  } | null;
  metadata?: Record<string, string> | null;
  createdAt: number;
  expiresAt: number;
};

export type TokenOption = {
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  requiredUnits: string;
  balanceUnits?: string;
};

// -- API calls --

export async function createSession(destination: {
  address: string;
  chainId: number;
  tokenAddress: string;
  amountUnits: string;
}): Promise<DaimoSession> {
  const res = await fetch(`${DAIMO_API_URL}/v1/sessions`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      destination: {
        type: "evm",
        address: destination.address,
        chainId: destination.chainId,
        tokenAddress: destination.tokenAddress,
        amountUnits: destination.amountUnits,
      },
      display: { title: "DMP Payment", verb: "Pay" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daimo createSession failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { session: DaimoSession };
  return data.session;
}

export async function createPaymentMethod(
  sessionId: string,
  clientSecret: string
): Promise<DaimoSession> {
  const res = await fetch(
    `${DAIMO_API_URL}/v1/sessions/${sessionId}/paymentMethods`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientSecret,
        paymentMethod: { type: "evm" },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Daimo createPaymentMethod failed (${res.status}): ${err}`
    );
  }
  const data = (await res.json()) as { session: DaimoSession };
  return data.session;
}

export async function getTokenOptions(
  sessionId: string,
  clientSecret: string,
  wallet: { evmAddress?: string; solanaAddress?: string }
): Promise<TokenOption[]> {
  const params = new URLSearchParams({ clientSecret });
  if (wallet.evmAddress) params.set("evmAddress", wallet.evmAddress);
  if (wallet.solanaAddress) params.set("solanaAddress", wallet.solanaAddress);

  const res = await fetch(
    `${DAIMO_API_URL}/v1/sessions/${sessionId}/tokenOptions?${params}`,
    { method: "GET" }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daimo getTokenOptions failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { options: TokenOption[] };
  return data.options;
}

export async function retrieveSession(
  sessionId: string
): Promise<DaimoSession> {
  const res = await fetch(`${DAIMO_API_URL}/v1/sessions/${sessionId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daimo retrieveSession failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { session: DaimoSession };
  return data.session;
}

export async function checkSession(
  sessionId: string,
  clientSecret: string,
  txHash?: string
): Promise<DaimoSession> {
  const res = await fetch(
    `${DAIMO_API_URL}/v1/sessions/${sessionId}/check`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientSecret, ...(txHash ? { txHash } : {}) }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Daimo checkSession failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { session: DaimoSession };
  return data.session;
}
