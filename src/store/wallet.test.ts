import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the data providers so store tests don't hit RPC or the eERC SDK.
vi.mock("@/lib/providers/portfolio", () => ({
  portfolioProvider: {
    getNativeBalance: vi.fn().mockResolvedValue(7n),
    getTokenBalances: vi.fn().mockResolvedValue([]),
    getAvaxUsdPrice: vi.fn().mockResolvedValue(30),
  },
}));
vi.mock("@/lib/providers/shield.eerc", () => ({
  shieldProvider: {
    getShieldedBalances: vi.fn().mockResolvedValue([]),
    getShieldedActivity: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/providers/privacy.eerc", () => ({
  privacyProvider: {
    getStats: vi.fn().mockResolvedValue(null),
    getReveals: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/providers/transactions", () => ({
  transactionProvider: { getHistory: vi.fn().mockResolvedValue([]) },
}));

import { useWallet } from "./wallet";

const MNEMONIC = "test test test test test test test test test test test junk";

async function flush() {
  await new Promise((r) => setTimeout(r, 50));
}

describe("wallet store", () => {
  beforeEach(() => {
    localStorage.clear();
    useWallet.getState().lock();
    useWallet.setState({ booted: false, screen: { name: "welcome" }, accounts: [] });
  });

  it("boot with no wallet lands on welcome", async () => {
    await useWallet.getState().boot();
    expect(useWallet.getState().screen).toEqual({ name: "welcome" });
    expect(useWallet.getState().booted).toBe(true);
  });

  it("create wallet navigates home and loads portfolio", async () => {
    await useWallet.getState().createWallet(MNEMONIC, "pw");
    expect(useWallet.getState().screen).toEqual({ name: "home" });
    expect(useWallet.getState().accounts).toHaveLength(1);
    await flush();
    expect(useWallet.getState().nativeBalance).toBe(7n);
    expect(useWallet.getState().avaxPrice).toBe(30);
  });

  it("boot with existing wallet lands on unlock; unlock restores accounts", async () => {
    await useWallet.getState().createWallet(MNEMONIC, "pw");
    useWallet.getState().lock();
    expect(useWallet.getState().screen).toEqual({ name: "unlock" });

    await useWallet.getState().boot();
    expect(useWallet.getState().screen).toEqual({ name: "unlock" });

    await useWallet.getState().unlock("pw");
    expect(useWallet.getState().screen).toEqual({ name: "home" });
    expect(useWallet.getState().accounts).toHaveLength(1);
  });

  it("navigate switches screens", () => {
    useWallet.getState().navigate({ name: "settings" });
    expect(useWallet.getState().screen).toEqual({ name: "settings" });
    useWallet.getState().navigate({ name: "send", symbol: "AVAX" });
    expect(useWallet.getState().screen).toEqual({ name: "send", symbol: "AVAX" });
  });

  it("settings persist across boot", async () => {
    useWallet.getState().setSetting("autoLockMinutes", 15);
    useWallet.getState().setSetting("defaultSendMode", "public");
    await flush();

    useWallet.setState({ autoLockMinutes: 5, defaultSendMode: "shielded" });
    await useWallet.getState().boot();
    expect(useWallet.getState().autoLockMinutes).toBe(15);
    expect(useWallet.getState().defaultSendMode).toBe("public");
  });
});
