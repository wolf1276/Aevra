// End-to-end smoke test of the provider layer (no UI).
import assert from "node:assert";

const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => mem.set(k, String(v)),
  removeItem: (k: string) => mem.delete(k),
};

import { NETWORKS } from "@/config/networks";
import { portfolioProvider } from "@/lib/providers/portfolio";
import { privacyProvider } from "@/lib/providers/privacy.eerc";
import { shieldProvider } from "@/lib/providers/shield.eerc";
import { transactionProvider } from "@/lib/providers/transactions";
import { walletProvider } from "@/lib/providers/wallet";

async function main() {
  // wallet create / lock / unlock / wrong password
  const mnemonic = await walletProvider.generateMnemonic();
  assert.equal(mnemonic.split(" ").length, 12);
  const acct = await walletProvider.createWallet(mnemonic, "hunter2hunter2");
  assert.match(acct.address, /^0x[0-9a-fA-F]{40}$/);
  walletProvider.lock();
  await assert.rejects(() => walletProvider.unlock("wrong-password"));
  const accounts = await walletProvider.unlock("hunter2hunter2");
  assert.equal(accounts[0].address, acct.address);
  assert.equal(await walletProvider.getMnemonic(), mnemonic);

  // add account derives a new address
  const acct2 = await walletProvider.addAccount();
  assert.notEqual(acct2.address, acct.address);

  // change password round-trip
  await walletProvider.changePassword("hunter2hunter2", "newpass-123");
  walletProvider.lock();
  await walletProvider.unlock("newpass-123");

  // real Fuji RPC: balance + gas estimate
  const bal = await portfolioProvider.getNativeBalance(acct.address, NETWORKS.fuji);
  assert.equal(bal, 0n);
  const est = await transactionProvider.estimateGas(
    "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC",
    { to: acct.address, value: 1n },
    NETWORKS.fuji,
  );
  assert.ok(est.gasLimit >= 21000n && est.fee > 0n);
  const history = await transactionProvider.getHistory(acct.address, NETWORKS.fuji);
  assert.ok(Array.isArray(history));

  // eERC Converter provider — non-chain-writing checks only.
  // (Shield/unshield/transfer against Fuji require a funded wallet and a
  // deployed Converter — see docs/EERC.md for the manual E2E procedure.)
  const assets = shieldProvider.getSupportedAssets();
  assert.ok(assets.some((a) => a.symbol === "USDC") && assets.some((a) => a.symbol === "WAVAX"));

  // native AVAX is not shieldable in Converter Mode
  await assert.rejects(() => shieldProvider.shield(acct.address, "AVAX", 10n ** 18n), /WAVAX/);
  // unknown tokens rejected
  await assert.rejects(() => shieldProvider.shield(acct.address, "DOGE", 1n), /Unsupported/);
  // without a configured converter address, ops fail loudly …
  await assert.rejects(() => shieldProvider.shield(acct.address, "USDC", 1n), /Converter/);
  // … while balance reads degrade to empty instead of crashing the popup
  assert.deepEqual(await shieldProvider.getShieldedBalances(acct.address), []);
  assert.ok(Array.isArray(await shieldProvider.getShieldedActivity(acct.address)));

  // privacy stats work from public-only holdings (0 shielded)
  const stats = await privacyProvider.getStats(acct.address);
  assert.equal(stats.shieldedPct, 0);
  assert.ok(Array.isArray(await privacyProvider.getReveals(acct.address)));

  // locked wallet → no decryption possible → empty shielded balances
  walletProvider.lock();
  assert.deepEqual(await shieldProvider.getShieldedBalances(acct.address), []);

  console.log("ALL SMOKE CHECKS PASSED");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("SMOKE FAILED:", e);
    process.exit(1);
  },
);
