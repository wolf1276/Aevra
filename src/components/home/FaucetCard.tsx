"use client";
import { Hd } from "@/components/ui";
import { useWallet } from "@/store/wallet";

export function FaucetCard() {
  const s = useWallet();
  const account = s.accounts[s.activeIndex];

  const requestTestAvax = () => {
    window.open("https://core.app/tools/testnet-faucet/?subnet=c&token=c", "_blank");
    if (account) void navigator.clipboard.writeText(account.address);
    s.showToast("Wallet address copied. Paste it into the faucet.");
  };

  return (
    <div className="rounded-[20px] border border-[var(--av-divider)] p-4">
      <Hd className="text-[15px]">Get Test AVAX</Hd>
      <div className="mt-1 text-[13px] text-[var(--av-text-2)]">
        Your wallet needs Fuji test AVAX to start sending transactions.
      </div>
      <button
        className="mt-3 w-full cursor-pointer rounded-[14px] bg-[var(--av-red)] py-[10px] text-[13px] font-semibold text-white outline-none hover:bg-[var(--av-red-hover)] focus-visible:ring-2 focus-visible:ring-[var(--av-red)] focus-visible:ring-offset-2"
        onClick={requestTestAvax}
        aria-label="Request test AVAX from faucet"
      >
        Request Test AVAX
      </button>
    </div>
  );
}
