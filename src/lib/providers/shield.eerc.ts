// Real Shield layer — Avalanche eERC Converter Mode via @avalabs/eerc-sdk.
// Lifecycle: approve ERC20 → deposit into Converter → encrypted balance →
// confidential transfer → withdraw back to the original ERC20.
// ZK proofs are generated client-side by the SDK (snarkjs); the proof is
// embedded in the transaction itself, so the tx hash IS the on-chain
// artifact — no separate proof IDs exist in eERC.

import { EERC } from "@avalabs/eerc-sdk";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  isAddress,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

import { env } from "@/config/env";
import { NETWORKS, TRACKED_TOKENS } from "@/config/networks";
import { storageGet, storageSet } from "@/lib/storage";

import { portfolioProvider } from "./portfolio";
import type {
  ShieldedBalance,
  ShieldProgress,
  ShieldProvider,
  ShieldResult,
  TxRecord,
} from "./types";
import { walletProvider } from "./wallet";

// ── Config ──────────────────────────────────────────────────────────────

const CIRCUITS = {
  register: {
    wasm: `${env.eercCircuitBase}/RegistrationCircuit.wasm`,
    zkey: `${env.eercCircuitBase}/RegistrationCircuit.groth16.zkey`,
  },
  transfer: {
    wasm: `${env.eercCircuitBase}/TransferCircuit.wasm`,
    zkey: `${env.eercCircuitBase}/TransferCircuit.groth16.zkey`,
  },
  mint: {
    wasm: `${env.eercCircuitBase}/MintCircuit.wasm`,
    zkey: `${env.eercCircuitBase}/MintCircuit.groth16.zkey`,
  },
  withdraw: {
    wasm: `${env.eercCircuitBase}/WithdrawCircuit.wasm`,
    zkey: `${env.eercCircuitBase}/WithdrawCircuit.groth16.zkey`,
  },
  // Burn circuit is standalone-mode only; never loaded in Converter Mode,
  // but the SDK's CircuitURLs type requires the entry.
  burn: {
    wasm: `${env.eercCircuitBase}/BurnCircuit.wasm`,
    zkey: `${env.eercCircuitBase}/BurnCircuit.groth16.zkey`,
  },
} as const;

/** ERC20s the Converter can shield. Native AVAX is NOT supported — the
 *  eERC Converter only accepts ERC-20 deposits (wrap to WAVAX first). */
export const SHIELDABLE_TOKENS = TRACKED_TOKENS.fuji;

// Persisted per-address state: real tx records + the eERC decryption key.
// The key is deterministically derived from a wallet signature (the SDK's
// own scheme), so persisting it only caches what the wallet can re-derive.
const KEY = (addr: string) => `aevra.eerc.${addr.toLowerCase()}`;

interface EercState {
  activity: TxRecord[];
  decryptionKey?: string;
}

async function loadState(address: string): Promise<EercState> {
  const raw = await storageGet(KEY(address));
  return raw ? (JSON.parse(raw) as EercState) : { activity: [] };
}

async function saveState(address: string, state: EercState): Promise<void> {
  await storageSet(KEY(address), JSON.stringify(state));
}

// ── Error normalization ─────────────────────────────────────────────────

function normalizeError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|4001/i.test(msg)) return new Error("Transaction rejected");
  if (/insufficient funds/i.test(msg)) return new Error("Insufficient AVAX for gas");
  if (/not registered/i.test(msg)) return new Error("eERC registration required");
  if (/reverted/i.test(msg)) return new Error("Transaction reverted");
  if (/fetch|network|timeout|ECONN/i.test(msg)) return new Error("Network error — check RPC");
  return e instanceof Error ? e : new Error(msg);
}

// ── Provider ────────────────────────────────────────────────────────────

interface Session {
  eerc: EERC;
  client: PublicClient;
  wallet: WalletClient;
  /** eERC internal decimals (encrypted balances use these, not the ERC20's). */
  eercDecimals: bigint;
  auditorPublicKey: bigint[];
  registered: boolean;
}

export class EERCConverterProvider implements ShieldProvider {
  private sessions = new Map<string, Session>();

  // ── lifecycle ──

