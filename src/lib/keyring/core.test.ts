import { beforeEach, describe, expect, it } from "vitest";

import { Keyring } from "./core";

// Known test vector — never use on a real network.
const MNEMONIC = "test test test test test test test test test test test junk";
const ADDR0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

describe("Keyring", () => {
  let provider: Keyring;

  beforeEach(() => {
    localStorage.clear();
    provider = new Keyring();
  });

  it("generates a valid 12-word mnemonic", () => {
    expect(provider.generateMnemonic().split(" ")).toHaveLength(12);
  });

  it("creates a wallet and derives the standard first account", async () => {
    const account = await provider.createWallet(MNEMONIC, "pw");
    expect(account.address).toBe(ADDR0);
    expect(provider.isUnlocked()).toBe(true);
    expect(await provider.hasWallet()).toBe(true);
  });

  it("rejects an invalid recovery phrase", async () => {
    await expect(provider.createWallet("not a phrase", "pw")).rejects.toThrow(
      "Invalid recovery phrase",
    );
  });

  it("unlocks with the right password, rejects the wrong one", async () => {
    await provider.createWallet(MNEMONIC, "pw");
    provider.lock();
    expect(provider.isUnlocked()).toBe(false);

    await expect(provider.unlock("wrong")).rejects.toThrow();

    const fresh = new Keyring();
    const accounts = await fresh.unlock("pw");
    expect(accounts[0].address).toBe(ADDR0);
  });

  it("adds accounts and restores the count on unlock", async () => {
    await provider.createWallet(MNEMONIC, "pw");
    const second = await provider.addAccount();
    expect(second.index).toBe(1);
    expect(second.address).not.toBe(ADDR0);

    const fresh = new Keyring();
    expect(await fresh.unlock("pw")).toHaveLength(2);
  });

  it("changes password", async () => {
    await provider.createWallet(MNEMONIC, "pw");
    await provider.changePassword("pw", "new");
    await expect(new Keyring().unlock("pw")).rejects.toThrow();
    expect(await new Keyring().unlock("new")).toHaveLength(1);
  });

  it("reset wipes the vault", async () => {
    await provider.createWallet(MNEMONIC, "pw");
    await provider.reset();
    expect(await provider.hasWallet()).toBe(false);
    expect(provider.isUnlocked()).toBe(false);
  });

  it("locking clears in-memory key material", async () => {
    await provider.createWallet(MNEMONIC, "pw");
    provider.lock();
    expect(() => provider.getMnemonic()).toThrow("Wallet locked");
    await expect(provider.signMessage(ADDR0, "hi")).rejects.toThrow();
  });
});
