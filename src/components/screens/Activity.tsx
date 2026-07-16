"use client";
// 07 · Activity Screen (+ shared activity row and reveal/proof actions)
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Box, Circ, Divider, Hd, Lbl, timeAgo } from "@/components/ui";
import type { TxRecord } from "@/lib/providers/types";
import { privacyProvider, useWallet } from "@/store/wallet";

const TYPE_LABEL: Record<TxRecord["type"], string> = {
  send: "Payment Sent",
  receive: "Payment Received",
  shield: "Payment Sent", // internal ops are filtered out of lists; label defensively
  unshield: "Payment Received",
  "shielded-send": "Payment Sent",
  "shielded-receive": "Payment Received",
};

const STATUS_LABEL: Record<TxRecord["status"], string> = {
  pending: "Pending",
  confirmed: "Completed",
  failed: "Failed",
};

/** Internal protocol operations never shown to the user. */
export function isInternalOp(tx: TxRecord): boolean {
  return tx.type === "shield" || tx.type === "unshield";
}

/** Consumer UI never shows confidential-asset prefixes; Developer Mode shows raw symbols. */
function displaySymbol(symbol: string, developerMode: boolean): string {
  return developerMode ? symbol : symbol.replace(/^e/, "");
}

function txSub(tx: TxRecord): string {
  return `${STATUS_LABEL[tx.status]} · ${timeAgo(tx.timestamp)}`;
}

function txAmount(tx: TxRecord, symbol: string): string {
  if (tx.visibility === "shielded" && tx.type.startsWith("shielded") && !tx.revealed) return "••••";
  const sign = tx.type === "send" || tx.type === "shielded-send" ? "-" : "+";
  return `${sign}${tx.amount} ${symbol}`;
}

export function ActivityRow({ tx, expandable }: { tx: TxRecord; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"reveal" | "proof" | null>(null);
  const [proofId, setProofId] = useState<string | null>(tx.proofId ?? null);
  const { accounts, activeIndex, refresh, developerMode } = useWallet();
  const address = accounts[activeIndex]?.address;
  const symbol = displaySymbol(tx.symbol, developerMode);

  const reveal = async () => {
    if (!address) return;
    setBusy("reveal");
    await privacyProvider.revealTransaction(address, tx.hash);
    await refresh();
    setBusy(null);
  };

  const genProof = async () => {
    if (!address) return;
    setBusy("proof");
    const { proofId } = await privacyProvider.generateProof(address, tx.hash);
    setProofId(proofId);
    setBusy(null);
  };

  return (
    <div className="border-b border-[#eee]">
      <div
        className="flex cursor-pointer items-center gap-2 py-2"
        onClick={() => (expandable ?? true) && setOpen((v) => !v)}
      >
        <Circ size={22} ph />
        <div className="flex-1">
          <div className="text-[11px]">{TYPE_LABEL[tx.type]}</div>
          <Lbl>{txSub(tx)}</Lbl>
        </div>
        <div className="text-[11px]">{txAmount(tx, symbol)}</div>
      </div>
      {open && (
        <Box className="mb-2 flex flex-col gap-1 p-2">
          <div className="flex justify-between">
            <Lbl>Asset</Lbl>
            <div className="text-[9px]">{symbol}</div>
          </div>
          <div className="flex justify-between">
            <Lbl>Status</Lbl>
            <div className="text-[9px]">{STATUS_LABEL[tx.status]}</div>
          </div>
          <div className="flex justify-between">
            <Lbl>Privacy</Lbl>
            <div className="text-[9px]">Protected</div>
          </div>
          <div className="flex justify-between">
            <Lbl>Timestamp</Lbl>
            <div className="text-[9px]">{new Date(tx.timestamp).toLocaleString()}</div>
          </div>
          <div className="flex justify-between">
            <Lbl>Transaction ID</Lbl>
            <div className="text-[9px]">
              {tx.hash.slice(0, 14)}…{tx.hash.slice(-6)}
            </div>
          </div>
          {proofId && (
            <div className="flex justify-between">
              <Lbl>Proof</Lbl>
              <div className="text-[9px]">
                {proofId.slice(0, 14)}…{proofId.slice(-6)}
              </div>
            </div>
          )}
          {tx.visibility === "shielded" && (
            <div className="mt-1 flex gap-2">
              {!tx.revealed && (
                <button
                  onClick={reveal}
                  className="flex-1 cursor-pointer rounded-[10px] border border-[#ccc] py-1 text-[9px] font-bold uppercase"
                >
                  {busy === "reveal" ? "Revealing…" : "Reveal Amount"}
                </button>
              )}
              <button
                onClick={genProof}
                className="flex-1 cursor-pointer border border-[#111] py-1 text-[9px] font-bold uppercase"
              >
                {busy === "proof" ? "Generating…" : "Generate Proof"}
              </button>
            </div>
          )}
        </Box>
      )}
    </div>
  );
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
}

export function Activity() {
  const s = useWallet();

  const filtered = [...s.shieldedActivity, ...s.history]
    .filter((t) => !isInternalOp(t))
    .sort((a, b) => b.timestamp - a.timestamp);

  // group by day
  const groups: { label: string; txs: TxRecord[] }[] = [];
  for (const tx of filtered) {
    const label = dayLabel(tx.timestamp);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.txs.push(tx);
    else groups.push({ label, txs: [tx] });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 py-[14px]">
        <Hd>Activity</Hd>
      </div>
      <Divider />
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-2">
        {filtered.length === 0 && <Lbl className="py-2">No transactions</Lbl>}
        {groups.map((g) => (
          <div key={g.label}>
            <Lbl className="py-[6px]">{g.label}</Lbl>
            {g.txs.map((tx) => (
              <ActivityRow key={tx.hash} tx={tx} expandable />
            ))}
          </div>
        ))}
      </div>
      <BottomNav active="activity" />
    </div>
  );
}
