import { Contract, JsonRpcProvider } from "ethers";

import { TRACKED_TOKENS } from "@/config/networks";
import { withRetry } from "@/lib/rpc-retry";

import type { NetworkInfo, PortfolioProvider, TokenBalance } from "./types";

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
const PRICE_MESSAGE = "aevra.price" as const;
const hasExtensionRuntime = typeof chrome !== "undefined" && !!chrome.runtime?.id;

let cachedPrice: { value: number; at: number } | null = null;

// Popup-context fetch to CoinGecko hits real CORS (extension pages don't get
// the host_permissions bypass that background service workers get), so route
// through the background worker there; `next dev` has no extension runtime.
async function fetchAvaxPrice(): Promise<{ "avalanche-2": { usd: number } }> {
  if (!hasExtensionRuntime) {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd",
    );
    return res.json();
  }
  const response = await chrome.runtime.sendMessage({ type: PRICE_MESSAGE });
  if (!response.ok) throw new Error(response.error);
  return response.result;
}

export class RpcPortfolioProvider implements PortfolioProvider {
  async getNativeBalance(address: string, network: NetworkInfo): Promise<bigint> {
    const provider = new JsonRpcProvider(network.rpcUrl, network.chainId);
    return withRetry(() => provider.getBalance(address));
  }

  async getTokenBalances(address: string, network: NetworkInfo): Promise<TokenBalance[]> {
    const provider = new JsonRpcProvider(network.rpcUrl, network.chainId);
    const price = await this.getAvaxUsdPrice();
    const tokens = TRACKED_TOKENS[network.id];
    return Promise.all(
      tokens.map(async (t) => {
        let balance = 0n;
        try {
          balance = await withRetry(() =>
            new Contract(t.address, ERC20_ABI, provider).balanceOf(address),
          );
        } catch {
          // RPC hiccup — show zero rather than crash the popup
        }
        const units = Number(balance) / 10 ** t.decimals;
        // USDC ≈ $1; WAVAX ≈ AVAX price
        const usdValue = t.symbol === "USDC" ? units : units * price;
        return { ...t, balance, usdValue };
      }),
    );
  }

  async getAvaxUsdPrice(): Promise<number> {
    if (cachedPrice && Date.now() - cachedPrice.at < 60_000) return cachedPrice.value;
    try {
      const json = await withRetry(fetchAvaxPrice);
      cachedPrice = { value: json["avalanche-2"].usd, at: Date.now() };
    } catch {
      cachedPrice = { value: cachedPrice?.value ?? 25, at: Date.now() }; // stale/fallback price
    }
    return cachedPrice.value;
  }
}

export const portfolioProvider = new RpcPortfolioProvider();
