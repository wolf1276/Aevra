// Mock Shield layer. Persists state so the experience feels real across
// popup opens. Swap for a real eERC implementation later — same interface.

import { storageGet, storageSet } from "@/lib/storage";

import type {
  ShieldedBalance,
  ShieldProgress,
  ShieldProvider,
  ShieldResult,
  TxRecord,
} from "./types";

const KEY = (addr: string) => `aevra.shield.${addr.toLowerCase()}`;

interface ShieldState {
  balances: Record<string, string>; // eSymbol -> bigint string
  activity: TxRecord[];
}

const TOKEN_META: Record<string, { decimals: number; usdPerUnit: number }> = {
  eAVAX: { decimals: 18, usdPerUnit: 25 },
  eUSDC: { decimals: 6, usdPerUnit: 1 },
  eWAVAX: { decimals: 18, usdPerUnit: 25 },
};

export const randomHash = () =>
  "0x" +
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

export const randomProofId = () =>
  "proof_" +
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadState(address: string): Promise<ShieldState> {
  const raw = await storageGet(KEY(address));
  return raw ? (JSON.parse(raw) as ShieldState) : { balances: {}, activity: [] };
}

async function saveState(address: string, state: ShieldState): Promise<void> {
  await storageSet(KEY(address), JSON.stringify(state));
}

/** Simulated proof generation + submission with progress callbacks. */
async function runFlow(onProgress?: (p: ShieldProgress) => void): Promise<void> {
  onProgress?.({ step: "preparing", percent: 10 });
  await sleep(600);
  onProgress?.({ step: "generating-proof", percent: 35 });
  await sleep(1400);
  onProgress?.({ step: "generating-proof", percent: 70 });
  await sleep(900);
  onProgress?.({ step: "submitting", percent: 90 });
  await sleep(700);
  onProgress?.({ step: "done", percent: 100 });
}

export class MockShieldProvider implements ShieldProvider {
  async getShieldedBalances(address: string): Promise<ShieldedBalance[]> {
    const state = await loadState(address);
    return Object.entries(state.balances)
      .filter(([, v]) => BigInt(v) > 0n)
      .map(([symbol, v]) => {
        const meta = TOKEN_META[symbol] ?? { decimals: 18, usdPerUnit: 0 };
        const balance = BigInt(v);
        return {
          symbol,
          underlyingSymbol: symbol.slice(1),
          decimals: meta.decimals,
          balance,
          usdValue: (Number(balance) / 10 ** meta.decimals) * meta.usdPerUnit,
        };
      });
  }

  async shield(
    address: string,
    symbol: string,
    amount: bigint,
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult> {
    await runFlow(onProgress);
    const eSymbol = `e${symbol}`;
    const state = await loadState(address);
    state.balances[eSymbol] = (BigInt(state.balances[eSymbol] ?? "0") + amount).toString();
    const result = { txHash: randomHash(), proofId: randomProofId() };
    const meta = TOKEN_META[eSymbol] ?? { decimals: 18, usdPerUnit: 0 };
    state.activity.unshift({
      hash: result.txHash,
      type: "shield",
      symbol,
      amount: (Number(amount) / 10 ** meta.decimals).toFixed(4),
      timestamp: Date.now(),
      visibility: "shielded",
      status: "confirmed",
      proofId: result.proofId,
    });
    await saveState(address, state);
    return result;
  }

  async unshield(
    address: string,
    symbol: string,
    amount: bigint,
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult> {
    const eSymbol = symbol.startsWith("e") ? symbol : `e${symbol}`;
    const state = await loadState(address);
    const bal = BigInt(state.balances[eSymbol] ?? "0");
    if (amount > bal) throw new Error("Insufficient shielded balance");
    await runFlow(onProgress);
    state.balances[eSymbol] = (bal - amount).toString();
    const result = { txHash: randomHash(), proofId: randomProofId() };
    const meta = TOKEN_META[eSymbol] ?? { decimals: 18, usdPerUnit: 0 };
    state.activity.unshift({
      hash: result.txHash,
      type: "unshield",
      symbol: eSymbol.slice(1),
      amount: (Number(amount) / 10 ** meta.decimals).toFixed(4),
      timestamp: Date.now(),
      visibility: "shielded",
      status: "confirmed",
      proofId: result.proofId,
    });
    await saveState(address, state);
    return result;
  }

  async shieldedSend(
    address: string,
    symbol: string,
    amount: bigint,
    to: string,
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult> {
    const eSymbol = symbol.startsWith("e") ? symbol : `e${symbol}`;
    const state = await loadState(address);
    const bal = BigInt(state.balances[eSymbol] ?? "0");
    if (amount > bal) throw new Error("Insufficient shielded balance");
    await runFlow(onProgress);
    state.balances[eSymbol] = (bal - amount).toString();
    const result = { txHash: randomHash(), proofId: randomProofId() };
    state.activity.unshift({
      hash: result.txHash,
      type: "shielded-send",
      symbol: eSymbol,
      amount: "••••", // confidential — amount hidden until revealed
      timestamp: Date.now(),
      visibility: "shielded",
      to,
      status: "confirmed",
      proofId: result.proofId,
    });
    await saveState(address, state);
    return result;
  }

  async getShieldedActivity(address: string): Promise<TxRecord[]> {
    return (await loadState(address)).activity;
  }
}

/** Mark a shielded tx as revealed (used by the privacy provider). */
export async function markRevealed(address: string, txHash: string): Promise<TxRecord | null> {
  const state = await loadState(address);
  const tx = state.activity.find((t) => t.hash === txHash);
  if (!tx) return null;
  tx.revealed = true;
  await saveState(address, state);
  return tx;
}

export const shieldProvider = new MockShieldProvider();
