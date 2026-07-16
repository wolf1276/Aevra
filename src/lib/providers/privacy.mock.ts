// Mock Privacy layer — score, reveals, proofs. Same interface a real
// eERC viewer-key implementation would satisfy.

import { NETWORKS } from "@/config/networks";
import { storageGet, storageSet } from "@/lib/storage";

import { portfolioProvider } from "./portfolio";
import { markRevealed, randomProofId, shieldProvider } from "./shield.mock";
import type { PrivacyProvider, PrivacyStats, RevealRecord } from "./types";

const KEY = (addr: string) => `aevra.privacy.${addr.toLowerCase()}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadReveals(address: string): Promise<RevealRecord[]> {
  const raw = await storageGet(KEY(address));
  return raw ? (JSON.parse(raw) as RevealRecord[]) : [];
}

export class MockPrivacyProvider implements PrivacyProvider {
  async getStats(address: string): Promise<PrivacyStats> {
    const [shielded, native, price] = await Promise.all([
      shieldProvider.getShieldedBalances(address),
      portfolioProvider.getNativeBalance(address, NETWORKS.fuji).catch(() => 0n),
      portfolioProvider.getAvaxUsdPrice(),
    ]);
    const shieldedUsd = shielded.reduce((s, b) => s + b.usdValue, 0);
    const publicUsd = (Number(native) / 1e18) * price;
    const total = shieldedUsd + publicUsd;
    const shieldedPct = total > 0 ? Math.round((shieldedUsd / total) * 100) : 0;
    const publicAvax = Number(native) / 1e18;
    return {
      score: shieldedPct,
      shieldedPct,
      publicPct: 100 - shieldedPct,
      recommendation:
        publicAvax > 0.001
          ? `Shield your remaining ${publicAvax.toFixed(2)} AVAX to reach 100% privacy`
          : null,
    };
  }

  async getReveals(address: string): Promise<RevealRecord[]> {
    return loadReveals(address);
  }

  async revealTransaction(address: string, txHash: string): Promise<RevealRecord> {
    await sleep(800); // simulated viewer-key decryption
    const tx = await markRevealed(address, txHash);
    const record: RevealRecord = {
      id: randomProofId(),
      description: `Revealed ${tx?.symbol ?? "shielded"} tx to viewer`,
      timestamp: Date.now(),
    };
    const reveals = await loadReveals(address);
    reveals.unshift(record);
    await storageSet(KEY(address), JSON.stringify(reveals));
    return record;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateProof(_address: string, _txHash: string): Promise<{ proofId: string }> {
    await sleep(1500); // simulated ZK proof generation
    return { proofId: randomProofId() };
  }
}

export const privacyProvider = new MockPrivacyProvider();
