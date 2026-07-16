"use client";
// 02 · Assets Screen + 03 · Token Details
// One portfolio — public + confidential balances are merged per token.
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { ActivityRow, isInternalOp } from "@/components/screens/Activity";
import { Box, Btn, Circ, Divider, DividerL, Hd, Lbl } from "@/components/ui";
import { fmtUsd } from "@/lib/format";
import { useWallet } from "@/store/wallet";

interface AssetRowProps {
  symbol: string;
  sub: string;
  usd: string;
  onOpen: () => void;
  menu: { label: string; action: () => void }[];
}

function AssetRow({ symbol, sub, usd, onOpen, menu }: AssetRowProps) {
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
        <div className="w-14 text-right text-[11px]">{usd}</div>
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

/** Merge public + confidential balances into one row per token. */
export function useMergedAssets() {
  const s = useWallet();
  const rows = new Map<string, { units: number; usd: number; decimals: number }>();
  rows.set("AVAX", {
    units: Number(s.nativeBalance) / 1e18,
    usd: (Number(s.nativeBalance) / 1e18) * s.avaxPrice,
    decimals: 18,
  });
  for (const t of s.tokens) {
    rows.set(t.symbol, {
      units: Number(t.balance) / 10 ** t.decimals,
      usd: t.usdValue,
      decimals: t.decimals,
    });
  }
  for (const b of s.shielded) {
    const prev = rows.get(b.underlyingSymbol);
    const units = Number(b.balance) / 10 ** b.decimals;
    rows.set(b.underlyingSymbol, {
      units: (prev?.units ?? 0) + units,
      usd: (prev?.usd ?? 0) + b.usdValue,
      decimals: prev?.decimals ?? b.decimals,
    });
  }
  return [...rows.entries()].map(([symbol, r]) => ({ symbol, ...r }));
}

export function Assets() {
  const s = useWallet();
  const nav = s.navigate;
  const assets = useMergedAssets();

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 py-[14px]">
        <Hd>Assets</Hd>
      </div>
      <Divider />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {assets.map((a) => (
          <AssetRow
            key={a.symbol}
            symbol={a.symbol}
            sub={`${a.units.toFixed(4)} ${a.symbol}`}
            usd={fmtUsd(a.usd)}
            onOpen={() => nav({ name: "token", symbol: a.symbol })}
            menu={[
              { label: "Send", action: () => nav({ name: "send", symbol: a.symbol }) },
              { label: "Receive", action: () => nav({ name: "receive" }) },
            ]}
          />
        ))}
      </div>
      <BottomNav active="assets" />
    </div>
  );
}

export function TokenDetails({ symbol }: { symbol: string }) {
  const s = useWallet();
  const nav = s.navigate;
  const asset = useMergedAssets().find((a) => a.symbol === symbol);

  const history = [...s.shieldedActivity, ...s.history]
    .filter((t) => !isInternalOp(t))
    .filter((t) => t.symbol === symbol || t.symbol === `e${symbol}`)
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 py-[14px]">
        <button
          className="cursor-pointer text-[13px] text-[#888]"
          onClick={() => nav({ name: "assets" })}
        >
          ←
        </button>
        <Hd>{symbol}</Hd>
      </div>
      <Divider />
      <div className="p-[18px] text-center">
        <Circ size={40} ph className="mx-auto mb-2" />
        <div className="text-[22px] font-bold">
          {(asset?.units ?? 0).toFixed(4)} {symbol}
        </div>
        <Lbl className="mt-[6px]">{fmtUsd(asset?.usd ?? 0)}</Lbl>
      </div>
      <DividerL />
      <div className="flex gap-2 px-4 py-3">
        <Btn primary className="flex-1" onClick={() => nav({ name: "send", symbol })}>
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
