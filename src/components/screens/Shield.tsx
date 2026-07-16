"use client";
// 05 · Shield Flow, 05b · Success, 06 · Unshield Flow (mirror)
import { useState } from "react";

import { Btn, Circ, Divider, Hd, Header, Lbl, Ph } from "@/components/ui";
import { fmtUnits, parseUnits } from "@/lib/format";
import type { ShieldProgress } from "@/lib/providers/types";
import { shieldProvider, useWallet } from "@/store/wallet";

function ProgressBar({ progress }: { progress: ShieldProgress }) {
  return (
    <div>
      <Lbl className="mb-1">
        {progress.step.replace("-", " ")} · {progress.percent}%
      </Lbl>
      <div className="h-[6px] w-full border border-[#111]">
        <div
          className="h-full bg-[#111] transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}

function ShieldForm({ mode, symbol }: { mode: "shield" | "unshield"; symbol?: string }) {
  const s = useWallet();
  const account = s.accounts[s.activeIndex];
  const isShield = mode === "shield";

  // token selection
  const shieldableTokens = ["AVAX", ...s.tokens.map((t) => t.symbol)];
  const unshieldableTokens = s.shielded.map((b) => b.symbol);
  const options = isShield ? shieldableTokens : unshieldableTokens;
  const [token, setToken] = useState(
    symbol && options.includes(symbol) ? symbol : (options[0] ?? ""),
  );
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ShieldProgress | null>(null);
  const [busy, setBusy] = useState(false);

  const shieldedBal = s.shielded.find((b) => b.symbol === token);
  const decimals = isShield
    ? token === "AVAX"
      ? 18
      : (s.tokens.find((t) => t.symbol === token)?.decimals ?? 18)
    : (shieldedBal?.decimals ?? 18);

  const currentBalance = isShield
    ? token === "AVAX"
      ? `${fmtUnits(s.nativeBalance, 18)} AVAX`
      : `${fmtUnits(s.tokens.find((t) => t.symbol === token)?.balance ?? 0n, decimals)} ${token}`
    : `•••• ${token}`;

  const confirm = async () => {
    setError("");
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter an amount");
      return;
    }
    const units = parseUnits(amount, decimals);
    if (isShield) {
      const max =
        token === "AVAX"
          ? s.nativeBalance
          : (s.tokens.find((t) => t.symbol === token)?.balance ?? 0n);
      if (units > max) {
        setError("Amount exceeds balance");
        return;
      }
    }
    setBusy(true);
    try {
      const result = isShield
        ? await shieldProvider.shield(account.address, token, units, setProgress)
        : await shieldProvider.unshield(account.address, token, units, setProgress);
      s.setLastResult({ txHash: result.txHash, amount, symbol: token, proofId: result.proofId });
      void s.refresh();
      s.navigate({ name: isShield ? "shield-success" : "unshield-success" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title={isShield ? "Shield Assets" : "Unshield Assets"}
        onBack={() => s.navigate({ name: "home" })}
      />
      <div className="flex flex-col gap-[14px] p-4">
        <div>
          <Lbl>Current Token</Lbl>
          <div className="mt-1 flex items-center gap-2 border border-[#111] p-[10px]">
            <Circ size={22} ph />
            <select
              className="flex-1 cursor-pointer bg-transparent text-[11px] outline-none"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {isShield ? o : `•••• ${o}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Lbl>{isShield ? "Current Balance" : "Shielded Balance"}</Lbl>
          <div className="text-[14px] font-bold">{currentBalance}</div>
        </div>
        <div>
          <Lbl>{isShield ? "Amount to Shield" : "Amount to Unshield"}</Lbl>
          <input
            className="mt-1 w-full border border-[#111] p-3 text-[18px] font-bold outline-none placeholder:text-[#999]"
            placeholder="0.00"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>
        <Ph className="p-3">
          <Lbl>Privacy Preview</Lbl>
          <div className="mt-1 text-[10px] text-[#555]">
            {isShield
              ? "Balance becomes shielded · amount & recipient hidden on-chain"
              : "Amount becomes publicly visible on-chain once unshielded"}
          </div>
        </Ph>
        {progress && <ProgressBar progress={progress} />}
        {error && <Lbl className="text-[#111]">{error}</Lbl>}
      </div>
      <div className="flex-1" />
      <Divider />
      <div className="p-4">
        <Btn primary className="w-full" disabled={busy || options.length === 0} onClick={confirm}>
          {busy
            ? isShield
              ? "Shielding…"
              : "Unshielding…"
            : isShield
              ? "Confirm Shield"
              : "Confirm Unshield"}
        </Btn>
      </div>
    </div>
  );
}

export const Shield = ({ symbol }: { symbol?: string }) => (
  <ShieldForm mode="shield" symbol={symbol} />
);
export const Unshield = ({ symbol }: { symbol?: string }) => (
  <ShieldForm mode="unshield" symbol={symbol} />
);

export function ShieldSuccess({ mode }: { mode: "shield" | "unshield" }) {
  const s = useWallet();
  const r = s.lastResult;
  const isShield = mode === "shield";
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <Circ size={64} className="mb-4 text-[24px]">
        ✓
      </Circ>
      <Hd className="text-[15px]">
        {isShield ? "Shielded Successfully" : "Unshielded Successfully"}
      </Hd>
      <Lbl className="mt-[6px]">
        {r
          ? `${r.amount} ${r.symbol} moved to ${isShield ? "shielded" : "public"} balance`
          : "Operation complete"}
      </Lbl>
      {r?.proofId && <Lbl className="mt-1">Proof: {r.proofId}</Lbl>}
      <Btn primary className="mt-6 w-[200px]" onClick={() => s.navigate({ name: "home" })}>
        Done
      </Btn>
      <button className="mt-3 cursor-pointer" onClick={() => s.navigate({ name: "activity" })}>
        <Lbl>View in Activity →</Lbl>
      </button>
    </div>
  );
}
