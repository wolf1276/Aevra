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

  it("create wallet navigates to personalize and loads portfolio", async () => {
    await useWallet.getState().createWallet(MNEMONIC, "pw");
    expect(useWallet.getState().screen).toEqual({ name: "personalize" });
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

  it("folds WAVAX into AVAX unless developer mode", async () => {
    const { portfolioProvider } = await import("@/lib/providers/portfolio");
    const { shieldProvider } = await import("@/lib/providers/shield.eerc");
    const wavaxToken = {
      symbol: "WAVAX",
      name: "Wrapped AVAX",
      address: "0x1",
      decimals: 18,
      balance: 5n,
      usdValue: 150,
    };
    const shieldedWavax = {
      symbol: "eWAVAX",
      underlyingSymbol: "WAVAX",
      decimals: 2,
      balance: 100n,
      usdValue: 30,
    };
    vi.mocked(portfolioProvider.getTokenBalances).mockResolvedValue([wavaxToken]);
    vi.mocked(shieldProvider.getShieldedBalances).mockResolvedValue([shieldedWavax]);

    await useWallet.getState().createWallet(MNEMONIC, "pw");
    await flush();
    let s = useWallet.getState();
    expect(s.nativeBalance).toBe(12n); // 7 native + 5 folded WAVAX
    expect(s.tokens).toHaveLength(0);
    expect(s.shielded[0]).toMatchObject({ symbol: "eAVAX", underlyingSymbol: "AVAX" });

    useWallet.getState().setSetting("developerMode", true);
    await useWallet.getState().refresh();
    s = useWallet.getState();
    expect(s.nativeBalance).toBe(7n);
    expect(s.tokens[0].symbol).toBe("WAVAX");
    expect(s.shielded[0].symbol).toBe("eWAVAX");

    vi.mocked(portfolioProvider.getTokenBalances).mockResolvedValue([]);
    vi.mocked(shieldProvider.getShieldedBalances).mockResolvedValue([]);
    useWallet.getState().setSetting("developerMode", false);
  });

  it("settings persist across boot", async () => {
    useWallet.getState().setSetting("autoLockMinutes", 15);
    await flush();

    useWallet.setState({ autoLockMinutes: 5 });
    await useWallet.getState().boot();
    expect(useWallet.getState().autoLockMinutes).toBe(15);
  });
});
