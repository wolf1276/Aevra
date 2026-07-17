// Real Shield layer — Avalanche eERC Converter Mode via @avalabs/eerc-sdk.
// Lifecycle: approve ERC20 → deposit into Converter → encrypted balance →
// confidential transfer → withdraw back to the original ERC20.
// ZK proofs are generated client-side by the SDK (snarkjs); the proof is
// embedded in the transaction itself, so the tx hash IS the on-chain
// artifact — no separate proof IDs exist in eERC.

import { EERC } from "@avalabs/eerc-sdk";
import {
  BaseError,
  type Chain,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  fallback,
  http,
  isAddress,
  parseAbi,
  type PublicClient,
  type WalletClient,
} from "viem";

import { chainFor } from "@/config/chains";
import { env } from "@/config/env";
import { NETWORKS, TRACKED_TOKENS } from "@/config/networks";
import { parseUnits } from "@/lib/format";
import { storageGet, storageSet } from "@/lib/storage";

import { portfolioProvider } from "./portfolio";
import type {
  NetworkInfo,
  SendFeeEstimate,
  ShieldedBalance,
  ShieldProgress,
  ShieldProvider,
  ShieldResult,
  TxRecord,
} from "./types";
import { walletProvider } from "./wallet";

// ── Config ──────────────────────────────────────────────────────────────

// Proof generation runs inside a Web Worker, where `window` is undefined
// (workers only have `self`); snarkjs then misdetects Node.js and resolves
// a root-relative path against `file://` instead of the page origin. An
// absolute URL sidesteps that in both the main thread and the worker.
const circuitBase = (typeof self !== "undefined" ? self.location.origin : "") + env.eercCircuitBase;

const CIRCUITS = {
  register: {
    wasm: `${circuitBase}/RegistrationCircuit.wasm`,
    zkey: `${circuitBase}/RegistrationCircuit.groth16.zkey`,
  },
  transfer: {
    wasm: `${circuitBase}/TransferCircuit.wasm`,
    zkey: `${circuitBase}/TransferCircuit.groth16.zkey`,
  },
  mint: {
    wasm: `${circuitBase}/MintCircuit.wasm`,
    zkey: `${circuitBase}/MintCircuit.groth16.zkey`,
  },
  withdraw: {
    wasm: `${circuitBase}/WithdrawCircuit.wasm`,
    zkey: `${circuitBase}/WithdrawCircuit.groth16.zkey`,
  },
  // Burn circuit is standalone-mode only; never loaded in Converter Mode,
  // but the SDK's CircuitURLs type requires the entry.
  burn: {
    wasm: `${circuitBase}/BurnCircuit.wasm`,
    zkey: `${circuitBase}/BurnCircuit.groth16.zkey`,
  },
} as const;

const WAVAX_ABI = parseAbi(["function deposit() payable", "function withdraw(uint256 wad)"]);

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

// TEMP DEBUG — full diagnostic dump before the error gets flattened to a
// friendly message. Remove once the real failure is found.
function dumpFullError(where: string, e: unknown) {
  const viemErr = e instanceof BaseError ? e : undefined;
  const revert = viemErr?.walk((err) => err instanceof ContractFunctionRevertedError) as
    ContractFunctionRevertedError | undefined;
  console.error(`✗✗✗ [${where}] FULL ERROR DUMP ────────────────────`);
  console.error("message:", e instanceof Error ? e.message : String(e));
  console.error(
    "cause:",
    e instanceof Error ? (e as Error & { cause?: unknown }).cause : undefined,
  );
  console.error("stack:", e instanceof Error ? e.stack : undefined);
  console.error("viem shortMessage:", viemErr?.shortMessage);
  console.error("viem details:", viemErr?.details);
  console.error("viem metaMessages:", viemErr?.metaMessages?.join("\n"));
  console.error("contract revert reason:", revert?.reason);
  console.error("contract revert data:", revert?.data);
  console.error("raw error object:", e);
  console.error("────────────────────────────────────────────────");
}

