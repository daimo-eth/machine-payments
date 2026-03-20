import { describe, expect, test } from "bun:test";
import { atomicToUnits, buildMppCredential, parseMppCredential } from "./mpp";
import type { MppChallenge } from "./mpp";

describe("atomicToUnits", () => {
  const cases: [string, number | undefined, string][] = [
    // [atomic, decimals, expected]
    ["1000000", undefined, "1.00"],
    ["0", undefined, "0.00"],
    ["500000", undefined, "0.50"],
    ["1234567", undefined, "1.234567"],
    ["100", undefined, "0.0001"],
    ["1", undefined, "0.000001"],
    ["1000000000000000000", 18, "1.00"],
    ["123456789012345678", 18, "0.123456789012345678"],
  ];

  test.each(cases)("(%s, %s) => %s", (atomic, decimals, expected) => {
    expect(atomicToUnits(atomic, decimals)).toBe(expected);
  });
});

describe("parseMppCredential", () => {
  const challenge: MppChallenge = {
    id: "test-id-123",
    realm: "exa.mpp.tempo.xyz",
    method: "tempo",
    intent: "charge",
    request: "eyJ0ZXN0IjogdHJ1ZX0",
  };
  const txHash = "0xdeadbeef1234567890";

  test("round-trips with buildMppCredential", () => {
    const header = buildMppCredential(challenge, txHash);
    const parsed = parseMppCredential(header);
    expect(parsed).not.toBeNull();
    expect(parsed!.challenge.id).toBe(challenge.id);
    expect(parsed!.challenge.realm).toBe(challenge.realm);
    expect(parsed!.challenge.method).toBe(challenge.method);
    expect(parsed!.challenge.intent).toBe(challenge.intent);
    expect(parsed!.txHash).toBe(txHash);
  });

  test("returns null for non-Payment header", () => {
    expect(parseMppCredential("Bearer abc")).toBeNull();
    expect(parseMppCredential("")).toBeNull();
  });

  test("returns null for invalid base64/json", () => {
    expect(parseMppCredential("Payment !!!invalid!!!")).toBeNull();
  });

  test("parses payload.signature (Tempo CLI format)", () => {
    const cred = {
      challenge: { id: "test-id", realm: "test", method: "tempo", intent: "charge", request: "abc" },
      source: {},
      payload: { type: "signature", signature: "0xsig123" },
    };
    const header = "Payment " + btoa(JSON.stringify(cred))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const parsed = parseMppCredential(header);
    expect(parsed).not.toBeNull();
    expect(parsed!.txHash).toBe("0xsig123");
    expect(parsed!.challenge.id).toBe("test-id");
  });

  test("returns null for missing fields", () => {
    const incomplete = "Payment " + btoa(JSON.stringify({ challenge: {} }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(parseMppCredential(incomplete)).toBeNull();
  });
});
