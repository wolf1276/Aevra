"use client";
// 04 · Send Flow + 04b · Review & Confirm (+ success)
// Every transfer is confidential — the provider handles conversion internally.
import { isAddress } from "ethers";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { AppLayout } from "@/components/AppLayout";
import { Box, Btn, Circ, Divider, Hd, Header, Lbl, Pill, shortAddr } from "@/components/ui";
import { fmtUnits } from "@/lib/format";
import type { ShieldProgress } from "@/lib/providers/types";
import { shieldProvider, useWallet } from "@/store/wallet";

const inputCls =
  "w-full rounded-none border border-[var(--av-text)] p-3 text-[12px] outline-none placeholder:text-[var(--av-text-3)] focus:border-[var(--av-red)]";

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
    s.setPendingSend({ to, amount, symbol: sendSymbol });
    s.navigate({ name: "send-review" });
  };

  const header = <Header title="Send" onBack={() => s.navigate({ name: "home" })} />;

  const footer = (
    <>
      <Divider />
      <div className="p-4">
        <Btn primary className="w-full" onClick={review}>
          Review
        </Btn>
      </div>
    </>
  );

  return (
    <AppLayout header={header} footer={footer}>
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
          <div className="mt-1 flex items-center rounded-none border border-[var(--av-text)] p-3">
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
        {error && <Lbl className="text-[var(--av-red)]">{error}</Lbl>}
      </div>
    </AppLayout>
  );
}

// Module-level cache: the estimate is expensive (real proof + simulation), so a
// round trip Send -> Review -> Send -> Review with an unchanged draft reuses it
// instead of regenerating. Keyed on everything that changes the exact fee.
let feeCache: { sig: string; fee: bigint } | null = null;

export function SendReview() {
  const s = useWallet();
  const p = s.pendingSend;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ShieldProgress | null>(null);
  const [error, setError] = useState("");
  const [fee, setFee] = useState<bigint | null>(null);
  const [feeError, setFeeError] = useState(false);
  const [prepStep, setPrepStep] = useState<"proof" | "fee" | "ready">("proof");
  const account = s.accounts[s.activeIndex];
  const encryptedBal = s.shielded.find((b) => b.symbol === `e${p?.symbol}`)?.balance ?? 0n;
  const publicBal = s.tokens.find((b) => b.symbol === p?.symbol)?.balance ?? 0n;

  const sig = p
    ? [p.to, p.amount, p.symbol, s.networkId, account?.address, encryptedBal, publicBal].join("|")
    : "";

  // Runs once per distinct transaction draft (entering Review), not on keystrokes —
  // typing happens on the Send screen, before pendingSend is set.
  useEffect(() => {
    if (!p || !account) return;
    if (feeCache?.sig === sig) {
      setFee(feeCache.fee);
      setFeeError(false);
      setPrepStep("ready");
      return;
    }
    let cancelled = false;
    setFee(null);
    setFeeError(false);
    setPrepStep("proof");
    void shieldProvider
      .estimateSendFee(account.address, p.symbol, p.amount, p.to)
      .then((est) => {
        if (cancelled) return;
        setPrepStep("fee");
        feeCache = { sig, fee: est.totalFee };
        setFee(est.totalFee);
        setPrepStep("ready");
      })
      .catch((e) => {
        console.error("fee estimate failed:", e);
        if (!cancelled) {
          setFeeError(true);
          setPrepStep("ready");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sig captures every input
  }, [sig]);

  // only reachable via review(), which sets pendingSend; cleared during exit animation
  if (!p) return null;

  const preparing = prepStep !== "ready";

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
      setError(e instanceof Error ? e.message.slice(0, 200) : "Transaction failed");
      setBusy(false);
      setProgress(null);
    }
  };

  const header = <Header title="Review" onBack={() => s.navigate({ name: "send" })} />;

  const footer = (
    <>
      <Divider />
      <div className="flex gap-2 p-4">
        <Btn className="flex-1" disabled={busy} onClick={() => s.navigate({ name: "send" })}>
          Cancel
        </Btn>
        <Btn primary className="flex-[2]" disabled={busy || preparing} onClick={confirm}>
          {busy ? "Sending…" : preparing ? "Preparing…" : "Send"}
        </Btn>
      </div>
    </>
  );

  return (
    <AppLayout header={header} footer={footer}>
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
        <div className="h-px w-full bg-[var(--av-divider)]" />
        {preparing ? (
          <div className="flex flex-col gap-1">
            <Lbl>Preparing Confidential Transaction…</Lbl>
            <Lbl className={prepStep === "proof" ? "" : "text-[var(--av-red)]"}>
              {prepStep === "proof"
                ? "Generating Zero-Knowledge Proof…"
                : "✓ Confidential proof ready"}
            </Lbl>
            <Lbl className={prepStep === "proof" ? "opacity-40" : ""}>Estimating Network Fee…</Lbl>
          </div>
        ) : (
          <div className="flex justify-between">
            <Lbl>Estimated Network Fee</Lbl>
            <div className="text-[11px]">
              {feeError ? "Unavailable" : `${fmtUnits(fee!, 18, 5)} AVAX`}
            </div>
          </div>
        )}
        {progress && (
          <div className="mt-2">
            <Lbl className="mb-1">{STEP_LABEL[progress.step]}</Lbl>
            <div className="h-[6px] w-full rounded-full bg-[var(--av-divider)]">
              <div
                className="h-full rounded-full bg-[var(--av-red)] transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
        {error && <Lbl className="text-[var(--av-red)]">{error}</Lbl>}
      </div>
    </AppLayout>
  );
}

export function SendSuccess() {
  const s = useWallet();
  const r = s.lastResult;
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <Circ
        size={64}
        className="mb-4 border-none bg-[var(--av-red-tint)] text-[24px] text-[var(--av-red)]"
      >
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

  const header = <Header title="Receive" onBack={() => s.navigate({ name: "home" })} />;

  return (
    <AppLayout header={header}>
      <div className="flex flex-1 flex-col items-center p-6 text-center">
        <Lbl>Your wallet address</Lbl>
        {qr && (
          /* eslint-disable-next-line @next/next/no-img-element -- data URI */
          <img
            className="mt-3 h-[140px] w-[140px] rounded-none border border-[var(--av-text)]"
            alt="QR code"
            src={qr}
          />
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
    </AppLayout>
  );
}