  /** Build (or reuse) an initialized, registered eERC session for `address`. */
  private async initialize(address: string): Promise<Session> {
    if (!walletProvider.isUnlocked()) {
      this.reset(); // drop sessions holding signer accounts
      throw new Error("Wallet locked");
    }
    const cached = this.sessions.get(address.toLowerCase());
    if (cached) return cached;

    if (!isAddress(env.eercConverterAddress) || !isAddress(env.eercRegistrarAddress)) {
      throw new Error(
        "Converter unavailable — set NEXT_PUBLIC_EERC_CONVERTER_ADDRESS and NEXT_PUBLIC_EERC_REGISTRAR_ADDRESS",
      );
    }

    const fuji = NETWORKS.fuji;
    const account = privateKeyToAccount(walletProvider.getPrivateKeyFor(address));
    const client = createPublicClient({ chain: avalancheFuji, transport: http(fuji.rpcUrl) });
    const chainId = await client.getChainId();
    if (chainId !== fuji.chainId) throw new Error(`Network mismatch — RPC is chain ${chainId}`);
    const wallet = createWalletClient({
      account,
      chain: avalancheFuji,
      transport: http(fuji.rpcUrl),
    });

    const state = await loadState(address);
    const eerc = new EERC(
      client,
      wallet,
      env.eercConverterAddress as `0x${string}`,
      env.eercRegistrarAddress as `0x${string}`,
      true, // Converter Mode
      CIRCUITS,
      state.decryptionKey,
    );
    if (!eerc.isDecryptionKeySet) {
      state.decryptionKey = await eerc.generateDecryptionKey();
      await saveState(address, state);
    }

    const [rawDecimals, rawAuditorKey] = await Promise.all([
      client.readContract({
        address: env.eercConverterAddress as `0x${string}`,
        abi: eerc.encryptedErcAbi,
        functionName: "decimals",
      }),
      client.readContract({
        address: env.eercConverterAddress as `0x${string}`,
        abi: eerc.encryptedErcAbi,
        functionName: "auditorPublicKey",
      }),
    ]);

    const session: Session = {
      eerc,
      client,
      wallet,
      eercDecimals: BigInt(rawDecimals as number | bigint),
      auditorPublicKey: (rawAuditorKey as readonly bigint[]).map((v) => BigInt(v)),
      registered: false,
    };
    await this.registerUserIfNeeded(address, session);
    this.sessions.set(address.toLowerCase(), session);
    return session;
  }

  /** Register the user's BabyJubJub public key with the Registrar if absent. */
  private async registerUserIfNeeded(address: string, session: Session): Promise<void> {
    if (session.registered) return;
    const isRegistered = (await session.client.readContract({
      address: env.eercRegistrarAddress as `0x${string}`,
      abi: session.eerc.registrarAbi,
      functionName: "isUserRegistered",
      args: [address as `0x${string}`],
    })) as boolean;
    if (!isRegistered) {
      const { transactionHash } = await session.eerc.register();
      if (transactionHash) {
        await session.client.waitForTransactionReceipt({
          hash: transactionHash as `0x${string}`,
        });
      }
    }
    session.registered = true;
  }

  // ── helpers ──

  getSupportedAssets(): { symbol: string; address: string; decimals: number }[] {
    return SHIELDABLE_TOKENS.map(({ symbol, address, decimals }) => ({
      symbol,
      address,
      decimals,
    }));
  }

  private resolveToken(symbol: string): { symbol: string; address: string; decimals: number } {
    const plain = symbol.startsWith("e") ? symbol.slice(1) : symbol;
    if (plain === "AVAX") {
      throw new Error("AVAX can't be shielded directly — wrap to WAVAX first (ERC-20 only)");
    }
    const token = SHIELDABLE_TOKENS.find((t) => t.symbol === plain);
    if (!token) throw new Error(`Unsupported token: ${symbol}`);
    return token;
  }

