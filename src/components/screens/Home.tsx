"use client";
// 01 · Home Dashboard
import { useState } from "react";

import { AccountSwitcher } from "@/components/AccountSwitcher";
import { AppLayout } from "@/components/AppLayout";
import { useMergedAssets } from "@/components/screens/Assets";
import { Avatar, Box, Hd, Lbl, Mascot, Pill, shortAddr } from "@/components/ui";
import { fmtUsd } from "@/lib/format";
import { NETWORKS, profileFor, useWallet } from "@/store/wallet";

export function Home() {
  const s = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [netOpen, setNetOpen] = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);
  const account = s.accounts[s.activeIndex];
  const profile = account ? profileFor(s.profiles, account.address) : null;

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

  const assets = useMergedAssets();

  const header = (
    <div className="relative flex items-center justify-between border-b-2 border-[var(--av-divider)] px-4 py-[14px]">
      <button
        className="flex cursor-pointer items-center gap-3"
        onClick={() => setMenuOpen((v) => !v)}
      >
        {profile && account && (
          <Avatar
            seed={profile.avatarSeed}
            style={profile.avatarStyle}
            size={34}
            className="!rounded-none"
          />
        )}
        <div className="flex flex-col items-start">
          <div className="text-[13px] font-bold">
            {(profile?.username || account?.name) ?? "Wallet"} ▾
          </div>
          {account && (
            <div
              className="cursor-pointer text-[11px] text-[var(--av-text-2)] hover:text-[var(--av-text)]"
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
      <Pill onClick={() => setNetOpen((v) => !v)} className="border-[var(--av-text)]">
        {NETWORKS[s.networkId].name} ▾
      </Pill>
      {menuOpen && <AccountSwitcher onClose={() => setMenuOpen(false)} />}
      {netOpen && (
        <Box className="absolute top-[48px] right-4 z-10 w-[120px] bg-white">
          {(["fuji", "mainnet"] as const).map((id) => (
            <button
              key={id}
              className="block w-full cursor-pointer border-b-2 border-[var(--av-divider)] px-3 py-2 text-left text-[11px] last:border-b-0"
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
  );

  return (
    <AppLayout header={header} showBottomNav activeTab="home">
      <div className="flex flex-col gap-6 px-5 py-5">
        {/* hero balance card */}
        <div className="flex flex-col items-center gap-[6px] rounded-none bg-[var(--av-bg-2)] p-5">
          <Mascot size={48} className="mb-[2px]" />
          <div className="text-[30px] leading-[1.1] font-extrabold tracking-tight">
            {fmtUsd(totalUsd)}
          </div>
          <button
            className="mt-[2px] flex cursor-pointer items-center gap-[6px] rounded-full bg-[var(--av-red-tint)] px-3 py-[5px]"
            onClick={() => s.navigate({ name: "privacy" })}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--av-red)"
              strokeWidth="2.5"
            >
              <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-[11px] font-semibold text-[var(--av-red)]">
              Your wallet is protected.
            </span>
          </button>
          <div className="mt-4 flex w-full gap-3">
            <button
              className="h-11 flex-1 cursor-pointer rounded-none bg-[var(--av-red)] text-[13px] font-semibold text-white hover:bg-[var(--av-red-hover)] active:bg-[var(--av-red-press)]"
              onClick={() => s.navigate({ name: "send" })}
            >
              Send
            </button>
            <button
              className="h-11 flex-1 cursor-pointer rounded-none border border-[var(--av-text)] text-[13px] font-semibold hover:bg-[var(--av-red-tint)]"
              onClick={() => s.navigate({ name: "receive" })}
            >
              Receive
            </button>
          </div>
        </div>

        {needsFujiFaucet && (
          <Box className="p-3">
            <Hd>Get Test AVAX</Hd>
            <Lbl className="mt-1 block">
              Your wallet needs Fuji test AVAX to start sending transactions.
            </Lbl>
            <button
              className="mt-2 w-full cursor-pointer rounded-none bg-[var(--av-red)] py-[10px] text-[12px] font-semibold text-white hover:bg-[var(--av-red-hover)]"
              onClick={requestTestAvax}
            >
              Request Test AVAX
            </button>
          </Box>
        )}

        {/* assets */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="pb-[10px] text-[12px] font-bold tracking-[0.06em] text-[var(--av-text-2)] uppercase">
            Assets
          </div>
          <div className="flex flex-col">
            {assets.map((a) => (
              <button
                key={a.symbol}
                className="flex cursor-pointer items-center justify-between border-b-2 border-[var(--av-divider)] py-[10px] text-left last:border-b-0"
                onClick={() => s.navigate({ name: "token", symbol: a.symbol })}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-[var(--av-bg-2)] text-[10.5px] font-bold">
                    {a.symbol.slice(0, 4)}
                  </div>
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-[13.5px] font-semibold">{a.symbol}</span>
                    <span className="text-[11.5px] text-[var(--av-text-2)]">
                      {a.units.toFixed(4)} {a.symbol}
                    </span>
                  </div>
                </div>
                <span className="text-[13.5px] font-semibold">{fmtUsd(a.usd)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
