// Message protocol between the popup (keyring client) and the background
// service worker (keyring core). Pure types — no chrome/ethers imports, so
// this file is safe to import from either bundle.
import type { Account, NetworkInfo } from "@/lib/providers/types";

export type SignableTx = { to: string; value: bigint; data?: string };

export type KeyringRequest =
  | { op: "hasWallet" }
  | { op: "generateMnemonic" }
  | { op: "createWallet"; mnemonic: string; password: string }
  | { op: "unlock"; password: string }
  | { op: "verifyPassword"; password: string }
  | { op: "lock" }
  | { op: "isUnlocked" }
  | { op: "addAccount" }
  | { op: "removeLastAccount" }
  | { op: "renameAccount"; index: number; name: string }
  | { op: "getAccounts" }
  | { op: "getMnemonic" }
  | { op: "getPrivateKey"; index: number }
  | { op: "changePassword"; current: string; next: string }
  | { op: "sendTransaction"; accountIndex: number; tx: SignableTx; network: NetworkInfo }
  | { op: "signMessage"; address: string; message: string }
  | { op: "signTransaction"; address: string; tx: Record<string, unknown> }
  | { op: "signTypedData"; address: string; data: Record<string, unknown> }
  | { op: "reset" };

export type KeyringResult = {
  hasWallet: boolean;
  generateMnemonic: string;
  createWallet: Account;
  unlock: Account[];
  verifyPassword: boolean;
  lock: void;
  isUnlocked: boolean;
  addAccount: Account;
  removeLastAccount: void;
  renameAccount: void;
  getAccounts: Account[];
  getMnemonic: string;
  getPrivateKey: string;
  changePassword: void;
  sendTransaction: string;
  signMessage: string;
  signTransaction: string;
  signTypedData: string;
  reset: void;
};

export type KeyringResponse<T = unknown> =
  | { ok: true; result: T }
  | { ok: false; error: string; code?: "LOCKED" | "WRONG_PASSWORD" | "NO_WALLET" };

export const KEYRING_MESSAGE = "aevra.keyring" as const;

export class LockedError extends Error {
  constructor() {
    super("Wallet locked");
    this.name = "LockedError";
  }
}
