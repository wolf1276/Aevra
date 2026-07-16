"use client";
// 07 · Activity Screen (+ shared activity row and reveal/proof actions)
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Box, Circ, Divider, DividerL, Hd, Lbl, timeAgo } from "@/components/ui";
import type { TxRecord } from "@/lib/providers/types";
import { privacyProvider, useWallet } from "@/store/wallet";

const TYPE_LABEL: Record<TxRecord["type"], string> = {
  send: "Sent",
  receive: "Received",
  shield: "Shield",
  unshield: "Unshield",
  "shielded-send": "Shielded transfer",
  "shielded-receive": "Shielded transfer",
};

function txTitle(tx: TxRecord): string {
  if (tx.type === "shielded-send" || tx.type === "shielded-receive") return "Shielded transfer";
  return `${TYPE_LABEL[tx.type]} ${tx.symbol}`;
}

function txSub(tx: TxRecord): string {
  if (tx.type === "shield") return "Public → Shielded";
  if (tx.type === "unshield") return "Shielded → Public";
  if (tx.visibility === "shielded")
    return tx.revealed ? "Shielded · revealed" : "Shielded · tap to reveal";
  return `Public · ${timeAgo(tx.timestamp)}`;
}

function txAmount(tx: TxRecord): string {
  if (tx.visibility === "shielded" && tx.type.startsWith("shielded") && !tx.revealed) return "••••";
  const sign = tx.type === "send" || tx.type === "shielded-send" ? "-" : "+";
  return `${sign}${tx.amount}`;
}

export function ActivityRow({ tx, expandable }: { tx: TxRecord; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"reveal" | "proof" | null>(null);
  const [proofId, setProofId] = useState<string | null>(tx.proofId ?? null);
  const { accounts, activeIndex, refresh } = useWallet();
  const address = accounts[activeIndex]?.address;

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
          <div className="text-[11px]">{txTitle(tx)}</div>
          <Lbl>{txSub(tx)}</Lbl>
        </div>
        <div className="text-[11px]">{txAmount(tx)}</div>
      </div>
      {open && (
        <Box className="mb-2 flex flex-col gap-1 p-2">
          <div className="flex justify-between">
            <Lbl>Hash</Lbl>
            <div className="text-[9px]">
              {tx.hash.slice(0, 14)}…{tx.hash.slice(-6)}
            </div>
          </div>
          <div className="flex justify-between">
            <Lbl>Status</Lbl>
            <div className="text-[9px] uppercase">{tx.status}</div>
          </div>
          {proofId && (
            <div className="flex justify-between">
              <Lbl>Proof ID</Lbl>
              <div className="text-[9px]">{proofId}</div>
            </div>
          )}
          {tx.explorerUrl && (
            <a
              href={tx.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[9px] underline"
            >
              View on explorer →
            </a>
          )}
          {tx.visibility === "shielded" && (
            <div className="mt-1 flex gap-2">
              {!tx.revealed && (
                <button
                  onClick={reveal}
                  className="flex-1 cursor-pointer border border-[#111] py-1 text-[9px] font-bold uppercase"
                >
                  {busy === "reveal" ? "Revealing…" : "Reveal Transaction"}
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
  const [tab, setTab] = useState<"all" | "public" | "shielded">("all");

  const all = [...s.shieldedActivity, ...s.history].sort((a, b) => b.timestamp - a.timestamp);
  const filtered = tab === "all" ? all : all.filter((t) => t.visibility === tab);

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
      <div className="flex px-4">
        {(["all", "public", "shielded"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 cursor-pointer py-2 text-center text-[10px] capitalize ${
              tab === t ? "border-b-2 border-[#111] font-bold" : "text-[#999]"
            }`}
          >
            {t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <DividerL />
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