// TEMP DEBUG — logs entry/success/failure + timing for a pipeline step,
// dumping the full error before rethrowing. Remove once diagnosed.
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  console.log(`→ [${name}] entered`);
  try {
    const result = await fn();
    console.log(`✓ [${name}] success (${(performance.now() - t0).toFixed(0)}ms)`, result);
    return result;
  } catch (e) {
    console.error(`✗ [${name}] failed (${(performance.now() - t0).toFixed(0)}ms)`);
    dumpFullError(name, e);
    throw e;
  }
}

/** Errors carrying their own user-facing message — passed through normalizeError untouched. */
const SURFACE_VERBATIM = [
  "The confidential payment system is not configured correctly.",
  /^Unable to verify registration status:/,
  /^Registration failed:/,
  /^This token supports at most /,
];

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

function normalizeError(e: unknown): Error {
  console.error("send pipeline error:", e); // raw cause for debugging — user sees friendly text
  dumpFullError("normalizeError", e);
  const msg = e instanceof Error ? e.message : String(e);
  if (SURFACE_VERBATIM.some((m) => (typeof m === "string" ? m === msg : m.test(msg))))
    return new Error(msg);
  if (/user rejected|denied|4001/i.test(msg)) return new Error("Transaction rejected");
  if (/insufficient funds|insufficient balance/i.test(msg))
    return new Error("Insufficient balance");
  if (/invalid recipient/i.test(msg)) return new Error("Invalid recipient address");
  if (/recipient/i.test(msg)) return new Error("Recipient can't receive private payments yet");
  if (/fetch|network|timeout|ECONN|mismatch/i.test(msg))
    return new Error("Network error — please try again");
  // Everything else (wrap, approval, converter, proof, revert, config) is an
  // internal pipeline detail — never expose protocol terminology.
  return new Error("Unable to prepare secure payment. Please try again.");
}

/** Rescale a bigint amount between decimal systems (ceil when losing precision). */
function scaleUnits(amount: bigint, fromDecimals: number, toDecimals: number): bigint {
  const diff = toDecimals - fromDecimals;
  if (diff >= 0) return amount * 10n ** BigInt(diff);
  const div = 10n ** BigInt(-diff);
  return (amount + div - 1n) / div;
}

// ── Provider ────────────────────────────────────────────────────────────

interface Session {
  eerc: EERC;
  client: PublicClient;
  wallet: WalletClient;
  chain: Chain;
  network: NetworkInfo;
  /** eERC internal decimals (encrypted balances use these, not the ERC20's). */
  eercDecimals: bigint;
  auditorPublicKey: bigint[];
  registered: boolean;
}

/** Runtime access to SDK internals only marked `private` in its .d.ts (TS-only,
 *  erased at build time) — there's no public API to build transfer calldata
 *  without also submitting it. */
type EercInternals = {
  fetchTokenId(t: string): Promise<bigint>;
  fetchUserApprove(o: string, t: string): Promise<bigint>;
  generateTransferProof(
    to: string,
    amount: bigint,
    encryptedBalance: bigint[],
    decryptedBalance: bigint,
    auditorPublicKey: bigint[],
  ): Promise<{ proof: unknown; senderBalancePCT: unknown }>;
  convertTokenDecimals(amount: bigint, from: number, to: number): bigint;
  poseidon: {
    processPoseidonEncryption(a: {
      inputs: bigint[];
      publicKey: bigint[];
    }): Promise<{ cipher: bigint[]; nonce: bigint; authKey: bigint[] }>;
  };
  publicKey: bigint[];
};

/** The confidential-transfer leg's proof + exact calldata, already simulated
 *  and gas-estimated — the expensive artifact `estimateSendFee` and `send()`
 *  both need. Cached so a Send tap doesn't regenerate the ZK proof that
 *  Review already produced. */
interface PreparedTransfer {
  /** identifies the exact encrypted-balance snapshot this proof was built against —
   *  invalid the instant that balance changes (e.g. after an auto-shield deposit) */
  sig: string;
  // Opaque: viem's simulateContract->writeContract passthrough type doesn't
  // survive being stored and reused later — narrowed back at the call site.
  request: unknown;
  gas: bigint;
}