  /** Read + decrypt the on-chain encrypted balance for one token. */
  private async readEncryptedBalance(
    session: Session,
    owner: string,
    tokenAddress: string,
  ): Promise<{ decrypted: bigint; encrypted: bigint[] }> {
    // Same shape the official useEncryptedBalance hook consumes:
    // [eGCT, nonce, amountPCTs, balancePCT, transactionIndex]
    const raw = (await session.client.readContract({
      address: env.eercConverterAddress as `0x${string}`,
      abi: session.eerc.encryptedErcAbi,
      functionName: "getBalanceFromTokenAddress",
      args: [owner as `0x${string}`, tokenAddress as `0x${string}`],
    })) as unknown[];
    const eGCT = raw[0] as { c1: { x: bigint; y: bigint }; c2: { x: bigint; y: bigint } };
    const amountPCTs = raw[2] as { pct: bigint[]; index: bigint }[];
    const balancePCT = raw[3] as bigint[];
    const decrypted = session.eerc.calculateTotalBalance(eGCT, [...amountPCTs], [...balancePCT]);
    if (decrypted === -1n) throw new Error("Encrypted balance failed integrity check");
    return {
      decrypted,
      encrypted: [eGCT.c1.x, eGCT.c1.y, eGCT.c2.x, eGCT.c2.y],
    };
  }

