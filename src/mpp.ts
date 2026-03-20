/** MPP 402 parsing and Authorization: Payment credential construction. */

export type MppChallenge = {
  id: string;
  realm: string;
  method: string;
  intent: string;
  request: string; // base64url-encoded
  expires?: string;
  description?: string;
  opaque?: string;
  digest?: string;
};

export type MppRequest = {
  amount: string;
  currency: string;
  recipient: string;
  methodDetails?: {
    chainId: number;
    feePayer?: boolean;
    memo?: string;
  };
};

// -- Base64url helpers --

function base64urlDecode(str: string): string {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return atob(b64);
}

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// -- Amount conversion --

/** Convert atomic token units to human-readable units (e.g. "1000000" -> "1.00"). */
export function atomicToUnits(atomic: string, decimals: number = 6): string {
  const n = BigInt(atomic);
  const d = BigInt(10 ** decimals);
  const whole = n / d;
  const frac = (n % d).toString().padStart(decimals, "0");
  const trimmed = frac.replace(/0+$/, "").padEnd(2, "0");
  return `${whole}.${trimmed}`;
}

// -- Parse WWW-Authenticate: Payment header --

/** Parse key="value" pairs from an auth challenge string. */
function parseAuthParams(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

/** Parse an Authorization: Payment credential back into challenge + txHash. */
export function parseMppCredential(authHeader: string): {
  challenge: MppChallenge;
  txHash: string;
} | null {
  if (!authHeader.startsWith("Payment ")) return null;
  try {
    const decoded = base64urlDecode(authHeader.slice("Payment ".length));
    const cred = JSON.parse(decoded);
    const txHash = cred.payload?.hash ?? cred.payload?.signature;
    if (!cred.challenge?.id || !txHash) return null;
    return { challenge: cred.challenge as MppChallenge, txHash };
  } catch {
    return null;
  }
}

/** Build the Authorization: Payment header value using Tempo hash proof. */
export function buildMppCredential(
  challenge: MppChallenge,
  txHash: string
): string {
  const credential: Record<string, unknown> = {
    challenge: {
      id: challenge.id,
      realm: challenge.realm,
      method: challenge.method,
      intent: challenge.intent,
      request: challenge.request,
      ...(challenge.expires ? { expires: challenge.expires } : {}),
      ...(challenge.description ? { description: challenge.description } : {}),
      ...(challenge.opaque ? { opaque: challenge.opaque } : {}),
    },
    payload: {
      type: "hash",
      hash: txHash,
    },
  };
  return `Payment ${base64urlEncode(JSON.stringify(credential))}`;
}
