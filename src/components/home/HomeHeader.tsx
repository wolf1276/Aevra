"use client";
import { useState } from "react";

import { AccountSwitcher } from "@/components/AccountSwitcher";
import { Avatar, Popover, shortAddr } from "@/components/ui";
import { NETWORKS } from "@/config/networks";
import type { AvatarStyle } from "@/lib/avatar";
import type { NetworkId } from "@/lib/providers/types";
import { useWallet } from "@/store/wallet";

export function HomeHeader({
  name,
  address,
  avatarSeed,
  avatarStyle,
}: {
  name: string;
  address: string;
  avatarSeed: string;
  avatarStyle: AvatarStyle;
}) {
  const s = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [netOpen, setNetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    void navigator.clipboard.writeText(address);
    setCopied(true);
    s.showToast("Address copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative flex items-center justify-between px-5 py-4">
      <button
        className="flex cursor-pointer items-center gap-3 rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--av-red)]"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Switch account"
        aria-expanded={menuOpen}
      >
        <Avatar seed={avatarSeed} style={avatarStyle} size={38} className="!rounded-full" />
        <div className="flex flex-col items-start gap-[2px]">
          <div className="text-[15px] font-bold">{name} ▾</div>
          <span
            role="button"
            tabIndex={0}
            className="cursor-pointer text-[13px] text-[var(--av-text-2)] hover:text-[var(--av-text)]"
            onClick={(e) => {
              e.stopPropagation();
              copyAddress();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                copyAddress();
              }
            }}
            aria-label={`Copy address ${address}`}
          >
            {shortAddr(address)} {copied ? "✓" : "⧉"}
          </span>
        </div>
      </button>

      <button
        className="cursor-pointer rounded-full border border-[var(--av-text)] px-3 py-[6px] text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--av-red)]"
        onClick={() => setNetOpen((v) => !v)}
        aria-label="Switch network"
        aria-expanded={netOpen}
      >
        {NETWORKS[s.networkId].name} ▾
      </button>

      {menuOpen && <AccountSwitcher onClose={() => setMenuOpen(false)} />}

      <Popover open={netOpen} onClose={() => setNetOpen(false)} align="right">
        {(["fuji", "mainnet"] as const).map((id) => (
          <button
            key={id}
            className="block w-full cursor-pointer border-b border-[var(--av-divider)] px-4 py-[10px] text-left text-[13px] first:rounded-t-[16px] last:rounded-b-[16px] last:border-b-0 hover:bg-[var(--av-bg-2)]"
            onClick={() => {
              s.setNetwork(id as NetworkId);
              setNetOpen(false);
            }}
          >
            {NETWORKS[id].name} {id === s.networkId && "✓"}
          </button>
        ))}
      </Popover>
    </div>
  );
}
