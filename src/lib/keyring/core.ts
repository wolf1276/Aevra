// The real key-holding logic. Runs inside the background service worker
// only — decrypted key material never lives anywhere else. Popup-side code
// talks to this through the message-passing client in
// src/lib/providers/wallet.ts, never imports this file directly.
import { HDNodeWallet, JsonRpcProvider, Mnemonic, Wallet } from "ethers";

import type { Account, NetworkInfo } from "@/lib/providers/types";
import { storageGet, storageRemove, storageSet } from "@/lib/storage";

const VAULT_KEY = "aevra.vault"; // ethers-encrypted JSON of the seed wallet
const META_KEY = "aevra.meta"; // { accountCount, names? }

const DERIVE = (i: number) => `m/44'/60'/0'/0/${i}`;

interface Meta {
  accountCount: number;
  names?: Record<number, string>;
}

export class Keyring {
  private root: HDNodeWallet | null = null;
  private accounts: Account[] = [];
  private names: Record<number, string> = {};

  private async saveMeta(): Promise<void> {
    const meta: Meta = { accountCount: this.accounts.length, names: this.names };
    await storageSet(META_KEY, JSON.stringify(meta));
  }

  generateMnemonic(): string {
    return HDNodeWallet.createRandom().mnemonic!.phrase;
  }

  async createWallet(mnemonic: string, password: string): Promise<Account> {
    const phrase = mnemonic.trim().toLowerCase();
    if (!Mnemonic.isValidMnemonic(phrase)) throw new Error("Invalid recovery phrase");
    const root = HDNodeWallet.fromPhrase(phrase); // m/44'/60'/0'/0/0
    const encrypted = await root.encrypt(password);
    await storageSet(VAULT_KEY, encrypted);
    this.root = root;
    this.names = {};
    this.accounts = [this.deriveAccount(0)];
    await this.saveMeta();
    return this.accounts[0];
  }

  async hasWallet(): Promise<boolean> {
    return (await storageGet(VAULT_KEY)) !== null;
  }

  async unlock(password: string): Promise<Account[]> {
    const json = await storageGet(VAULT_KEY);
    if (!json) throw new Error("No wallet found");
    const decrypted = await Wallet.fromEncryptedJson(json, password);
    if (!(decrypted instanceof HDNodeWallet) || !decrypted.mnemonic) {
      throw new Error("Corrupt vault");
    }
    this.root = decrypted;
    const meta: Meta = JSON.parse((await storageGet(META_KEY)) ?? '{"accountCount":1}');
    this.names = meta.names ?? {};
    const count: number = meta.accountCount ?? 1;
    this.accounts = Array.from({ length: count }, (_, i) => this.deriveAccount(i));
    return this.accounts;
  }

  lock(): void {
    this.root = null;
    this.accounts = [];
  }

  /** Check a password against the stored vault without changing unlock state. */
  async verifyPassword(password: string): Promise<boolean> {
    const json = await storageGet(VAULT_KEY);
    if (!json) return false;
    try {
      await Wallet.fromEncryptedJson(json, password);
      return true;
    } catch {
      return false;
    }
  }

  isUnlocked(): boolean {
    return this.root !== null;
  }

  async addAccount(): Promise<Account> {
    const next = this.deriveAccount(this.accounts.length);
    this.accounts.push(next);
    await this.saveMeta();
    return next;
  }

  /** Remove the most recently derived account. Only the last (highest-index)
   * account can be removed — earlier ones must stay to keep derivation indices
   * contiguous with `accountCount`. */
  async removeLastAccount(): Promise<void> {
    if (this.accounts.length <= 1) throw new Error("Cannot remove the only account");
    const removed = this.accounts.pop()!;
    delete this.names[removed.index];
    await this.saveMeta();
  }

  async renameAccount(index: number, name: string): Promise<void> {
    const account = this.accounts.find((a) => a.index === index);
    if (!account) throw new Error("Unknown account");
    account.name = name;
    this.names[index] = name;
    await this.saveMeta();
  }

  getAccounts(): Account[] {
    return this.accounts;
  }

  getMnemonic(): string {
    if (!this.root?.mnemonic) throw new Error("Wallet locked");
    return this.root.mnemonic.phrase;
  }

  getPrivateKey(index: number): string {
    const account = this.accounts.find((a) => a.index === index);
    if (!account) throw new Error("Unknown account");
    return this.signerAt(index).privateKey;
  }

  async changePassword(current: string, next: string): Promise<void> {
    const json = await storageGet(VAULT_KEY);
    if (!json) throw new Error("No wallet found");
    const decrypted = await Wallet.fromEncryptedJson(json, current); // throws on wrong password
    await storageSet(VAULT_KEY, await decrypted.encrypt(next));
  }

  async sendTransaction(
    accountIndex: number,
    tx: { to: string; value: bigint; data?: string },
    network: NetworkInfo,
  ): Promise<string> {
    const signer = this.signerAt(accountIndex).connect(
      new JsonRpcProvider(network.rpcUrl, network.chainId),
    );
    const sent = await signer.sendTransaction({ to: tx.to, value: tx.value, data: tx.data });
    return sent.hash;
  }

  /** Sign primitives used by the eERC remote-signer proxy — raw key never
   *  leaves this file, only the resulting signature crosses the message
   *  boundary back to the popup. */
  async signMessage(address: string, message: string): Promise<string> {
    return this.signerFor(address).signMessage(message);
  }

  async signTransaction(address: string, tx: Record<string, unknown>): Promise<string> {
    return this.signerFor(address).signTransaction(tx);
  }

  async signTypedData(address: string, data: Record<string, unknown>): Promise<string> {
    const { domain, types, message } = data as {
      domain: Record<string, unknown>;
      types: Record<string, { name: string; type: string }[]>;
      message: Record<string, unknown>;
    };
    const { primaryType: _primaryType, ...rest } = types as typeof types & {
      primaryType?: string;
    };
    void _primaryType; // ethers infers primaryType from the types map itself
    return this.signerFor(address).signTypedData(domain, rest, message);
  }

  /** Danger: wipes the stored vault. */
  async reset(): Promise<void> {
    this.lock();
    await storageRemove(VAULT_KEY);
    await storageRemove(META_KEY);
  }

  private signerAt(index: number): HDNodeWallet {
    if (!this.root?.mnemonic) throw new Error("Wallet locked");
    return HDNodeWallet.fromMnemonic(this.root.mnemonic, DERIVE(index));
  }

  private signerFor(address: string): HDNodeWallet {
    const account = this.accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
    if (!account) throw new Error("Unknown account");
    return this.signerAt(account.index);
  }

  private deriveAccount(index: number): Account {
    return {
      address: this.signerAt(index).address,
      name: this.names[index] ?? `Account ${index + 1}`,
      index,
    };
  }
}
