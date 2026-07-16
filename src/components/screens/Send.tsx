"use client";
// 04 · Send Flow + 04b · Review & Confirm (+ success)
import { formatEther, isAddress, parseEther } from "ethers";
import { useState } from "react";

import { Box, Btn, Circ, Divider, Hd, Header, Lbl, Pill, shortAddr } from "@/components/ui";
import { parseUnits } from "@/lib/format";
import type { ShieldProgress } from "@/lib/providers/types";
import {
  NETWORKS,
  shieldProvider,
  transactionProvider,
  useWallet,
  walletProvider,
} from "@/store/wallet";

const inputCls = "w-full border border-[#111] p-3 text-[11px] outline-none placeholder:text-[#999]";

export function Send({ symbol }: { symbol?: string }) {
  const s = useWallet();
  const account = s.accounts[s.activeIndex];
  const isShieldedToken = !!symbol && s.shielded.some((b) => b.symbol === symbol);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"public" | "shielded">(
    isShieldedToken ? "shielded" : s.defaultSendMode,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sendSymbol = symbol ?? "AVAX";
  const displaySymbol =
    mode === "shielded" && !sendSymbol.startsWith("e") ? sendSymbol : sendSymbol;

  const review = async () => {
    setError("");
    if (!isAddress(to)) {
      setError("Invalid recipient address");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Enter an amount");
      return;
    }
    setBusy(true);
    try {
      let fee = "0.001";
      if (mode === "public") {
        const est = await transactionProvider.estimateGas(
          account.address,
          { to, value: parseEther(amount) },
          NETWORKS[s.networkId],
        );
        fee = Number(formatEther(est.fee)).toFixed(6);
      }
      s.setPendingSend({ to, amount, symbol: displaySymbol, mode, fee });
      s.navigate({ name: "send-review" });
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 80) : "Gas estimation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Send" onBack={() => s.navigate({ name: "home" })} />
      <div className="flex flex-col gap-[14px] p-4">
        <div>
          <Lbl>Recipient</Lbl>
          <input
            className={`${inputCls} mt-1`}
            placeholder="Address or ANS name"
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
          />
        </div>
        <div>
          <Lbl>Amount</Lbl>
          <div className="mt-1 flex items-center border border-[#111] p-3">
            <input
              className="w-full text-[18px] font-bold outline-none"
              placeholder="0.00"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <Lbl>{displaySymbol}</Lbl>
          </div>
        </div>
        <div>
          <Lbl className="mb-[6px]">Privacy Toggle</Lbl>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("public")}
              className={`flex-1 cursor-pointer border border-[#111] p-[10px] text-center text-[11px] ${
                mode === "public" ? "bg-[#111] text-white" : ""
              }`}
            >
              {mode === "public" ? "●" : "○"} Public
            </button>
            <button
              onClick={() => setMode("shielded")}
              className={`flex-1 cursor-pointer border border-[#111] p-[10px] text-center text-[11px] ${
                mode === "shielded" ? "bg-[#111] text-white" : ""
              }`}
            >
              {mode === "shielded" ? "●" : "○"} Shielded
            </button>
          </div>
        </div>
        {error && <Lbl className="text-[#111]">{error}</Lbl>}
      </div>
      <div className="flex-1" />
      <Divider />
      <div className="p-4">
        <Btn primary className="w-full" disabled={busy} onClick={review}>
          {busy ? "Estimating…" : "Review"}
        </Btn>
      </div>
    </div>
  );
}

export function SendReview() {
  const s = useWallet();
  const p = s.pendingSend;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ShieldProgress | null>(null);
  const [error, setError] = useState("");
  const account = s.accounts[s.activeIndex];

  // only reachable via review(), which sets pendingSend; cleared during exit animation
  if (!p) return null;

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      let txHash: string;
      let proofId: string | undefined;
      if (p.mode === "public") {
        txHash = await walletProvider.sendTransaction(
          s.activeIndex,
          { to: p.to, value: parseEther(p.amount) },
          NETWORKS[s.networkId],
        );
      } else {
        // shielded (confidential) transfer — mocked eERC layer
        const eSymbol = p.symbol.startsWith("e") ? p.symbol : `e${p.symbol}`;
        const bal = s.shielded.find((b) => b.symbol === eSymbol);
        if (!bal) throw new Error(`No shielded ${p.symbol} balance — shield first`);
        const result = await shieldProvider.shieldedSend(
          account.address,
          p.symbol,
          parseUnits(p.amount, bal.decimals),
          p.to,
          setProgress,
        );
        txHash = result.txHash;
        proofId = result.proofId;
      }
      s.setLastResult({ txHash, amount: p.amount, symbol: p.symbol, proofId });
      s.navigate({ name: "send-success" }); // before clearing pendingSend — see effect above
      s.setPendingSend(null);
      void s.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Transaction failed");
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Review Transfer" onBack={() => s.navigate({ name: "send" })} />
      <div className="flex flex-col gap-[10px] p-4">
        <div className="flex justify-between">
          <Lbl>To</Lbl>
          <div className="text-[11px]">{shortAddr(p.to)}</div>
        </div>
        <div className="flex justify-between">
          <Lbl>Amount</Lbl>
          <div className="text-[11px]">
            {p.amount} {p.symbol}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Lbl>Mode</Lbl>
          <Pill>{p.mode === "shielded" ? "Shielded" : "Public"}</Pill>
        </div>
        <div className="h-px w-full bg-[#bbb]" />
        <div className="flex justify-between">
          <Lbl>Network Fee</Lbl>
          <div className="text-[11px]">{p.fee} AVAX</div>
        </div>
        {p.mode === "shielded" && (
          <div className="flex justify-between">
            <Lbl>Proof Generation</Lbl>
            <div className="text-[11px]">~8s</div>
          </div>
        )}
        {progress && (
          <div className="mt-2">
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
        )}
        {error && <Lbl className="text-[#111]">{error}</Lbl>}
      </div>
      <div className="flex-1" />
      <Divider />
      <div className="flex gap-2 p-4">
        <Btn className="flex-1" disabled={busy} onClick={() => s.navigate({ name: "send" })}>
          Cancel
        </Btn>
        <Btn primary className="flex-[2]" disabled={busy} onClick={confirm}>
          {busy ? "Signing…" : "Confirm & Sign"}
        </Btn>
      </div>
    </div>
  );
}

export function SendSuccess() {
  const s = useWallet();
  const r = s.lastResult;
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <Circ size={64} className="mb-4 text-[24px]">
        ✓
      </Circ>
      <Hd className="text-[15px]">Transfer Sent</Hd>
      <Lbl className="mt-[6px]">
        {r ? `${r.amount} ${r.symbol} sent successfully` : "Transaction submitted"}
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

export function Receive() {
  const s = useWallet();
  const account = s.accounts[s.activeIndex];
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-1 flex-col">
      <Header title="Receive" onBack={() => s.navigate({ name: "home" })} />
      <div className="flex flex-1 flex-col items-center p-6 text-center">
        <Lbl>Your {NETWORKS[s.networkId].name} address</Lbl>
        <Box className="mt-3 w-full p-3 text-[10px] break-all">{account?.address}</Box>
        <Btn
          primary
          className="mt-4 w-[200px]"
          onClick={() => {
            void navigator.clipboard.writeText(account?.address ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied ✓" : "Copy Address"}
        </Btn>
        <a
          href={`${NETWORKS[s.networkId].explorerUrl}/address/${account?.address}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4"
        >
          <Lbl>View on explorer →</Lbl>
        </a>
      </div>
    </div>
  );
}
