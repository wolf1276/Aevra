import { describe, expect, it } from "vitest";

import { fmtUnits, fmtUsd, parseUnits } from "./format";

describe("format", () => {
  it("fmtUnits", () => {
    expect(fmtUnits(1_500_000_000_000_000_000n, 18)).toBe("1.50");
    expect(fmtUnits(0n, 6)).toBe("0.00");
  });

  it("fmtUsd", () => {
    expect(fmtUsd(1234.5)).toBe("$1234.50");
  });

  it("parseUnits round-trips", () => {
    expect(parseUnits("1.5", 18)).toBe(1_500_000_000_000_000_000n);
    expect(parseUnits("0.000001", 6)).toBe(1n);
    expect(parseUnits("", 6)).toBe(0n);
    expect(parseUnits("2", 0)).toBe(2n);
    // trailing zeros beyond supported precision are fine
    expect(parseUnits("1.500000", 6)).toBe(1_500_000n);
  });

  it("parseUnits rejects unsupported precision instead of truncating", () => {
    expect(() => parseUnits("0.001", 2)).toThrow("This token supports at most 2 decimal places.");
    expect(() => parseUnits("1.9999999", 6)).toThrow("at most 6 decimal places");
    expect(() => parseUnits("0.1", 0)).toThrow("at most 0 decimal places");
  });
});
