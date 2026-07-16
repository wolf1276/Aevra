import { create } from "zustand";

import { NETWORKS } from "@/config/networks";
import { portfolioProvider } from "@/lib/providers/portfolio";
import { privacyProvider } from "@/lib/providers/privacy.eerc";
import { shieldProvider } from "@/lib/providers/shield.eerc";
import { transactionProvider } from "@/lib/providers/transactions";
import type {
  Account,
  NetworkId,
  PrivacyStats,
  RevealRecord,
  ShieldedBalance,
  TokenBalance,
  TxRecord,
} from "@/lib/providers/types";
import { walletProvider } from "@/lib/providers/wallet";
import { storageGet, storageSet } from "@/lib/storage";

export type Screen =
  | { name: "welcome" }
  | { name: "create" }
  | { name: "import" }
  | { name: "unlock" }
  | { name: "home" }
  | { name: "assets" }
  | { name: "token"; symbol: string; shielded: boolean }
  | { name: "send"; symbol?: string }
  | { name: "send-review" }
  | { name: "send-success" }
  | { name: "receive" }
  | { name: "shield"; symbol?: string }
  | { name: "shield-success" }
  | { name: "unshield"; symbol?: string }
  | { name: "unshield-success" }
  | { name: "activity" }
  | { name: "privacy" }
  | { name: "settings" }
  | { name: "backup" };

export interface PendingSend {
  to: string;
  amount: string; // decimal string
  symbol: string;
  mode: "public" | "shielded";
  fee: string; // formatted AVAX
}

interface WalletState {
  booted: boolean;
  screen: Screen;
  accounts: Account[];
  activeIndex: number;
  networkId: NetworkId;
  // data
  nativeBalance: bigint;
  tokens: TokenBalance[];
  shielded: ShieldedBalance[];
  history: TxRecord[];
  shieldedActivity: TxRecord[];
  privacy: PrivacyStats | null;
  reveals: RevealRecord[];
  avaxPrice: number;
  loading: boolean;
  // send flow
  pendingSend: PendingSend | null;
  lastResult: { txHash: string; amount: string; symbol: string; proofId?: string } | null;
  // settings
  defaultSendMode: "public" | "shielded";
  autoLockMinutes: number;
  developerMode: boolean;
  // actions
  boot(): Promise<void>;
  navigate(screen: Screen): void;
  createWallet(mnemonic: string, password: string): Promise<void>;
  unlock(password: string): Promise<void>;
  lock(): void;
  addAccount(): Promise<void>;
  setActiveIndex(i: number): void;
  setNetwork(id: NetworkId): void;
  refresh(): Promise<void>;
  setPendingSend(p: PendingSend | null): void;
  setLastResult(r: WalletState["lastResult"]): void;
  setSetting<K extends "defaultSendMode" | "autoLockMinutes" | "developerMode">(
    key: K,
    value: WalletState[K],
  ): void;
}

const SETTINGS_KEY = "aevra.settings";

export const useWallet = create<WalletState>((set, get) => ({
  booted: false,
  screen: { name: "welcome" },
  accounts: [],
  activeIndex: 0,
  networkId: "fuji",
  nativeBalance: 0n,
  tokens: [],
  shielded: [],
  history: [],
  shieldedActivity: [],
  privacy: null,
  reveals: [],
  avaxPrice: 0,
  loading: false,
  pendingSend: null,
  lastResult: null,
  defaultSendMode: "shielded",
  autoLockMinutes: 5,
  developerMode: false,

  async boot() {
    const [has, settingsRaw] = await Promise.all([
      walletProvider.hasWallet(),
      storageGet(SETTINGS_KEY),
    ]);
    if (settingsRaw) {
      const s = JSON.parse(settingsRaw);
      set({
        defaultSendMode: s.defaultSendMode ?? "shielded",
        autoLockMinutes: s.autoLockMinutes ?? 5,
        developerMode: s.developerMode ?? false,
        networkId: s.networkId ?? "fuji",
      });
    }
    set({ booted: true, screen: { name: has ? "unlock" : "welcome" } });
  },

  navigate(screen) {
    set({ screen });
  },

  async createWallet(mnemonic, password) {
    const account = await walletProvider.createWallet(mnemonic, password);
    set({ accounts: [account], activeIndex: 0, screen: { name: "home" } });
    void get().refresh();
  },

  async unlock(password) {
    const accounts = await walletProvider.unlock(password);
    set({ accounts, activeIndex: 0, screen: { name: "home" } });
    void get().refresh();
  },

  lock() {
    walletProvider.lock();
    set({ screen: { name: "unlock" }, accounts: [], pendingSend: null });
  },

  async addAccount() {
    const account = await walletProvider.addAccount();
    set({ accounts: [...get().accounts, account], activeIndex: account.index });
    void get().refresh();
  },

  setActiveIndex(i) {
    set({ activeIndex: i });
    void get().refresh();
  },

  setNetwork(id) {
    set({ networkId: id });
    get().setSetting("developerMode", get().developerMode); // persist networkId via settings blob
    void get().refresh();
  },

  async refresh() {
    const { accounts, activeIndex, networkId } = get();
    const account = accounts[activeIndex];
    if (!account) return;
    const network = NETWORKS[networkId];
    set({ loading: true });
    const [
      nativeBalance,
      tokens,
      shielded,
      history,
      shieldedActivity,
      privacy,
      reveals,
      avaxPrice,
    ] = await Promise.all([
      portfolioProvider.getNativeBalance(account.address, network).catch(() => 0n),
      portfolioProvider.getTokenBalances(account.address, network).catch(() => []),
      shieldProvider.getShieldedBalances(account.address),
      transactionProvider.getHistory(account.address, network),
      shieldProvider.getShieldedActivity(account.address),
      privacyProvider.getStats(account.address).catch(() => null),
      privacyProvider.getReveals(account.address),
      portfolioProvider.getAvaxUsdPrice(),
    ]);
    set({
      nativeBalance,
      tokens,
      shielded,
      history,
      shieldedActivity,
      privacy,
      reveals,
      avaxPrice,
      loading: false,
    });
  },

  setPendingSend(p) {
    set({ pendingSend: p });
  },

  setLastResult(r) {
    set({ lastResult: r });
  },

  setSetting(key, value) {
    set({ [key]: value } as Partial<WalletState>);
    const { defaultSendMode, autoLockMinutes, developerMode, networkId } = get();
    void storageSet(
      SETTINGS_KEY,
      JSON.stringify({ defaultSendMode, autoLockMinutes, developerMode, networkId }),
    );
  },
}));

export {
  NETWORKS,
  portfolioProvider,
  privacyProvider,
  shieldProvider,
  transactionProvider,
  walletProvider,
};