export class EERCConverterProvider implements ShieldProvider {
  private sessions = new Map<string, Session>();
  /** Single-slot cache for the last confidential-transfer proof built by
   *  estimateSendFee, keyed per sender address. */
  private transferCache = new Map<string, PreparedTransfer>();
  private network: NetworkInfo = NETWORKS.fuji;

  private get tokens() {
    return TRACKED_TOKENS[this.network.id];
  }

  /** Switch to a different network — sessions are chain-bound, so anything
   *  cached under the old network must be dropped, not reused. */
  setNetwork(network: NetworkInfo): void {
    if (network.id === this.network.id) return;
    this.network = network;
    this.reset();
  }

  // ── lifecycle ──

  /** Build (or reuse) an initialized, registered eERC session for `address`. */
  private async initialize(address: string): Promise<Session> {
    return step(`initialize(${address})`, () => this.initializeImpl(address));
  }

  private async initializeImpl(address: string): Promise<Session> {
    if (!env.featureConfidentialTransfers) throw new Error("Confidential transfers are disabled");
    if (!(await walletProvider.isUnlocked())) {
      this.reset(); // drop sessions holding signer accounts
      throw new Error("Wallet locked");
    }
    const network = this.network;
    const cacheKey = `${network.id}:${address.toLowerCase()}`;
    const cached = this.sessions.get(cacheKey);
    if (cached) return cached;

    if (!isAddress(network.converterAddress) || !isAddress(network.registrarAddress)) {
      throw new Error(`Converter unavailable on ${network.name} — no eERC deployment configured`);
    }

    const chain = chainFor(network);
    const account = walletProvider.getRemoteAccount(address);
    // Read traffic gets retry + timeout + fallback-RPC for free from viem;
    // the write transport stays single-shot — retrying a submitted tx risks
    // double-submission, so it never gets this treatment.
    const readTransport = fallback(
      [network.rpcUrl, network.fallbackRpcUrl]
        .filter((u): u is string => !!u)
        .map((u) => http(u, { timeout: 10_000, retryCount: 2, retryDelay: 300 })),
    );
    const client = createPublicClient({ chain, transport: readTransport });
    const chainId = await client.getChainId();
    if (chainId !== network.chainId) throw new Error(`Network mismatch — RPC is chain ${chainId}`);
    const wallet = createWalletClient({
      account,
      chain,
      transport: http(network.rpcUrl, { timeout: 15_000, retryCount: 0 }),
    });

    const state = await loadState(address);
    const eerc = new EERC(
      client,
      wallet,
      network.converterAddress as `0x${string}`,
      network.registrarAddress as `0x${string}`,
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
        address: network.converterAddress as `0x${string}`,
        abi: eerc.encryptedErcAbi,
        functionName: "decimals",
      }),
      client.readContract({
        address: network.converterAddress as `0x${string}`,
        abi: eerc.encryptedErcAbi,
        functionName: "auditorPublicKey",
      }),
    ]);

    const auditorPublicKey = (rawAuditorKey as readonly bigint[]).map((v) => BigInt(v));
    const isZeroPoint = auditorPublicKey.length === 0 || auditorPublicKey.every((v) => v === 0n);
    const isValidPoint =
      auditorPublicKey.length === 2 &&
      eerc.curve.inCurve([auditorPublicKey[0], auditorPublicKey[1]]);
    if (isZeroPoint || !isValidPoint) {
      throw new Error("The confidential payment system is not configured correctly.");
    }

    const session: Session = {
      eerc,
      client,
      wallet,
      chain,
      network,
      eercDecimals: BigInt(rawDecimals as number | bigint),
      auditorPublicKey,
      registered: false,
    };
    await this.registerUserIfNeeded(address, session);
    this.sessions.set(cacheKey, session);
    return session;
  }

  /** Register the user's BabyJubJub public key with the Registrar if absent. */
  private async registerUserIfNeeded(address: string, session: Session): Promise<void> {
    if (session.registered) return;
    let isRegistered: boolean;
    try {
      isRegistered = (await withTimeout(
        step(`isUserRegistered(${address})`, () =>
          session.client.readContract({
            address: session.network.registrarAddress as `0x${string}`,
            abi: session.eerc.registrarAbi,
            functionName: "isUserRegistered",
            args: [address as `0x${string}`],
          }),
        ),
        15_000,
        "Timed out checking registration status.",
      )) as boolean;
    } catch (e) {
      throw new Error(
        `Unable to verify registration status: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (isRegistered) {
      session.registered = true;
      return;
    }
    try {
      const { transactionHash } = await withTimeout(
        step("registerUserIfNeeded:register", () => session.eerc.register()),
        60_000,
        "Timed out generating the registration proof.",
      );
      if (transactionHash) {
        await withTimeout(
          step("registerUserIfNeeded:waitForTransactionReceipt", () =>
            session.client.waitForTransactionReceipt({
              hash: transactionHash as `0x${string}`,
              timeout: 60_000,
            }),
          ),
          65_000,
          "Timed out waiting for the registration transaction to confirm.",
        );
      }
    } catch (e) {
      throw new Error(`Registration failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    session.registered = true;
  }

  // ── helpers ──

  getSupportedAssets(): { symbol: string; address: string; decimals: number }[] {
    return this.tokens.map(({ symbol, address, decimals }) => ({
      symbol,
      address,
      decimals,
    }));
  }

  /** Asset resolver: maps a user-facing symbol to its shieldable ERC20 and
   *  pipeline. Native AVAX routes through the wrap pipeline (WAVAX) — the
   *  caller/UI never learns which pipeline was picked. */
  private resolveToken(symbol: string): {
    symbol: string;
    address: string;
    decimals: number;
    /** true → wrap/unwrap native AVAX around the confidential flow */
    native: boolean;
    /** what activity records + results should call this asset */
    displaySymbol: string;
  } {
    console.log(`→ [resolveToken(${symbol})] entered`);
    const plain = symbol.startsWith("e") ? symbol.slice(1) : symbol;
    const native = plain === "AVAX";
    const token = this.tokens.find((t) => t.symbol === (native ? "WAVAX" : plain));
    if (!token) {
      console.error(`✗ [resolveToken(${symbol})] failed — no match in this.tokens`);
      throw new Error(`Unsupported token: ${symbol}`);
    }
    const result = { ...token, native, displaySymbol: native ? "AVAX" : token.symbol };
    console.log(`✓ [resolveToken(${symbol})] success`, result);
    return result;
  }

  /** Ensure `owner` holds ≥ `needed` WAVAX, wrapping native AVAX for any deficit. */
  private async wrapIfNeeded(
    session: Session,
    owner: string,
    tokenAddress: string,
    needed: bigint,
  ): Promise<void> {
    const wavaxBalance = (await session.client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner as `0x${string}`],
    })) as bigint;
    if (wavaxBalance >= needed) return;
    const deficit = needed - wavaxBalance;
    const nativeBalance = await session.client.getBalance({ address: owner as `0x${string}` });
    if (nativeBalance <= deficit) throw new Error("Insufficient balance"); // must also leave gas
    const hash = await session.wallet.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: WAVAX_ABI,
      functionName: "deposit",
      value: deficit,
      chain: session.chain,
      account: session.wallet.account!,
    });
    await this.confirm(session, hash);
  }

  /** Unwrap up to `amount` WAVAX back to native AVAX (capped at actual balance). */
  private async unwrap(
    session: Session,
    owner: string,
    tokenAddress: string,
    amount: bigint,
  ): Promise<void> {
    const balance = (await session.client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner as `0x${string}`],
    })) as bigint;
    const wad = amount < balance ? amount : balance;
    if (wad <= 0n) return;
    const hash = await session.wallet.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: WAVAX_ABI,
      functionName: "withdraw",
      args: [wad],
      chain: session.chain,
      account: session.wallet.account!,
    });
    await this.confirm(session, hash);
  }

  /** Read + decrypt the on-chain encrypted balance for one token. */
  private async readEncryptedBalance(
    session: Session,
    owner: string,
    tokenAddress: string,
  ): Promise<{ decrypted: bigint; encrypted: bigint[] }> {
    return step(`readEncryptedBalance(${tokenAddress})`, async () => {
      // Same shape the official useEncryptedBalance hook consumes:
      // [eGCT, nonce, amountPCTs, balancePCT, transactionIndex]
      const raw = (await session.client.readContract({
        address: session.network.converterAddress as `0x${string}`,
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
    });
  }

  private async approveERC20(
    session: Session,
    owner: string,
    tokenAddress: string,
    amount: bigint,
  ): Promise<void> {
    return step(`approveERC20(${tokenAddress}, ${amount})`, async () => {
      const allowance = await session.eerc.fetchUserApprove(owner, tokenAddress);
      if (allowance >= amount) return;
      const balance = (await session.client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner as `0x${string}`],
      })) as bigint;
      if (balance < amount) throw new Error("Insufficient balance");
      // TEMP DEBUG — simulate first so a revert is decoded before we spend gas.
      try {
        await session.client.simulateContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [session.network.converterAddress as `0x${string}`, amount],
          account: session.wallet.account!,
        });
      } catch (simErr) {
        dumpFullError("approveERC20:simulateContract", simErr);
      }
      const hash = await step("approveERC20:wallet.writeContract", () =>
        session.wallet.writeContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [session.network.converterAddress as `0x${string}`, amount],
          chain: session.chain,
          account: session.wallet.account!,
        }),
      );
      const receipt = await step("approveERC20:waitForTransactionReceipt", () =>
        session.client.waitForTransactionReceipt({ hash }),
      );
      if (receipt.status !== "success") throw new Error("Approval rejected");
    });
  }

  /** Build (or reuse) the confidential-transfer proof + exact calldata for
   *  one sender. Reused between estimateSendFee and the real send whenever
   *  the encrypted-balance snapshot the proof was built against still holds. */
  private async prepareTransfer(
    address: string,
    session: Session,
    tokenAddress: string,
    to: string,
    amount: bigint,
    encrypted: bigint[],
    decrypted: bigint,
  ): Promise<PreparedTransfer> {
    const sig = [
      address.toLowerCase(),
      to.toLowerCase(),
      amount.toString(),
      tokenAddress.toLowerCase(),
      encrypted.join(","),
      decrypted.toString(),
    ].join("|");
    const cached = this.transferCache.get(address.toLowerCase());
    if (cached?.sig === sig) return cached;

    const eerc = session.eerc as unknown as EercInternals;
    const tokenId = await eerc.fetchTokenId(tokenAddress);
    const { proof, senderBalancePCT } = await step("prepareTransfer:generateTransferProof", () =>
      eerc.generateTransferProof(to, amount, encrypted, decrypted, session.auditorPublicKey),
    );
    const { request } = await session.client.simulateContract({
      address: session.network.converterAddress as `0x${string}`,
      abi: session.eerc.encryptedErcAbi,
      functionName: "transfer",
      args: [to, tokenId, proof, senderBalancePCT],
      account: session.wallet.account!,
    });
    const gas = await session.client.estimateContractGas(request);
    const prepared: PreparedTransfer = { sig, request, gas };
    this.transferCache.set(address.toLowerCase(), prepared);
    return prepared;
  }

  private async confirm(session: Session, hash: `0x${string}`): Promise<void> {
    return step(`confirm:waitForTransactionReceipt(${hash})`, async () => {
      const receipt = await session.client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
    });
  }

  private async record(address: string, tx: TxRecord): Promise<void> {
    const state = await loadState(address);
    state.activity.unshift(tx);
    await saveState(address, state);
  }

  private explorerUrl(hash: string): string {
    return `${this.network.explorerUrl}/tx/${hash}`;
  }

  // ── ShieldProvider ──

  async getShieldedBalances(address: string): Promise<ShieldedBalance[]> {
    // Locked wallet (or unconfigured converter) → nothing to decrypt with.
    if (
      !env.featureConfidentialTransfers ||
      !(await walletProvider.isUnlocked()) ||
      !isAddress(this.network.converterAddress)
    )
      return [];
    try {
      const session = await this.initialize(address);
      const avaxPrice = await portfolioProvider.getAvaxUsdPrice();
      const results = await Promise.all(
        this.tokens.map(async (token) => {
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
      if (token.native) await this.wrapIfNeeded(session, address, token.address, amount);
      await this.approveERC20(session, address, token.address, amount);
      onProgress?.({ step: "generating-proof", percent: 45 });
      const { transactionHash } = await step("shield:generateProof+deposit", () =>
        session.eerc.deposit(amount, token.address, session.eercDecimals),
      );
      onProgress?.({ step: "submitting", percent: 85 });
      await this.confirm(session, transactionHash);
      onProgress?.({ step: "done", percent: 100 });
      await this.record(address, {
        hash: transactionHash,
        type: "shield",
        symbol: token.displaySymbol,
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
      const { transactionHash } = await step("unshield:generateProof+withdraw", () =>
        session.eerc.withdraw(
          amount,
          encrypted,
          decrypted,
          session.auditorPublicKey,
          token.address,
        ),
      );
      onProgress?.({ step: "submitting", percent: 85 });
      await this.confirm(session, transactionHash);
      if (token.native) {
        // deliver native AVAX, never leave the user holding the wrapper
        const erc20Amount = scaleUnits(amount, Number(session.eercDecimals), token.decimals);
        await this.unwrap(session, address, token.address, erc20Amount);
      }
      onProgress?.({ step: "done", percent: 100 });
      await this.record(address, {
        hash: transactionHash,
        type: "unshield",
        symbol: token.displaySymbol,
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
        address: session.network.registrarAddress as `0x${string}`,
        abi: session.eerc.registrarAbi,
        functionName: "isUserRegistered",
        args: [to as `0x${string}`],
      })) as boolean;
      if (!recipientRegistered) throw new Error("Recipient can't receive private payments yet");
      const { decrypted, encrypted } = await this.readEncryptedBalance(
        session,
        address,
        token.address,
      );
      if (amount > decrypted) throw new Error("Insufficient shielded balance");
      onProgress?.({ step: "generating-proof", percent: 40 });
      // Reuses the proof Review already generated via estimateSendFee when the
      // encrypted balance hasn't moved since — regenerates only if it has.
      const prepared = await this.prepareTransfer(
        address,
        session,
        token.address,
        to,
        amount,
        encrypted,
        decrypted,
      );
      const transactionHash = await step("shieldedSend:submit", () =>
        session.wallet.writeContract({
          ...(prepared.request as Record<string, unknown>),
          chain: session.chain,
        } as unknown as Parameters<WalletClient["writeContract"]>[0]),
      );
      onProgress?.({ step: "submitting", percent: 85 });
      await this.confirm(session, transactionHash);
      onProgress?.({ step: "done", percent: 100 });
      await this.record(address, {
        hash: transactionHash,
        type: "shielded-send",
        symbol: `e${token.displaySymbol}`,
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

  /** Confidential send with automatic conversion (see ShieldProvider.send). */
  async send(
    address: string,
    symbol: string,
    amount: string, // human decimal string
    to: string,
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult> {
    try {
      const token = this.resolveToken(symbol);
      if (!isAddress(to)) throw new Error("Invalid recipient address");
      onProgress?.({ step: "preparing", percent: 5 });
      const session = await this.initialize(address);
      const eercAmount = parseUnits(amount, Number(session.eercDecimals));
      const { decrypted } = await this.readEncryptedBalance(session, address, token.address);
      if (eercAmount > decrypted) {
        // auto-convert the shortfall from the public ERC20 balance
        const shortfall = scaleUnits(
          eercAmount - decrypted,
          Number(session.eercDecimals),
          token.decimals,
        );
        // displaySymbol keeps the wrap pipeline engaged for native AVAX
        await this.shield(address, token.displaySymbol, shortfall, (p) =>
          onProgress?.({ step: "preparing", percent: 5 + Math.floor(p.percent * 0.35) }),
        );
      }
      return await this.shieldedSend(address, symbol, eercAmount, to, (p) =>
        onProgress?.(
          p.step === "done" ? p : { step: p.step, percent: 40 + Math.floor(p.percent * 0.6) },
        ),
      );
    } catch (e) {
      throw normalizeError(e);
    }
  }

  /**
   * Estimate the real network fee for send(): determines which of
   * wrap / approve / shield-deposit / confidential-transfer are actually
   * needed, builds each one's exact calldata (including generating the
   * real ZK transfer proof), simulates it, and estimates gas against the
   * live network. Proof generation is the expensive step here — same cost
   * as the real send, so callers should debounce on recipient/amount/token
   * changes rather than firing this on every keystroke.
   */
  async estimateSendFee(
    address: string,
    symbol: string,
    amount: string,
    to: string,
  ): Promise<SendFeeEstimate> {
    const token = this.resolveToken(symbol);
    if (!isAddress(to) || !amount || Number(amount) <= 0) return { totalFee: 0n, steps: [] };

    const session = await this.initialize(address);
    const eerc = session.eerc as unknown as EercInternals;

    const eercAmount = parseUnits(amount, Number(session.eercDecimals));
    const { decrypted, encrypted } = await this.readEncryptedBalance(
      session,
      address,
      token.address,
    );
    const shortfall =
      eercAmount > decrypted
        ? scaleUnits(eercAmount - decrypted, Number(session.eercDecimals), token.decimals)
        : 0n;

    const { maxFeePerGas } = await session.client.estimateFeesPerGas();
    const steps: SendFeeEstimate["steps"] = [];
    const account = session.wallet.account!;

    if (shortfall > 0n) {
      if (token.native) {
        const wavaxBalance = (await session.client.readContract({
          address: token.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        })) as bigint;
        if (wavaxBalance < shortfall) {
          const gas = await session.client.estimateContractGas({
            address: token.address as `0x${string}`,
            abi: WAVAX_ABI,
            functionName: "deposit",
            value: shortfall - wavaxBalance,
            account,
          });
          steps.push({ label: "Wrap AVAX", gas, maxFeePerGas });
        }
      }

      const allowance = await eerc.fetchUserApprove(address, token.address);
      if (allowance < shortfall) {
        const { request } = await session.client.simulateContract({
          address: token.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [session.network.converterAddress as `0x${string}`, shortfall],
          account,
        });
        const gas = await session.client.estimateContractGas(request);
        steps.push({ label: "Approve", gas, maxFeePerGas });
      }

      const tokenDecimals = (await session.client.readContract({
        address: token.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      })) as number;
      const scaled = eerc.convertTokenDecimals(
        shortfall,
        tokenDecimals,
        Number(session.eercDecimals),
      );
      const { cipher, nonce, authKey } = await eerc.poseidon.processPoseidonEncryption({
        inputs: [scaled],
        publicKey: eerc.publicKey,
      });
      const { request } = await session.client.simulateContract({
        address: session.network.converterAddress as `0x${string}`,
        abi: session.eerc.encryptedErcAbi,
        functionName: "deposit",
        args: [shortfall, token.address, [...cipher, ...authKey, nonce]],
        account,
      });
      const gas = await session.client.estimateContractGas(request);
      steps.push({ label: "Shield deposit", gas, maxFeePerGas });
    }

    const recipientRegistered = (await session.client.readContract({
      address: session.network.registrarAddress as `0x${string}`,
      abi: session.eerc.registrarAbi,
      functionName: "isUserRegistered",
      args: [to as `0x${string}`],
    })) as boolean;
    if (recipientRegistered) {
      const prepared = await this.prepareTransfer(
        address,
        session,
        token.address,
        to,
        eercAmount,
        encrypted,
        decrypted,
      );
      steps.push({ label: "Confidential transfer", gas: prepared.gas, maxFeePerGas });
    }

    return { totalFee: steps.reduce((sum, st) => sum + st.gas * st.maxFeePerGas, 0n), steps };
  }

  /** The user's real eERC viewing key, generating it via session init if not yet cached. */
  async getViewingKey(address: string): Promise<string> {
    const cached = await loadState(address);
    if (cached.decryptionKey) return cached.decryptionKey;
    await this.initialize(address);
    const state = await loadState(address);
    return state.decryptionKey ?? "";
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
    this.transferCache.clear();
  }
}

export const shieldProvider = new EERCConverterProvider();
