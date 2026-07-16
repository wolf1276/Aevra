export function fmtUnits(value: bigint, decimals: number, dp = 2): string {
  return (Number(value) / 10 ** decimals).toFixed(dp);
}

export function fmtUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function parseUnits(value: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = value.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}
