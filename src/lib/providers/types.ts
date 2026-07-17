// Provider interfaces. The UI depends only on these — mock implementations
// (Shield/Privacy) can be swapped for real eERC ones without UI changes.

export type NetworkId = "fuji" | "mainnet";

export interface NetworkInfo {
  id: NetworkId;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeSymbol: string;
}

export interface Account {
  address: string;
  name: string;
  index: number;
}

export interface WalletProvider {
  /** Generate a new 12-word mnemonic (not yet persisted). */
  generateMnemonic(): Promise<string>;
  /** Create + persist an encrypted wallet from a mnemonic. Returns first account. */
  createWallet(mnemonic: string, password: string): Promise<Account>;
  /** True if an encrypted wallet exists in storage. */
  hasWallet(): Promise<boolean>;
  /** Decrypt with password; throws on wrong password. Returns accounts. */
  unlock(password: string): Promise<Account[]>;
  lock(): void;
  /** Check a password against the vault without changing unlock state. */
  verifyPassword(password: string): Promise<boolean>;
  isUnlocked(): boolean;
  /** Derive the next account and persist its count. */
  addAccount(): Promise<Account>;
  /** Remove the most recently derived (highest-index) account. */
  removeLastAccount(): Promise<void>;
  renameAccount(index: number, name: string): Promise<void>;
  getAccounts(): Account[];
  /** Reveal the mnemonic (requires unlocked wallet). */
  getMnemonic(): Promise<string>;
  /** Reveal the private key for an account (requires unlocked wallet). */
  getPrivateKey(index: number): Promise<string>;
  /** Re-encrypt the stored wallet with a new password. */
  changePassword(current: string, next: string): Promise<void>;
  /** Sign & send a transaction from the given account. Returns tx hash. */
  sendTransaction(
    accountIndex: number,
    tx: { to: string; value: bigint; data?: string },
    network: NetworkInfo,
  ): Promise<string>;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  address: string | null; // null = native AVAX
  decimals: number;
  balance: bigint;
  usdValue: number;
}

export interface PortfolioProvider {
  getNativeBalance(address: string, network: NetworkInfo): Promise<bigint>;
  getTokenBalances(address: string, network: NetworkInfo): Promise<TokenBalance[]>;
  getAvaxUsdPrice(): Promise<number>;
}

export interface GasEstimate {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  /** total fee in native units */
  fee: bigint;
}

export interface TxRecord {
  hash: string;
  type: "send" | "receive" | "shield" | "unshield" | "shielded-send" | "shielded-receive";
  symbol: string;
  amount: string; // formatted; "••••" for hidden shielded amounts
  timestamp: number;
  visibility: "public" | "shielded";
  to?: string;
  from?: string;
  status: "pending" | "confirmed" | "failed";
  explorerUrl?: string;
  proofId?: string;
  revealed?: boolean;
}

export interface TransactionProvider {
  estimateGas(
    from: string,
    tx: { to: string; value: bigint; data?: string },
    network: NetworkInfo,
  ): Promise<GasEstimate>;
  getHistory(address: string, network: NetworkInfo): Promise<TxRecord[]>;
}

export interface ShieldedBalance {
  symbol: string; // e.g. eUSDC, eAVAX
  underlyingSymbol: string;
  decimals: number;
  balance: bigint;
  usdValue: number;
}

export interface ShieldResult {
  txHash: string;
  proofId: string;
}

export interface ShieldProgress {
  step: "preparing" | "generating-proof" | "submitting" | "done";
  percent: number;
}

export interface ShieldProvider {
  getShieldedBalances(address: string): Promise<ShieldedBalance[]>;
  shield(
    address: string,
    symbol: string,
    amount: bigint,
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult>;
  unshield(
    address: string,
    symbol: string,
    amount: bigint,
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult>;
  shieldedSend(
    address: string,
    symbol: string,
    amount: bigint,
    to: string,
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult>;
  /**
   * Confidential send with automatic conversion: if the encrypted balance
   * can't cover `amount`, the shortfall is approved + deposited from the
   * public ERC20 balance first, then transferred confidentially. Native
   * AVAX is wrapped automatically — callers just pass symbol "AVAX".
   * `amount` is a human decimal string — the provider owns all decimals.
   */
  send(
    address: string,
    symbol: string,
    amount: string,
    to: string,
    onProgress?: (p: ShieldProgress) => void,
  ): Promise<ShieldResult>;
  getShieldedActivity(address: string): Promise<TxRecord[]>;
  /** The user's eERC viewing key (decrypts their own confidential txs). */
  getViewingKey(address: string): Promise<string>;
}

export interface RevealRecord {
  id: string;
  description: string;
  timestamp: number;
}

export interface PrivacyStats {
  /** 0–100: share of portfolio value that is shielded */
  score: number;
  shieldedPct: number;
  publicPct: number;
  recommendation: string | null;
}

export interface PrivacyProvider {
  getStats(address: string): Promise<PrivacyStats>;
  getReveals(address: string): Promise<RevealRecord[]>;
  /** Reveal a shielded tx to a viewer; returns the reveal record. */
  revealTransaction(address: string, txHash: string): Promise<RevealRecord>;
  /** Generate a standalone viewing proof for a shielded tx. */
  generateProof(address: string, txHash: string): Promise<{ proofId: string }>;
}
