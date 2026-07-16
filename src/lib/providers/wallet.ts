import { HDNodeWallet, JsonRpcProvider, Mnemonic, Wallet } from "ethers";

import { storageGet, storageRemove, storageSet } from "@/lib/storage";

import type { Account, NetworkInfo, WalletProvider } from "./types";

const VAULT_KEY = "aevra.vault"; // ethers-encrypted JSON of the seed wallet
const META_KEY = "aevra.meta"; // { accountCount }

const DERIVE = (i: number) => `m/44'/60'/0'/0/${i}`;

export class EthersWalletProvider implements WalletProvider {
  private root: HDNodeWallet | null = null;
  private accounts: Account[] = [];

  generateMnemonic(): string {
    return HDNodeWallet.createRandom().mnemonic!.phrase;
  }

  async createWallet(mnemonic: string, password: string): Promise<Account> {
    const phrase = mnemonic.trim().toLowerCase();
    if (!Mnemonic.isValidMnemonic(phrase)) throw new Error("Invalid recovery phrase");
    const root = HDNodeWallet.fromPhrase(phrase); // m/44'/60'/0'/0/0
    const encrypted = await root.encrypt(password);
    await storageSet(VAULT_KEY, encrypted);
    await storageSet(META_KEY, JSON.stringify({ accountCount: 1 }));
    this.root = root;
    this.accounts = [this.deriveAccount(0)];
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
    const meta = JSON.parse((await storageGet(META_KEY)) ?? '{"accountCount":1}');
    const count: number = meta.accountCount ?? 1;
    this.accounts = Array.from({ length: count }, (_, i) => this.deriveAccount(i));
    return this.accounts;
  }

  lock(): void {
    this.root = null;
    this.accounts = [];
  }

  isUnlocked(): boolean {
    return this.root !== null;
  }

  async addAccount(): Promise<Account> {
    const next = this.deriveAccount(this.accounts.length);
    this.accounts.push(next);
    await storageSet(META_KEY, JSON.stringify({ accountCount: this.accounts.length }));
    return next;
  }

  getAccounts(): Account[] {
    return this.accounts;
  }

  getMnemonic(): string {
    if (!this.root?.mnemonic) throw new Error("Wallet locked");
    return this.root.mnemonic.phrase;
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

  private deriveAccount(index: number): Account {
    return { address: this.signerAt(index).address, name: `Account ${index + 1}`, index };
  }
}

export const walletProvider = new EthersWalletProvider();
