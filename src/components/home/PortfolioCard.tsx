"use client";
import { Mascot } from "@/components/ui";
import { env } from "@/config/env";
import { fmtUsd } from "@/lib/format";
import { useWallet } from "@/store/wallet";

export function PortfolioCard({ totalUsd }: { totalUsd: number }) {
  const s = useWallet();

  return (
    <div className="flex flex-col items-center gap-[6px] rounded-[24px] bg-[var(--av-bg-2)] p-6">
      <Mascot size={36} className="mb-1 opacity-80" />
      <div className="text-[32px] leading-[1.1] font-extrabold tracking-tight">
        {fmtUsd(totalUsd)}
      </div>
      {env.featureConfidentialTransfers && (
        <button
          className="mt-1 flex cursor-pointer items-center gap-[6px] rounded-full bg-[var(--av-red-tint)] px-3 py-[5px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--av-red)]"
          onClick={() => s.navigate({ name: "privacy" })}
          aria-label="View privacy protection status"
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
      )}
      <div className="mt-5 flex w-full gap-3">
        <button
          className="h-12 flex-1 cursor-pointer rounded-[16px] bg-[var(--av-red)] text-[15px] font-semibold text-white transition-colors outline-none hover:bg-[var(--av-red-hover)] focus-visible:ring-2 focus-visible:ring-[var(--av-red)] focus-visible:ring-offset-2 active:bg-[var(--av-red-press)]"
          onClick={() => s.navigate({ name: "send" })}
          aria-label="Send assets"
        >
          Send
        </button>
        <button
          className="h-12 flex-1 cursor-pointer rounded-[16px] border border-[var(--av-text)] text-[15px] font-semibold transition-colors outline-none hover:bg-[var(--av-red-tint)] focus-visible:ring-2 focus-visible:ring-[var(--av-red)] focus-visible:ring-offset-2"
          onClick={() => s.navigate({ name: "receive" })}
          aria-label="Receive assets"
        >
          Receive
        </button>
      </div>
    </div>
  );
}
