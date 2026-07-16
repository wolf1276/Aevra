// Thin RPC client for the WalletProvider interface. The real key-holding
// logic lives in the background service worker (src/extension/background) —
// this file never touches decrypted key material directly, it only proxies
// requests to it. In `next dev` (no extension context), it falls back to
// running the same Keyring logic in-process so local development still works
// without loading an unpacked extension.
import { toAccount } from "viem/accounts";

import { Keyring } from "@/lib/keyring/core";
import { dispatch } from "@/lib/keyring/dispatch";
import type { KeyringRequest, KeyringResponse, KeyringResult } from "@/lib/keyring/protocol";
import { KEYRING_MESSAGE, LockedError } from "@/lib/keyring/protocol";

import type { Account, NetworkInfo, WalletProvider } from "./types";

const hasExtensionRuntime = typeof chrome !== "undefined" && !!chrome.runtime?.id;

// Dev-only fallback: same logic as the background service worker, running
// in-process. Never used inside the built extension.
const devKeyring = hasExtensionRuntime ? null : new Keyring();

async function sendRequest<R extends KeyringRequest>(req: R): Promise<KeyringResult[R["op"]]> {
  if (devKeyring) {
    try {
      return (await dispatch(devKeyring, req)) as KeyringResult[R["op"]];
    } catch (e) {
      if (e instanceof Error && e.message === "Wallet locked") throw new LockedError();
      throw e;
    }
  }
  const response: KeyringResponse<KeyringResult[R["op"]]> = await chrome.runtime.sendMessage({
    type: KEYRING_MESSAGE,
    request: req,
  });
  if (!response.ok) {
    if (response.code === "LOCKED") throw new LockedError();
    throw new Error(response.error);
  }
  return response.result;
}

export class KeyringClientProvider implements WalletProvider {
  private unlocked = false;
  private accountsCache: Account[] = [];

  async generateMnemonic(): Promise<string> {
    return sendRequest({ op: "generateMnemonic" });
  }

  async createWallet(mnemonic: string, password: string): Promise<Account> {
    const account = await sendRequest({ op: "createWallet", mnemonic, password });
    this.unlocked = true;
    this.accountsCache = [account];
    return account;
  }

  async hasWallet(): Promise<boolean> {
    return sendRequest({ op: "hasWallet" });
  }

  async unlock(password: string): Promise<Account[]> {
    const accounts = await sendRequest({ op: "unlock", password });
    this.unlocked = true;
    this.accountsCache = accounts;
    return accounts;
  }

  lock(): void {
    this.unlocked = false;
    this.accountsCache = [];
    void sendRequest({ op: "lock" });
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  async addAccount(): Promise<Account> {
    const account = await sendRequest({ op: "addAccount" });
    this.accountsCache = [...this.accountsCache, account];
    return account;
  }

  async removeLastAccount(): Promise<void> {
    await sendRequest({ op: "removeLastAccount" });
    this.accountsCache = this.accountsCache.slice(0, -1);
  }

  async renameAccount(index: number, name: string): Promise<void> {
    await sendRequest({ op: "renameAccount", index, name });
    const account = this.accountsCache.find((a) => a.index === index);
    if (account) account.name = name;
  }

  getAccounts(): Account[] {
    return this.accountsCache;
  }

  async getMnemonic(): Promise<string> {
    return sendRequest({ op: "getMnemonic" });
  }

  async changePassword(current: string, next: string): Promise<void> {
    await sendRequest({ op: "changePassword", current, next });
  }

  async sendTransaction(
    accountIndex: number,
    tx: { to: string; value: bigint; data?: string },
    network: NetworkInfo,
  ): Promise<string> {
    return sendRequest({ op: "sendTransaction", accountIndex, tx, network });
  }

  /**
   * A viem-compatible signer for `address` whose signing callbacks proxy to
   * the keyring (SW or dev fallback) — the raw private key never leaves it,
   * only signatures cross this boundary. Used by the eERC provider, which
   * needs a real signer-bound WalletClient, not a one-off signature.
   */
  getRemoteAccount(address: string) {
    return toAccount({
      address: address as `0x${string}`,
      async signMessage({ message }) {
        const msg = typeof message === "string" ? message : message.raw.toString();
        return sendRequest({ op: "signMessage", address, message: msg }) as Promise<`0x${string}`>;
      },
      async signTransaction(tx) {
        return sendRequest({
          op: "signTransaction",
          address,
          tx: tx as Record<string, unknown>,
        }) as Promise<`0x${string}`>;
      },
      async signTypedData(data) {
        return sendRequest({
          op: "signTypedData",
          address,
          data: data as Record<string, unknown>,
        }) as Promise<`0x${string}`>;
      },
    });
  }

  /** Danger: wipes the stored vault. */
  async reset(): Promise<void> {
    await sendRequest({ op: "reset" });
    this.unlocked = false;
    this.accountsCache = [];
  }
}

export const walletProvider = new KeyringClientProvider();
