"use client";
// 01 · Home Dashboard
import { AppLayout } from "@/components/AppLayout";
import { AssetPreview } from "@/components/home/AssetPreview";
import { FaucetCard } from "@/components/home/FaucetCard";
import { HomeHeader } from "@/components/home/HomeHeader";
import { PortfolioCard } from "@/components/home/PortfolioCard";
import { useMergedAssets } from "@/components/screens/Assets";
import { DEFAULT_AVATAR_STYLE } from "@/lib/avatar";
import { profileFor, useWallet } from "@/store/wallet";

export function Home() {
  const s = useWallet();
  const account = s.accounts[s.activeIndex];
  const profile = account ? profileFor(s.profiles, account.address) : null;
  const assets = useMergedAssets();

  const totalUsd =
    (Number(s.nativeBalance) / 1e18) * s.avaxPrice +
    s.tokens.reduce((a, t) => a + t.usdValue, 0) +
    s.shielded.reduce((a, b) => a + b.usdValue, 0);

  // ponytail: fixed 0.01 AVAX gas-floor threshold, make configurable if other networks need it
  const needsFujiFaucet = s.networkId === "fuji" && Number(s.nativeBalance) / 1e18 < 0.01;

  const header = account && (
    <HomeHeader
      name={profile?.username || account.name}
      address={account.address}
      avatarSeed={profile?.avatarSeed ?? account.address}
      avatarStyle={profile?.avatarStyle ?? DEFAULT_AVATAR_STYLE}
    />
  );

  return (
    <AppLayout header={header} showBottomNav activeTab="home">
      <div className="flex flex-col gap-6 px-5 py-5">
        <PortfolioCard totalUsd={totalUsd} />
        {needsFujiFaucet && <FaucetCard />}
        <AssetPreview assets={assets} />
      </div>
    </AppLayout>
  );
}
