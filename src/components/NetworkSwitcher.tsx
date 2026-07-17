"use client";
import { useState } from "react";

import { Box, Pill } from "@/components/ui";
import { NETWORKS, useWallet } from "@/store/wallet";

const NETWORK_IDS = ["fuji", "mainnet"] as const;

export function NetworkSwitcher({ variant }: { variant: "dropdown" | "segmented" }) {
  const s = useWallet();
  const [open, setOpen] = useState(false);

  if (variant === "segmented") {
    return (
      <div className="flex gap-2 py-[6px]">
        {NETWORK_IDS.map((id) => (
          <button
            key={id}
            onClick={() => s.setNetwork(id)}
            className={`flex-1 cursor-pointer rounded-none border p-2 text-center text-[10px] capitalize ${
              s.networkId === id
                ? "border-[var(--av-red)] bg-[var(--av-red)] text-white"
                : "border-[var(--av-text)]"
            }`}
          >
            {NETWORKS[id].name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <Pill onClick={() => setOpen((v) => !v)} className="border-[var(--av-text)]">
        {NETWORKS[s.networkId].name} ▾
      </Pill>
      {open && (
        <Box className="absolute top-[48px] right-4 z-10 w-[120px] bg-white">
          {NETWORK_IDS.map((id) => (
            <button
              key={id}
              className="block w-full cursor-pointer border-b-2 border-[var(--av-divider)] px-3 py-2 text-left text-[11px] last:border-b-0"
              onClick={() => {
                s.setNetwork(id);
                setOpen(false);
              }}
            >
              {NETWORKS[id].name} {id === s.networkId && "✓"}
            </button>
          ))}
        </Box>
      )}
    </>
  );
}
