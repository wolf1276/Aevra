import { create } from "zustand";

import { NETWORKS } from "@/config/networks";
import { type AvatarStyle, DEFAULT_AVATAR_STYLE } from "@/lib/avatar";
import { LockedError } from "@/lib/keyring/protocol";
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
  | { name: "token"; symbol: string }
  | { name: "token-history"; symbol: string }
  | { name: "send"; symbol?: string }
  | { name: "send-review" }
  | { name: "send-success" }
  | { name: "receive" }
  | { name: "activity" }
  | { name: "privacy" }
  | { name: "settings" }
  | { name: "backup-verify" }
  | { name: "backup" }
  | { name: "export-key" }
  | { name: "address-book" }
  | { name: "personalize" };

/** Local-only personalization — never persisted on-chain or sent in transactions. */
export interface Profile {
  username: string;
  avatarStyle: AvatarStyle;
  avatarSeed: string;
}

export function defaultProfile(address: string): Profile {
  return { username: "", avatarStyle: DEFAULT_AVATAR_STYLE, avatarSeed: address };
}

export function profileFor(profiles: Record<string, Profile>, address: string): Profile {
  return profiles[address] ?? defaultProfile(address);
}

export interface PendingSend {
  to: string;
  amount: string; // decimal string
  symbol: string;
  fee: string; // formatted AVAX
}

export interface Contact {
  address: string;
  name: string;
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
  autoLockMinutes: number;
  developerMode: boolean;
  toast: string | null;
  profiles: Record<string, Profile>;
  contacts: Contact[];
  // actions
  boot(): Promise<void>;
  navigate(screen: Screen): void;
  createWallet(mnemonic: string, password: string): Promise<void>;
  unlock(password: string): Promise<void>;
  lock(): void;
  addAccount(): Promise<void>;
  removeLastAccount(): Promise<void>;
  renameAccount(index: number, name: string): Promise<void>;
  setActiveIndex(i: number): void;
  setNetwork(id: NetworkId): void;
  refresh(): Promise<void>;
  setPendingSend(p: PendingSend | null): void;
  setLastResult(r: WalletState["lastResult"]): void;
  setSetting<K extends "autoLockMinutes" | "developerMode">(key: K, value: WalletState[K]): void;
  showToast(message: string): void;
  setUsername(address: string, username: string): void;
  setAvatarStyle(address: string, style: AvatarStyle): void;
  regenerateAvatar(address: string): void;
  resetProfile(address: string): void;
  addContact(contact: Contact): void;
  removeContact(address: string): void;
}

