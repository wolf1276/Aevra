"use client";
// Shared account switcher — used from the Home header. Phantom/Rabby-style:
// name, short address, copy, live balance, active indicator, rename/add/remove.
import { useEffect, useState } from "react";

import { Avatar, Box, shortAddr } from "@/components/ui";
import { fmtUnits } from "@/lib/format";
import type { Account } from "@/lib/providers/types";
import { NETWORKS, portfolioProvider, profileFor, useWallet } from "@/store/wallet";

export function AccountSwitcher({ onClose }: { onClose: () => void }) {
  const s = useWallet();
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    const network = NETWORKS[s.networkId];
    let cancelled = false;
    void Promise.all(
      s.accounts.map(async (a) => {
        const bal = await portfolioProvider.getNativeBalance(a.address, network).catch(() => 0n);
        return [a.address, bal] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setBalances(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.accounts.length, s.networkId]);

  const copy = (addr: string) => {
    void navigator.clipboard.writeText(addr);
    s.showToast("Address copied");
  };

  const startRename = (a: Account) => {
    setRenaming(a.index);
    setRenameValue(a.name);
  };

  const commitRename = async () => {
    if (renaming === null) return;
    const name = renameValue.trim();
    if (name) await s.renameAccount(renaming, name);
    setRenaming(null);
  };

  const canRemoveLast = s.accounts.length > 1;
  const lastIndex = s.accounts.length - 1;

  return (
    <Box className="absolute top-[48px] left-4 z-10 w-[260px] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      <div className="max-h-[280px] overflow-y-auto">
        {s.accounts.map((a) => {
          const active = a.index === s.activeIndex;
          const profile = profileFor(s.profiles, a.address);
          return (
            <div
              key={a.index}
              className={`border-b border-[#eee] px-3 py-2 ${active ? "bg-[#f2f2f2]" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                  onClick={() => {
                    s.setActiveIndex(a.index);
                    onClose();
                  }}
                >
                  <Avatar seed={profile.avatarSeed} style={profile.avatarStyle} size={24} />
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    {renaming === a.index ? (
                      <input
                        autoFocus
                        className="w-full rounded-[6px] border border-[#ccc] px-1 py-[1px] text-[11px] font-bold outline-none"
                        value={renameValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void commitRename();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        {profile.username || a.name}
                        {active && <span aria-label="active account">●</span>}
                      </div>
                    )}
                    <div className="text-[9px] text-[#888]">
                      {fmtUnits(balances[a.address] ?? 0n, 18)} {NETWORKS[s.networkId].nativeSymbol}
                    </div>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className="cursor-pointer text-[9px] text-[#888] hover:text-[#111]"
                    onClick={() => startRename(a)}
                    aria-label={`Rename ${a.name}`}
                  >
                    ✎
                  </button>
                  <button
                    className="cursor-pointer text-[9px] text-[#888] hover:text-[#111]"
                    onClick={() => copy(a.address)}
                    aria-label={`Copy address for ${a.name}`}
                  >
                    {shortAddr(a.address)} ⧉
                  </button>
                </div>
              </div>
              {canRemoveLast && a.index === lastIndex && (
                <button
                  className="mt-1 cursor-pointer text-[9px] text-[#b00]"
                  onClick={() => void s.removeLastAccount()}
                >
                  Remove account
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        className="block w-full cursor-pointer border-b border-[#eee] px-3 py-2 text-left text-[11px]"
        onClick={() => void s.addAccount()}
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
  );
}
