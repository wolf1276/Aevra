"use client";
import { TokenIcon } from "@/components/TokenIcon";
import { fmtUsd } from "@/lib/format";
import { useWallet } from "@/store/wallet";

interface AssetRow {
  symbol: string;
  units: number;
  usd: number;
}

export function AssetPreview({ assets }: { assets: AssetRow[] }) {
  const s = useWallet();
  const preview = assets.slice(0, 3);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-3">
        <div className="text-[13px] font-bold tracking-[0.06em] text-[var(--av-text-2)] uppercase">
          Assets
        </div>
        {assets.length > 3 && (
          <button
            className="cursor-pointer text-[13px] font-semibold text-[var(--av-red)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--av-red)]"
            onClick={() => s.navigate({ name: "assets" })}
            aria-label="View all assets"
          >
            View All Assets →
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {preview.map((a) => (
          <button
            key={a.symbol}
            className="flex cursor-pointer items-center justify-between rounded-[16px] py-[10px] text-left outline-none hover:bg-[var(--av-bg-2)] focus-visible:ring-2 focus-visible:ring-[var(--av-red)]"
            onClick={() => s.navigate({ name: "token", symbol: a.symbol })}
            aria-label={`View ${a.symbol}, ${fmtUsd(a.usd)}`}
          >
            <div className="flex items-center gap-3">
              <TokenIcon symbol={a.symbol} size={36} />
              <div className="flex flex-col gap-[2px]">
                <span className="text-[15px] font-semibold">{a.symbol}</span>
                <span className="text-[13px] text-[var(--av-text-2)]">
                  {a.units.toFixed(4)} {a.symbol}
                </span>
              </div>
            </div>
            <span className="text-[15px] font-semibold">{fmtUsd(a.usd)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
