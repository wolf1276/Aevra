"use client";
// 08 · Privacy Center
import { BottomNav } from "@/components/BottomNav";
import { Box, Circ, Divider, DividerL, Hd, Lbl, Ph, timeAgo } from "@/components/ui";
import { useWallet } from "@/store/wallet";

export function Privacy() {
  const s = useWallet();
  const p = s.privacy;

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 py-[14px]">
        <Hd>Privacy Center</Hd>
      </div>
      <Divider />
      <div className="p-4 text-center">
        <Lbl>Privacy Score</Lbl>
        <Circ size={72} className="mx-auto my-2 text-[20px] font-bold">
          {p ? `${p.score}%` : "—"}
        </Circ>
        <div className="mt-[10px] flex gap-[10px]">
          <Box className="flex-1 p-2">
            <Lbl>Shielded</Lbl>
            <div className="text-[13px] font-bold">{p ? `${p.shieldedPct}%` : "—"}</div>
          </Box>
          <Box className="flex-1 p-2">
            <Lbl>Public</Lbl>
            <div className="text-[13px] font-bold">{p ? `${p.publicPct}%` : "—"}</div>
          </Box>
        </div>
      </div>
      <DividerL />
      <div className="px-4 pt-3 pb-1">
        <Hd>Recent Reveals</Hd>
      </div>
      <div className="px-4">
        {s.reveals.length === 0 && <Lbl className="py-2">No reveals yet</Lbl>}
        {s.reveals.slice(0, 3).map((r) => (
          <div key={r.id} className="flex justify-between border-b border-[#eee] py-2 text-[11px]">
            <div>{r.description}</div>
            <Lbl>{timeAgo(r.timestamp)}</Lbl>
          </div>
        ))}
      </div>
      <DividerL />
      <div className="flex-1 px-4 py-3">
        <Hd>Recommendations</Hd>
        {p?.recommendation ? (
          <Ph className="mt-2 cursor-pointer p-[10px]">
            <button
              className="w-full cursor-pointer text-left text-[10px] text-[#555]"
              onClick={() => s.navigate({ name: "shield" })}
            >
              {p.recommendation}
            </button>
          </Ph>
        ) : (
          <Lbl className="mt-2">You&apos;re fully shielded — nothing to improve</Lbl>
        )}
      </div>
      <BottomNav active="privacy" />
    </div>
  );
}
