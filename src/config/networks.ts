import type { NetworkId, NetworkInfo } from "@/lib/providers/types";

import { env } from "./env";

export const NETWORKS: Record<NetworkId, NetworkInfo> = {
  fuji: {
    id: "fuji",
    name: "Fuji",
    chainId: 43113,
    rpcUrl: env.fujiRpcUrl,
    fallbackRpcUrl: env.fujiRpcUrlFallback || undefined,
    explorerUrl: env.explorerUrl,
    nativeSymbol: "AVAX",
    converterAddress: env.eercConverterAddress,
    registrarAddress: env.eercRegistrarAddress,
  },
  mainnet: {
    id: "mainnet",
    name: "Mainnet",
    chainId: 43114,
    rpcUrl: env.mainnetRpcUrl,
    fallbackRpcUrl: env.mainnetRpcUrlFallback || undefined,
    explorerUrl: env.mainnetExplorerUrl,
    nativeSymbol: "AVAX",
    converterAddress: env.eercConverterAddressMainnet,
    registrarAddress: env.eercRegistrarAddressMainnet,
  },
};

// Known ERC20s to track per network (Fuji testnet tokens).
export const TRACKED_TOKENS: Record<
  NetworkId,
  { symbol: string; name: string; address: string; decimals: number }[]
> = {
  fuji: [
    {
      symbol: "USDC",
      name: "USD Coin (Fuji)",
      address: "0x5425890298aed601595a70AB815c96711a31Bc65",
      decimals: 6,
    },
    {
      symbol: "WAVAX",
      name: "Wrapped AVAX (Fuji)",
      address: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c",
      decimals: 18,
    },
  ],
  mainnet: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      decimals: 6,
    },
    {
      symbol: "WAVAX",
      name: "Wrapped AVAX",
      address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
      decimals: 18,
    },
  ],
};
