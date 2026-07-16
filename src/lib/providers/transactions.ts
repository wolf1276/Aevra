import { formatEther, JsonRpcProvider } from "ethers";

import type { GasEstimate, NetworkInfo, TransactionProvider, TxRecord } from "./types";

// Routescan (powers Snowtrace) — free etherscan-compatible API, no key needed.
const API_BASE: Record<number, string> = {
  43113: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api",
  43114: "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api",
};

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
}

export class RpcTransactionProvider implements TransactionProvider {
  async estimateGas(
    from: string,
    tx: { to: string; value: bigint; data?: string },
    network: NetworkInfo,
  ): Promise<GasEstimate> {
    const provider = new JsonRpcProvider(network.rpcUrl, network.chainId);
    const [gasLimit, feeData] = await Promise.all([
      provider.estimateGas({ from, to: tx.to, value: tx.value, data: tx.data }),
      provider.getFeeData(),
    ]);
    const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 25_000_000_000n;
    return { gasLimit, maxFeePerGas, fee: gasLimit * maxFeePerGas };
  }

  async getHistory(address: string, network: NetworkInfo): Promise<TxRecord[]> {
    const base = API_BASE[network.chainId];
    try {
      const res = await fetch(
        `${base}?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=25`,
      );
      const json = await res.json();
      if (!Array.isArray(json.result)) return [];
      return (json.result as EtherscanTx[]).map((t) => ({
        hash: t.hash,
        type: t.from.toLowerCase() === address.toLowerCase() ? "send" : "receive",
        symbol: network.nativeSymbol,
        amount: Number(formatEther(t.value)).toFixed(4),
        timestamp: Number(t.timeStamp) * 1000,
        visibility: "public" as const,
        to: t.to,
        from: t.from,
        status: t.isError === "1" ? ("failed" as const) : ("confirmed" as const),
        explorerUrl: `${network.explorerUrl}/tx/${t.hash}`,
      }));
    } catch {
      return []; // offline / API down — empty history beats a crashed popup
    }
  }
}

export const transactionProvider = new RpcTransactionProvider();
