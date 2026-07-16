"use client";
// 01 · Home Dashboard
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { ActivityRow } from "@/components/screens/Activity";
import { Box, Btn, Circ, Divider, DividerL, Hd, Lbl, Pill } from "@/components/ui";
import { fmtUsd } from "@/lib/format";
import { NETWORKS, useWallet } from "@/store/wallet";

export function Home() {
  const s = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [netOpen, setNetOpen] = useState(false);
  const [swapNote, setSwapNote] = useState(false);
  const account = s.accounts[s.activeIndex];

  const publicUsd =
    (Number(s.nativeBalance) / 1e18) * s.avaxPrice + s.tokens.reduce((a, t) => a + t.usdValue, 0);
  const shieldedUsd = s.shielded.reduce((a, b) => a + b.usdValue, 0);
  const recent = [...s.shieldedActivity, ...s.history]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  return (
    <div className="flex flex-1 flex-col">
      {/* header: profile + network pill */}
      <div className="relative flex items-center justify-between px-4 py-[14px]">
        <button
          className="flex cursor-pointer items-center gap-2"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Circ size={24} />
          <div className="text-[11px] font-bold">{account?.name ?? "Wallet"} ▾</div>
        </button>
        <Pill onClick={() => setNetOpen((v) => !v)}>{NETWORKS[s.networkId].name} ▾</Pill>
        {menuOpen && (
          <Box className="absolute top-[48px] left-4 z-10 w-[180px] bg-white">
            {s.accounts.map((a) => (
              <button
                key={a.index}
                className="block w-full cursor-pointer border-b border-[#eee] px-3 py-2 text-left text-[11px]"
                onClick={() => {
                  s.setActiveIndex(a.index);
                  setMenuOpen(false);
                }}
              >
                {a.name} {a.index === s.activeIndex && "✓"}
              </button>
            ))}
            <button
              className="block w-full cursor-pointer border-b border-[#eee] px-3 py-2 text-left text-[11px]"
              onClick={() => {
                void s.addAccount();
                setMenuOpen(false);
              }}
            >
              + Add Account
            </button>
            <button
              className="block w-full cursor-pointer px-3 py-2 text-left text-[11px]"
              onClick={() => s.lock()}
            >
              Lock Wallet
            </button>
          </Box>
        )}
        {netOpen && (
          <Box className="absolute top-[48px] right-4 z-10 w-[120px] bg-white">
            {(["fuji", "mainnet"] as const).map((id) => (
              <button
                key={id}
                className="block w-full cursor-pointer border-b border-[#eee] px-3 py-2 text-left text-[11px] last:border-b-0"
                onClick={() => {
                  s.setNetwork(id);
                  setNetOpen(false);
                }}
              >
                {NETWORKS[id].name} {id === s.networkId && "✓"}
              </button>
            ))}
          </Box>
        )}
      </div>
      <Divider />

      {/* portfolio balance */}
      <div className="p-4 text-center">
        <Lbl>Portfolio Balance</Lbl>
        <div className="mt-1 mb-[10px] text-[26px] font-bold">
          {fmtUsd(publicUsd + shieldedUsd)}
        </div>
        <div className="flex gap-[10px]">
          <Box className="flex-1 p-2">
            <Lbl>Public</Lbl>
            <div className="text-[13px] font-bold">{fmtUsd(publicUsd)}</div>
          </Box>
          <Box className="flex-1 p-2">
            <Lbl>Shielded</Lbl>
            <div className="text-[13px] font-bold">{fmtUsd(shieldedUsd)}</div>
            <Lbl className="mt-[2px]">● Privacy Active</Lbl>
          </Box>
        </div>
      </div>
      <DividerL />

      {/* actions */}
      <div className="flex gap-2 px-4 py-3">
        <Btn className="flex-1" onClick={() => s.navigate({ name: "shield" })}>
          Shield
        </Btn>
        <Btn className="flex-1" onClick={() => s.navigate({ name: "send" })}>
          Send
        </Btn>
        <Btn className="flex-1" onClick={() => s.navigate({ name: "receive" })}>
          Receive
        </Btn>
        <Btn className="flex-1" onClick={() => setSwapNote(true)}>
          Swap
        </Btn>
      </div>
      {swapNote && (
        <div className="px-4 pb-2">
          <Lbl>Swap is not available on {NETWORKS[s.networkId].name} yet</Lbl>
        </div>
      )}
      <DividerL />

      {/* recent activity */}
      <div className="flex justify-between px-4 pt-3 pb-1">
        <Hd>Recent Activity</Hd>
        <button className="cursor-pointer" onClick={() => s.navigate({ name: "activity" })}>
          <Lbl>See all →</Lbl>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-hidden px-4">
        {recent.length === 0 && <Lbl className="py-2">No activity yet</Lbl>}
        {recent.map((tx) => (
          <ActivityRow key={tx.hash} tx={tx} />
        ))}
      </div>
      <BottomNav active="home" />
    </div>
  );
}
