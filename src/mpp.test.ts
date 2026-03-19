import { describe, expect, test } from "bun:test";
import { atomicToUnits } from "./mpp";

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