  private async approveERC20(
    session: Session,
    owner: string,
    tokenAddress: string,
    amount: bigint,
  ): Promise<void> {
    const allowance = await session.eerc.fetchUserApprove(owner, tokenAddress);
    if (allowance >= amount) return;
    const balance = (await session.client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner as `0x${string}`],
    })) as bigint;
    if (balance < amount) throw new Error("Insufficient balance");
    const hash = await session.wallet.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      args: [env.eercConverterAddress as `0x${string}`, amount],
      chain: avalancheFuji,
      account: session.wallet.account!,
    });
    const receipt = await session.client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Approval rejected");
  }

  private async confirm(session: Session, hash: `0x${string}`): Promise<void> {
    const receipt = await session.client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
  }

  private async record(address: string, tx: TxRecord): Promise<void> {
    const state = await loadState(address);
    state.activity.unshift(tx);
    await saveState(address, state);
  }

  private explorerUrl(hash: string): string {
    return `${NETWORKS.fuji.explorerUrl}/tx/${hash}`;
  }

  // ── ShieldProvider ──

  async getShieldedBalances(address: string): Promise<ShieldedBalance[]> {
    // Locked wallet (or unconfigured converter) → nothing to decrypt with.
    if (!walletProvider.isUnlocked() || !isAddress(env.eercConverterAddress)) return [];
    try {
      const session = await this.initialize(address);
      const avaxPrice = await portfolioProvider.getAvaxUsdPrice();
      const results = await Promise.all(
        SHIELDABLE_TOKENS.map(async (token) => {
          const { decrypted } = await this.readEncryptedBalance(session, address, token.address);
          if (decrypted <= 0n) return null;
          const units = Number(decrypted) / 10 ** Number(session.eercDecimals);
          return {
            symbol: `e${token.symbol}`,
            underlyingSymbol: token.symbol,
            decimals: Number(session.eercDecimals),
            balance: decrypted,
            usdValue: token.symbol === "USDC" ? units : units * avaxPrice,
          };
        }),
      );
      return results.filter((b): b is ShieldedBalance => b !== null);
    } catch (e) {
      // Balance refresh must never break the popup — surface in console only.
      console.error("eERC balance read failed:", e);
      return [];
    }
  }

  async shield(
    address: string,
    symbol: string,
    amount: bigint, // in the ERC20's own decimals
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult> {
    try {
      const token = this.resolveToken(symbol);
      onProgress?.({ step: "preparing", percent: 10 });
      const session = await this.initialize(address);
      await this.approveERC20(session, address, token.address, amount);
      onProgress?.({ step: "generating-proof", percent: 45 });
      const { transactionHash } = await session.eerc.deposit(
        amount,
        token.address,
        session.eercDecimals,
      );
      onProgress?.({ step: "submitting", percent: 85 });
      await this.confirm(session, transactionHash);
      onProgress?.({ step: "done", percent: 100 });
      await this.record(address, {
        hash: transactionHash,
        type: "shield",
        symbol: token.symbol,
        amount: (Number(amount) / 10 ** token.decimals).toFixed(4),
        timestamp: Date.now(),
        visibility: "shielded",
        status: "confirmed",
        explorerUrl: this.explorerUrl(transactionHash),
        proofId: transactionHash, // proof lives inside the deposit tx
      });
      return { txHash: transactionHash, proofId: transactionHash };
    } catch (e) {
      throw normalizeError(e);
    }
  }

  async unshield(
    address: string,
    symbol: string,
    amount: bigint, // in eERC decimals (what the UI shows for shielded balances)
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult> {
    try {
      const token = this.resolveToken(symbol);
      onProgress?.({ step: "preparing", percent: 10 });
      const session = await this.initialize(address);
      const { decrypted, encrypted } = await this.readEncryptedBalance(
        session,
        address,
        token.address,
      );
      if (amount > decrypted) throw new Error("Insufficient shielded balance");
      onProgress?.({ step: "generating-proof", percent: 40 });
      const { transactionHash } = await session.eerc.withdraw(
        amount,
        encrypted,
        decrypted,
        session.auditorPublicKey,
        token.address,
      );
      onProgress?.({ step: "submitting", percent: 85 });
      await this.confirm(session, transactionHash);
      onProgress?.({ step: "done", percent: 100 });
      await this.record(address, {
        hash: transactionHash,
        type: "unshield",
        symbol: token.symbol,
        amount: (Number(amount) / 10 ** Number(session.eercDecimals)).toFixed(4),
        timestamp: Date.now(),
        visibility: "shielded",
        status: "confirmed",
        explorerUrl: this.explorerUrl(transactionHash),
        proofId: transactionHash,
      });
      return { txHash: transactionHash, proofId: transactionHash };
    } catch (e) {
      throw normalizeError(e);
    }
  }

  async shieldedSend(
    address: string,
    symbol: string,
    amount: bigint, // in eERC decimals
    to: string,
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult> {
    try {
      const token = this.resolveToken(symbol);
      if (!isAddress(to)) throw new Error("Invalid recipient address");
      onProgress?.({ step: "preparing", percent: 10 });
      const session = await this.initialize(address);
      // Recipient must be registered — their public key encrypts the amount.
      const recipientRegistered = (await session.client.readContract({
        address: env.eercRegistrarAddress as `0x${string}`,
        abi: session.eerc.registrarAbi,
        functionName: "isUserRegistered",
        args: [to as `0x${string}`],
      })) as boolean;
      if (!recipientRegistered) throw new Error("Recipient is not registered with eERC");
      const { decrypted, encrypted } = await this.readEncryptedBalance(
        session,
        address,
        token.address,
      );
      if (amount > decrypted) throw new Error("Insufficient shielded balance");
      onProgress?.({ step: "generating-proof", percent: 40 });
      const { transactionHash } = await session.eerc.transfer(
        to,
        amount,
        encrypted,
        decrypted,
        session.auditorPublicKey,
        token.address,
      );
      onProgress?.({ step: "submitting", percent: 85 });
      await this.confirm(session, transactionHash);
      onProgress?.({ step: "done", percent: 100 });
      await this.record(address, {
        hash: transactionHash,
        type: "shielded-send",
        symbol: `e${token.symbol}`,
        amount: "••••", // confidential — decryptable via Activity reveal
        timestamp: Date.now(),
        visibility: "shielded",
        to,
        status: "confirmed",
        explorerUrl: this.explorerUrl(transactionHash),
        proofId: transactionHash,
      });
      return { txHash: transactionHash, proofId: transactionHash };
    } catch (e) {
      throw normalizeError(e);
    }
  }

  // ponytail: activity = locally recorded real txs from this device; full
  // chain-log reconstruction (decrypting Deposit/Withdraw/PrivateTransfer
  // events across all blocks) can replace this if multi-device history matters.
  async getShieldedActivity(address: string): Promise<TxRecord[]> {
    return (await loadState(address)).activity;
  }

  /** Decrypt a shielded tx's real amount via the user's viewing key. */
  async decryptTransaction(address: string, txHash: string) {
    const session = await this.initialize(address);
    return session.eerc.decryptTransaction(txHash);
  }

  /** Mark a locally recorded shielded tx as revealed. */
  async markRevealed(address: string, txHash: string): Promise<TxRecord | null> {
    const state = await loadState(address);
    const tx = state.activity.find((t) => t.hash === txHash);
    if (!tx) return null;
    tx.revealed = true;
    await saveState(address, state);
    return tx;
  }

  /** Drop cached sessions (e.g. on lock). */
  reset(): void {
    this.sessions.clear();
  }
}

export const shieldProvider = new EERCConverterProvider();
