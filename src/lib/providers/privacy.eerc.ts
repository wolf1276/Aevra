// Real Privacy layer backed by eERC. Reveals decrypt actual on-chain
// transactions with the user's viewing key (SDK decryptTransaction).
//
// Note on proofs: the eERC SDK does not expose standalone disclosure-proof
// artifacts — ZK proofs are embedded in each transaction. `generateProof`
// therefore verifies the tx is decryptable with the user's key and returns
// the transaction hash as the disclosure artifact. Nothing is fabricated.

import { env } from "@/config/env";
import { NETWORKS, TRACKED_TOKENS } from "@/config/networks";
import { storageGet, storageSet } from "@/lib/storage";

import { portfolioProvider } from "./portfolio";
import { shieldProvider } from "./shield.eerc";
import type { NetworkInfo, PrivacyProvider, PrivacyStats, RevealRecord } from "./types";

const KEY = (addr: string) => `aevra.privacy.${addr.toLowerCase()}`;

async function loadReveals(address: string): Promise<RevealRecord[]> {
  const raw = await storageGet(KEY(address));
  return raw ? (JSON.parse(raw) as RevealRecord[]) : [];
}

export class EERCPrivacyProvider implements PrivacyProvider {
  private network: NetworkInfo = NETWORKS.fuji;

  setNetwork(network: NetworkInfo): void {
    this.network = network;
  }

  async getStats(address: string): Promise<PrivacyStats> {
    if (!env.featureConfidentialTransfers) {
      return { score: 0, shieldedPct: 0, publicPct: 100, recommendation: null };
    }
    const network = this.network;
    const [shielded, native, tokens, price] = await Promise.all([
      shieldProvider.getShieldedBalances(address).catch(() => []),
      portfolioProvider.getNativeBalance(address, network).catch(() => 0n),
      portfolioProvider.getTokenBalances(address, network).catch(() => []),
      portfolioProvider.getAvaxUsdPrice(),
    ]);
    const shieldedUsd = shielded.reduce((s, b) => s + b.usdValue, 0);
    const publicUsd = (Number(native) / 1e18) * price + tokens.reduce((s, t) => s + t.usdValue, 0);
    const total = shieldedUsd + publicUsd;
    const shieldedPct = total > 0 ? Math.round((shieldedUsd / total) * 100) : 0;
    const shieldable = tokens.filter(
      (t) => t.balance > 0n && TRACKED_TOKENS[network.id].some((s) => s.symbol === t.symbol),
    );
    return {
      score: shieldedPct,
      shieldedPct,
      publicPct: 100 - shieldedPct,
      recommendation:
        shieldable.length > 0
          ? `Shield your public ${shieldable.map((t) => t.symbol).join(", ")} to increase privacy`
          : null,
    };
  }

  async getReveals(address: string): Promise<RevealRecord[]> {
    return loadReveals(address);
  }

  async revealTransaction(address: string, txHash: string): Promise<RevealRecord> {
    // Real viewing-key decryption of the on-chain transaction.
    const events = await shieldProvider.decryptTransaction(address, txHash);
    const tx = await shieldProvider.markRevealed(address, txHash);
    const decrypted = events.find((e) => e.decryptedAmount);
    const record: RevealRecord = {
      id: txHash,
      description: decrypted
        ? `Revealed ${decrypted.eventType}: ${decrypted.decryptedAmount} ${tx?.symbol ?? ""}`
        : `Revealed ${tx?.symbol ?? "shielded"} tx ${txHash.slice(0, 10)}…`,
      timestamp: Date.now(),
    };
    const reveals = await loadReveals(address);
    reveals.unshift(record);
    await storageSet(KEY(address), JSON.stringify(reveals));
    return record;
  }

  async generateProof(address: string, txHash: string): Promise<{ proofId: string }> {
    // Verify decryptability with the user's key; the tx hash (which carries
    // the embedded Groth16 proof on-chain) is the shareable artifact.
    await shieldProvider.decryptTransaction(address, txHash);
    return { proofId: txHash };
  }
}

export const privacyProvider = new EERCPrivacyProvider();
