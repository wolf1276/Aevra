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
    // truncates excess precision, never rounds up
    expect(parseUnits("1.9999999", 6)).toBe(1_999_999n);
  });
});
