"use client";
// 02 · Assets Screen + 03 · Token Details
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { ActivityRow } from "@/components/screens/Activity";
import { Box, Btn, Circ, Divider, DividerL, Hd, Lbl, Ph, Pill } from "@/components/ui";
import { fmtUnits, fmtUsd } from "@/lib/format";
import { useWallet } from "@/store/wallet";

interface AssetRowProps {
  symbol: string;
  sub: string;
  badge: "Public" | "Shielded";
  usd: string;
  onOpen: () => void;
  menu: { label: string; action: () => void }[];
}

function AssetRow({ symbol, sub, badge, usd, onOpen, menu }: AssetRowProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Box className="flex items-center gap-[10px] p-[10px]">
        <button
          className="flex flex-1 cursor-pointer items-center gap-[10px] text-left"
          onClick={onOpen}
        >
          <Circ size={28} ph />
          <div className="flex-1">
            <div className="text-[12px] font-bold">{symbol}</div>
            <Lbl>{sub}</Lbl>
          </div>
        </button>
        <Pill className="text-[8px]">{badge}</Pill>
        <div className="w-10 text-right text-[11px]">{usd}</div>
        <button className="cursor-pointer text-[14px]" onClick={() => setOpen((v) => !v)}>
          ⋮
        </button>
      </Box>
      {open && (
        <Box className="absolute top-full right-0 z-10 w-[110px] bg-white">
          {menu.map((m) => (
            <button
              key={m.label}
              className="block w-full cursor-pointer border-b border-[#eee] px-3 py-2 text-left text-[10px] last:border-b-0"
              onClick={() => {
                setOpen(false);
                m.action();
              }}
            >
              {m.label}
            </button>
          ))}
        </Box>
      )}
    </div>
  );
}

export function Assets() {
  const s = useWallet();
  const nav = s.navigate;

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 py-[14px]">
        <Hd>Assets</Hd>
      </div>
      <Divider />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="px-4 pt-[10px]">
          <Lbl>Public Assets</Lbl>
        </div>
        <div className="flex flex-col gap-2 px-4 py-2">
          <AssetRow
            symbol="AVAX"
            sub={`${fmtUnits(s.nativeBalance, 18)} AVAX`}
            badge="Public"
            usd={fmtUsd((Number(s.nativeBalance) / 1e18) * s.avaxPrice)}
            onOpen={() => nav({ name: "token", symbol: "AVAX", shielded: false })}
            menu={[
              { label: "Send", action: () => nav({ name: "send", symbol: "AVAX" }) },
              { label: "Shield", action: () => nav({ name: "shield", symbol: "AVAX" }) },
              { label: "Receive", action: () => nav({ name: "receive" }) },
            ]}
          />
          {s.tokens.map((t) => (
            <AssetRow
              key={t.symbol}
              symbol={t.symbol}
              sub={`${fmtUnits(t.balance, t.decimals)} ${t.symbol}`}
              badge="Public"
              usd={fmtUsd(t.usdValue)}
              onOpen={() => nav({ name: "token", symbol: t.symbol, shielded: false })}
              menu={[
                { label: "Shield", action: () => nav({ name: "shield", symbol: t.symbol }) },
                { label: "Receive", action: () => nav({ name: "receive" }) },
              ]}
            />
          ))}
        </div>
        <DividerL />
        <div className="px-4 pt-[10px]">
          <Lbl>Shielded Assets</Lbl>
        </div>
        <div className="flex flex-1 flex-col gap-2 px-4 py-2">
          {s.shielded.map((b) => (
            <AssetRow
              key={b.symbol}
              symbol={b.symbol}
              sub="•••• shielded"
              badge="Shielded"
              usd="••"
              onOpen={() => nav({ name: "token", symbol: b.symbol, shielded: true })}
              menu={[
                { label: "Send", action: () => nav({ name: "send", symbol: b.symbol }) },
                { label: "Unshield", action: () => nav({ name: "unshield", symbol: b.symbol }) },
              ]}
            />
          ))}
          <Ph className="cursor-pointer p-4 text-center">
            <button className="w-full cursor-pointer" onClick={() => nav({ name: "shield" })}>
              <Lbl>+ Shield a public asset</Lbl>
            </button>
          </Ph>
        </div>
      </div>
      <BottomNav active="assets" />
    </div>
  );
}

export function TokenDetails({ symbol, shielded }: { symbol: string; shielded: boolean }) {
  const s = useWallet();
  const nav = s.navigate;

  const shieldedBal = s.shielded.find((b) => b.symbol === symbol);
  const token = s.tokens.find((t) => t.symbol === symbol);
  const balanceLabel = shielded
    ? `•••• ${symbol}`
    : symbol === "AVAX"
      ? `${fmtUnits(s.nativeBalance, 18)} AVAX`
      : `${fmtUnits(token?.balance ?? 0n, token?.decimals ?? 18)} ${symbol}`;

  const history = shielded
    ? s.shieldedActivity.filter((t) => t.symbol === symbol || `e${t.symbol}` === symbol)
    : s.history.filter((t) => t.symbol === symbol);

  const underlying = shielded ? (shieldedBal?.underlyingSymbol ?? symbol.slice(1)) : symbol;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 py-[14px]">
        <button
          className="cursor-pointer text-[11px] text-[#777]"
          onClick={() => nav({ name: "assets" })}
        >
          ←
        </button>
        <Hd>{symbol}</Hd>
      </div>
      <Divider />
      <div className="p-[18px] text-center">
        <Circ size={40} ph className="mx-auto mb-2" />
        <div className="text-[22px] font-bold">{balanceLabel}</div>
        <Pill className="mt-[6px] inline-block">{shielded ? "Shielded" : "Public"}</Pill>
      </div>
      <DividerL />
      <div className="flex gap-2 px-4 py-3">
        <Btn className="flex-1" onClick={() => nav({ name: "shield", symbol: underlying })}>
          Shield
        </Btn>
        <Btn
          className="flex-1"
          disabled={!shielded && !s.shielded.some((b) => b.underlyingSymbol === symbol)}
          onClick={() => nav({ name: "unshield", symbol: shielded ? symbol : `e${symbol}` })}
        >
          Unshield
        </Btn>
        <Btn className="flex-1" onClick={() => nav({ name: "send", symbol })}>
          Send
        </Btn>
        <Btn className="flex-1" onClick={() => nav({ name: "receive" })}>
          Receive
        </Btn>
      </div>
      <DividerL />
      <div className="px-4 pt-3 pb-1">
        <Hd>Transaction History</Hd>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-4">
        {history.length === 0 && <Lbl className="py-2">No transactions</Lbl>}
        {history.map((tx) => (
          <ActivityRow key={tx.hash} tx={tx} expandable />
        ))}
      </div>
      <BottomNav active="assets" />
    </div>
  );
}
