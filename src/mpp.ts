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

/**
 * Parse MPP Payment challenges from WWW-Authenticate header value.
 * Returns only tempo-method challenges.
 */
export function parseMppChallenges(headerValue: string): MppChallenge[] {
  const challenges: MppChallenge[] = [];
  // Split on "Payment " boundaries
  const parts = headerValue.split(/(?=Payment\s)/i);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.toLowerCase().startsWith("payment")) continue;
    const params = parseAuthParams(trimmed);
    if (params.method !== "tempo") continue;
    challenges.push({
      id: params.id,
      realm: params.realm,
      method: params.method,
      intent: params.intent,
      request: params.request,
      expires: params.expires,
      description: params.description,
      opaque: params.opaque,
      digest: params.digest,
    });
  }
  return challenges;
}

/** Decode the base64url request field from an MPP challenge. */
export function decodeMppRequest(challenge: MppChallenge): MppRequest {
  const json = base64urlDecode(challenge.request);
  return JSON.parse(json) as MppRequest;
}

/** Supported MPP intents. Session intent requires escrow channels (not yet supported). */
const SUPPORTED_INTENTS = ["charge"];

/**
 * Validate that an MPP 402 response is a supported charge-intent challenge.
 * Returns the parsed challenge and request, or an error string.
 */
export function validateMpp402(authHeader: string): {
  challenge: MppChallenge;
  request: MppRequest;
} | { error: string } {
  const challenges = parseMppChallenges(authHeader);
  if (challenges.length === 0) {
    return { error: "No tempo Payment challenge found in 402 response" };
  }

  const challenge = challenges.find(c => SUPPORTED_INTENTS.includes(c.intent));
  if (!challenge) {
    const intents = challenges.map(c => c.intent).join(", ");
    return { error: `Unsupported MPP intent(s): ${intents}. Supported: ${SUPPORTED_INTENTS.join(", ")}` };
  }

  const request = decodeMppRequest(challenge);

  if (!request.methodDetails?.chainId) {
    return { error: "MPP challenge missing methodDetails.chainId" };
  }
  if (!request.recipient) {
    return { error: "MPP challenge missing recipient" };
  }
  if (!request.amount) {
    return { error: "MPP challenge missing amount" };
  }

  return { challenge, request };
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