const SETTINGS_KEY = "aevra.settings";
const ACTIVE_INDEX_KEY = "aevra.activeIndex";
const PROFILES_KEY = "aevra.profiles";
const CONTACTS_KEY = "aevra.contacts";
export const CREATED_AT_KEY = "aevra.createdAt";

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
  autoLockMinutes: 5,
  developerMode: false,
  toast: null,
  profiles: {},
  contacts: [],

  async boot() {
    const [has, settingsRaw, profilesRaw, contactsRaw] = await Promise.all([
      walletProvider.hasWallet(),
      storageGet(SETTINGS_KEY),
      storageGet(PROFILES_KEY),
      storageGet(CONTACTS_KEY),
    ]);
    if (settingsRaw) {
      const s = JSON.parse(settingsRaw);
      set({
        autoLockMinutes: s.autoLockMinutes ?? 5,
        developerMode: s.developerMode ?? false,
        networkId: s.networkId ?? "fuji",
      });
    }
    if (profilesRaw) set({ profiles: JSON.parse(profilesRaw) });
    if (contactsRaw) set({ contacts: JSON.parse(contactsRaw) });
    set({ booted: true, screen: { name: has ? "unlock" : "welcome" } });
  },

  navigate(screen) {
    set({ screen });
  },

  async createWallet(mnemonic, password) {
    const account = await walletProvider.createWallet(mnemonic, password);
    set({ accounts: [account], activeIndex: 0, screen: { name: "personalize" } });
    void storageSet(CREATED_AT_KEY, String(Date.now()));
    void get().refresh();
  },

  async unlock(password) {
    const accounts = await walletProvider.unlock(password);
    const savedRaw = await storageGet(ACTIVE_INDEX_KEY);
    const saved = savedRaw ? Number(savedRaw) : 0;
    const activeIndex = accounts.some((a) => a.index === saved) ? saved : 0;
    set({ accounts, activeIndex, screen: { name: "home" } });
    void get().refresh();
  },

  lock() {
    walletProvider.lock();
    set({ screen: { name: "unlock" }, accounts: [], pendingSend: null });
  },

  async addAccount() {
    try {
      const account = await walletProvider.addAccount();
      set({ accounts: [...get().accounts, account], activeIndex: account.index });
      void storageSet(ACTIVE_INDEX_KEY, String(account.index));
      void get().refresh();
    } catch (e) {
      if (e instanceof LockedError) get().lock();
      else throw e;
    }
  },

  async removeLastAccount() {
    try {
      await walletProvider.removeLastAccount();
      const accounts = walletProvider.getAccounts();
      const activeIndex = Math.min(get().activeIndex, accounts.length - 1);
      set({ accounts, activeIndex });
      void storageSet(ACTIVE_INDEX_KEY, String(activeIndex));
      void get().refresh();
    } catch (e) {
      if (e instanceof LockedError) get().lock();
      else throw e;
    }
  },

  async renameAccount(index, name) {
    try {
      await walletProvider.renameAccount(index, name);
      set({ accounts: walletProvider.getAccounts() });
    } catch (e) {
      if (e instanceof LockedError) get().lock();
      else throw e;
    }
  },

  setActiveIndex(i) {
    set({ activeIndex: i });
    void storageSet(ACTIVE_INDEX_KEY, String(i));
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
    let rawNative: bigint,
      rawTokens: TokenBalance[],
      rawShielded: ShieldedBalance[],
      history: TxRecord[],
      shieldedActivity: TxRecord[],
      privacy: PrivacyStats | null,
      reveals: RevealRecord[],
      avaxPrice: number;
    try {
      [rawNative, rawTokens, rawShielded, history, shieldedActivity, privacy, reveals, avaxPrice] =
        await Promise.all([
          portfolioProvider.getNativeBalance(account.address, network).catch(() => 0n),
          portfolioProvider.getTokenBalances(account.address, network).catch(() => []),
          shieldProvider.getShieldedBalances(account.address),
          transactionProvider.getHistory(account.address, network),
          shieldProvider.getShieldedActivity(account.address),
          privacyProvider.getStats(account.address).catch(() => null),
          privacyProvider.getReveals(account.address),
          portfolioProvider.getAvaxUsdPrice(),
        ]);
    } catch (e) {
      set({ loading: false });
      if (e instanceof LockedError) get().lock();
      else throw e;
      return;
    }
    let nativeBalance = rawNative;
    let tokens = rawTokens;
    let shielded = rawShielded;
    // Privacy by default: the wrapped native asset is an internal detail.
    // Fold its public balance into AVAX and relabel its confidential balance,
    // unless Developer Mode wants the raw view.
    if (!get().developerMode) {
      const wrapped = tokens.find((t) => t.symbol === "WAVAX");
      if (wrapped) {
        nativeBalance += wrapped.balance; // same 18 decimals as native AVAX
        tokens = tokens.filter((t) => t.symbol !== "WAVAX");
      }
      shielded = shielded.map((b) =>
        b.underlyingSymbol === "WAVAX" ? { ...b, symbol: "eAVAX", underlyingSymbol: "AVAX" } : b,
      );
    }
    // ponytail: the account may have changed while these requests were in
    // flight — drop stale results instead of overwriting the new account's data.
    if (get().activeIndex !== activeIndex) return;
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
    const { autoLockMinutes, developerMode, networkId } = get();
    void storageSet(SETTINGS_KEY, JSON.stringify({ autoLockMinutes, developerMode, networkId }));
  },

  showToast(message) {
    set({ toast: message });
    setTimeout(() => {
      if (get().toast === message) set({ toast: null });
    }, 1500);
  },

  setUsername(address, username) {
    const profiles = {
      ...get().profiles,
      [address]: { ...profileFor(get().profiles, address), username },
    };
    set({ profiles });
    void storageSet(PROFILES_KEY, JSON.stringify(profiles));
  },

  setAvatarStyle(address, avatarStyle) {
    const profiles = {
      ...get().profiles,
      [address]: { ...profileFor(get().profiles, address), avatarStyle },
    };
    set({ profiles });
    void storageSet(PROFILES_KEY, JSON.stringify(profiles));
  },

  regenerateAvatar(address) {
    const avatarSeed = crypto.randomUUID();
    const profiles = {
      ...get().profiles,
      [address]: { ...profileFor(get().profiles, address), avatarSeed },
    };
    set({ profiles });
    void storageSet(PROFILES_KEY, JSON.stringify(profiles));
  },

  resetProfile(address) {
    const profiles = { ...get().profiles };
    delete profiles[address];
    set({ profiles });
    void storageSet(PROFILES_KEY, JSON.stringify(profiles));
  },

  addContact(contact) {
    const contacts = [...get().contacts, contact];
    set({ contacts });
    void storageSet(CONTACTS_KEY, JSON.stringify(contacts));
  },

  removeContact(address) {
    const contacts = get().contacts.filter((c) => c.address !== address);
    set({ contacts });
    void storageSet(CONTACTS_KEY, JSON.stringify(contacts));
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
