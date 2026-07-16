"use client";
// 04 · Send Flow + 04b · Review & Confirm (+ success)
// Every transfer is confidential — the provider handles conversion internally.
import { isAddress } from "ethers";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Box, Btn, Circ, Divider, Hd, Header, Lbl, Pill, shortAddr } from "@/components/ui";
import type { ShieldProgress } from "@/lib/providers/types";
import { shieldProvider, useWallet } from "@/store/wallet";

const inputCls = "w-full border border-[#111] p-3 text-[11px] outline-none placeholder:text-[#999]";

// User-facing labels for internal protocol steps
const STEP_LABEL: Record<ShieldProgress["step"], string> = {
  preparing: "Preparing Secure Transfer…",
  "generating-proof": "Confirming…",
  submitting: "Confirming…",
  done: "Completed",
};

export function Send({ symbol }: { symbol?: string }) {
  const s = useWallet();
  // display symbols never carry the internal "e" prefix
  const sendSymbol = (symbol ?? "USDC").replace(/^e/, "");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const review = () => {
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
    s.setPendingSend({ to, amount, symbol: sendSymbol, fee: "~0.001" });
    s.navigate({ name: "send-review" });
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
            <Lbl>{sendSymbol}</Lbl>
          </div>
        </div>
        {error && <Lbl className="text-[#111]">{error}</Lbl>}
      </div>
      <div className="flex-1" />
      <Divider />
      <div className="p-4">
        <Btn primary className="w-full" onClick={review}>
          Review
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
      const { txHash, proofId } = await shieldProvider.send(
        account.address,
        p.symbol,
        p.amount,
        p.to,
        setProgress,
      );
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
      <Header title="Review" onBack={() => s.navigate({ name: "send" })} />
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
          <Lbl>Privacy</Lbl>
          <Pill>Protected</Pill>
        </div>
        <div className="h-px w-full bg-[#bbb]" />
        <div className="flex justify-between">
          <Lbl>Network Fee</Lbl>
          <div className="text-[11px]">{p.fee} AVAX</div>
        </div>
        {progress && (
          <div className="mt-2">
            <Lbl className="mb-1">{STEP_LABEL[progress.step]}</Lbl>
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
          {busy ? "Sending…" : "Send"}
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
      <Hd className="text-[15px]">Completed</Hd>
      <Lbl className="mt-[6px]">
        {r ? `${r.amount} ${r.symbol} sent privately` : "Transaction submitted"}
      </Lbl>
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
  const [qr, setQr] = useState("");
  const address = account?.address ?? "";

  useEffect(() => {
    if (address) void QRCode.toDataURL(address, { width: 140, margin: 1 }).then(setQr);
  }, [address]);

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Receive" onBack={() => s.navigate({ name: "home" })} />
      <div className="flex flex-1 flex-col items-center p-6 text-center">
        <Lbl>Your wallet address</Lbl>
        {qr && (
          /* eslint-disable-next-line @next/next/no-img-element -- data URI */
          <img className="mt-3 h-[140px] w-[140px] border border-[#111]" alt="QR code" src={qr} />
        )}
        <Box className="mt-3 w-full p-3 text-[10px] break-all">{address}</Box>
        <Btn
          primary
          className="mt-4 w-[200px]"
          onClick={() => {
            void navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied ✓" : "Copy Address"}
        </Btn>
      </div>
    </div>
  );
}
