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
import { privacyProvider } from "@/lib/providers/privacy.mock";
import { shieldProvider } from "@/lib/providers/shield.mock";
import { transactionProvider } from "@/lib/providers/transactions";
import { walletProvider } from "@/lib/providers/wallet";

async function main() {
  // wallet create / lock / unlock / wrong password
  const mnemonic = walletProvider.generateMnemonic();
  assert.equal(mnemonic.split(" ").length, 12);
  const acct = await walletProvider.createWallet(mnemonic, "hunter2hunter2");
  assert.match(acct.address, /^0x[0-9a-fA-F]{40}$/);
  walletProvider.lock();
  await assert.rejects(() => walletProvider.unlock("wrong-password"));
  const accounts = await walletProvider.unlock("hunter2hunter2");
  assert.equal(accounts[0].address, acct.address);
  assert.equal(walletProvider.getMnemonic(), mnemonic);

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

  // mock shield flow
  const steps: string[] = [];
  const res = await shieldProvider.shield(acct.address, "AVAX", 10n ** 18n, (p) =>
    steps.push(p.step),
  );
  assert.match(res.txHash, /^0x[0-9a-f]{64}$/);
  assert.match(res.proofId, /^proof_/);
  assert.ok(steps.includes("generating-proof") && steps.at(-1) === "done");
  let shielded = await shieldProvider.getShieldedBalances(acct.address);
  assert.equal(shielded[0].symbol, "eAVAX");
  assert.equal(shielded[0].balance, 10n ** 18n);

  // shielded send hides amount
  await shieldProvider.shieldedSend(
    acct.address,
    "AVAX",
    10n ** 17n,
    "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC",
  );
  const activity = await shieldProvider.getShieldedActivity(acct.address);
  assert.equal(activity[0].type, "shielded-send");
  assert.equal(activity[0].amount, "••••");

  // unshield: insufficient rejected, valid succeeds
  await assert.rejects(() => shieldProvider.unshield(acct.address, "eAVAX", 10n ** 19n));
  await shieldProvider.unshield(acct.address, "eAVAX", 4n * 10n ** 17n);
  shielded = await shieldProvider.getShieldedBalances(acct.address);
  assert.equal(shielded[0].balance, 5n * 10n ** 17n);

  // privacy: score 100 (all value shielded, 0 public), reveal, proof
  const stats = await privacyProvider.getStats(acct.address);
  assert.equal(stats.score, 100);
  const reveal = await privacyProvider.revealTransaction(acct.address, activity[0].hash);
  assert.match(reveal.description, /Revealed/);
  const revealed = (await shieldProvider.getShieldedActivity(acct.address)).find(
    (t) => t.hash === activity[0].hash,
  );
  assert.equal(revealed?.revealed, true);
  const proof = await privacyProvider.generateProof(acct.address, activity[0].hash);
  assert.match(proof.proofId, /^proof_/);

  console.log("ALL SMOKE CHECKS PASSED");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("SMOKE FAILED:", e);
    process.exit(1);
  },
);
