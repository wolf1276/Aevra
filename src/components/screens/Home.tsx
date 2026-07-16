"use client";
// 01 · Home Dashboard
import { useState } from "react";

import { AccountSwitcher } from "@/components/AccountSwitcher";
import { BottomNav } from "@/components/BottomNav";
import { ActivityRow } from "@/components/screens/Activity";
import { Box, Btn, Circ, Divider, DividerL, Hd, Lbl, Pill, shortAddr } from "@/components/ui";
import { fmtUsd } from "@/lib/format";
import { NETWORKS, useWallet } from "@/store/wallet";

export function Home() {
  const s = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [netOpen, setNetOpen] = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);
  const account = s.accounts[s.activeIndex];

  const copyAddress = () => {
    if (!account) return;
    void navigator.clipboard.writeText(account.address);
    setAddrCopied(true);
    setTimeout(() => setAddrCopied(false), 1500);
  };

  const totalUsd =
    (Number(s.nativeBalance) / 1e18) * s.avaxPrice +
    s.tokens.reduce((a, t) => a + t.usdValue, 0) +
    s.shielded.reduce((a, b) => a + b.usdValue, 0);

  // ponytail: fixed 0.01 AVAX gas-floor threshold, make configurable if other networks need it
  const needsFujiFaucet = s.networkId === "fuji" && Number(s.nativeBalance) / 1e18 < 0.01;
  const requestTestAvax = () => {
    window.open("https://core.app/tools/testnet-faucet/?subnet=c&token=c", "_blank");
    if (account) void navigator.clipboard.writeText(account.address);
    s.showToast("Wallet address copied. Paste it into the faucet.");
  };

  const recent = [...s.shieldedActivity, ...s.history]
    .filter((tx) => tx.type !== "shield" && tx.type !== "unshield")
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
          <div className="flex flex-col items-start">
            <div className="text-[11px] font-bold">{account?.name ?? "Wallet"} ▾</div>
            {account && (
              <div
                className="cursor-pointer text-[9px] text-[#777] hover:text-[#111]"
                onClick={(e) => {
                  e.stopPropagation();
                  copyAddress();
                }}
              >
                {addrCopied ? "Address Copied" : `${shortAddr(account.address)} ⧉`}
              </div>
            )}
          </div>
        </button>
        <Pill onClick={() => setNetOpen((v) => !v)}>{NETWORKS[s.networkId].name} ▾</Pill>
        {menuOpen && <AccountSwitcher onClose={() => setMenuOpen(false)} />}
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
        <Lbl>Portfolio</Lbl>
        <div className="mt-1 mb-[10px] text-[26px] font-bold">{fmtUsd(totalUsd)}</div>
        <button className="cursor-pointer" onClick={() => s.navigate({ name: "privacy" })}>
          <Pill>Protected ✓</Pill>
        </button>
      </div>
      <DividerL />

      {needsFujiFaucet && (
        <>
          <div className="p-4">
            <Box className="p-3">
              <Hd>Get Test AVAX</Hd>
              <Lbl className="mt-1 block">
                Your wallet needs Fuji test AVAX to start sending transactions.
              </Lbl>
              <Btn primary className="mt-2 w-full" onClick={requestTestAvax}>
                Request Test AVAX
              </Btn>
            </Box>
          </div>
          <DividerL />
        </>
      )}

      {/* actions */}
      <div className="flex gap-2 px-4 py-3">
        <Btn primary className="flex-1" onClick={() => s.navigate({ name: "send" })}>
          Send
        </Btn>
        <Btn className="flex-1" onClick={() => s.navigate({ name: "receive" })}>
          Receive
        </Btn>
      </div>
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
