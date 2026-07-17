"use client";
// 13 · Privacy & Security (reached via Settings or the Protected pill)
import { useEffect, useState } from "react";

import { Box, Circ, DividerL, Hd, Header, Lbl, timeAgo } from "@/components/ui";
import { shieldProvider, useWallet } from "@/store/wallet";

export function Privacy() {
  const s = useWallet();
  const account = s.accounts[s.activeIndex];
  const [viewerKey, setViewerKey] = useState("");

  useEffect(() => {
    if (!account) return;
    setViewerKey("");
    shieldProvider
      .getViewingKey(account.address)
      .then(setViewerKey)
      .catch(() => setViewerKey("Unavailable — try again later"));
  }, [account]);

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Privacy & Security" onBack={() => s.navigate({ name: "settings" })} />
      <div className="p-4 text-center">
        <Circ
          size={72}
          className="mx-auto my-2 border-none bg-[var(--av-red-tint)] text-[24px] text-[var(--av-red)] shadow-[0_0_0_8px_var(--av-glow)]"
        >
          ✓
        </Circ>
        <div className="text-[15px] font-bold">Protected</div>
        <Lbl className="mt-1">All transfers are private by default</Lbl>
      </div>
      <DividerL />
      <div className="px-4 pt-3 pb-1">
        <Hd>Viewer Keys</Hd>
      </div>
      <div className="px-4">
        <Box className="my-1 p-3">
          <Lbl>Viewer key for {account?.name}</Lbl>
          <div className="mt-1 text-[10px] break-all">{viewerKey}</div>
          <button
            className="mt-2 cursor-pointer rounded-[10px] border border-[var(--av-border)] px-3 py-1 text-[9px] font-bold uppercase hover:bg-[var(--av-red-tint)]"
            onClick={() => {
              void navigator.clipboard.writeText(viewerKey);
              s.showToast("Viewer key copied");
            }}
          >
            Copy
          </button>
        </Box>
      </div>
      <DividerL />
      <div className="px-4 pt-3 pb-1">
        <Hd>Selective Disclosure</Hd>
      </div>
      <div className="flex-1 overflow-y-auto px-4">
        {s.reveals.length === 0 && <Lbl className="py-2">Nothing disclosed yet</Lbl>}
        {s.reveals.slice(0, 3).map((r) => (
          <div
            key={r.id}
            className="flex justify-between border-b border-[var(--av-divider)] py-2 text-[11px]"
          >
            <div>{r.description}</div>
            <Lbl>{timeAgo(r.timestamp)}</Lbl>
          </div>
        ))}
        <button
          className="mt-3 w-full cursor-pointer rounded-[12px] border border-[var(--av-border)] py-2 text-[10px] font-bold hover:bg-[var(--av-red-tint)]"
          onClick={() => s.navigate({ name: "backup" })}
        >
          Recovery Phrase →
        </button>
      </div>
    </div>
  );
}
