import { defineChain } from "viem";
import { avalanche as mainnetBase, avalancheFuji as fujiBase } from "viem/chains";

import type { NetworkInfo } from "@/lib/providers/types";

import { env } from "./env";

// Avalanche Fuji, with RPC/explorer overridable via env.
export const avalancheFuji = defineChain({
  ...fujiBase,
  rpcUrls: {
    default: { http: [env.fujiRpcUrl] },
  },
  blockExplorers: {
    default: { name: "SnowTrace", url: env.explorerUrl },
  },
});

const BASE_CHAIN = { fuji: fujiBase, mainnet: mainnetBase } as const;

/** The viem Chain for the currently active network — RPC/explorer always
 *  reflect `network`, never a hardcoded default, so switching networks at
 *  runtime doesn't leave stale chain config behind. */
export function chainFor(network: NetworkInfo) {
  const base = BASE_CHAIN[network.id];
  return defineChain({
    ...base,
    rpcUrls: { default: { http: [network.rpcUrl] } },
    blockExplorers: {
      default: {
        name: base.blockExplorers?.default.name ?? network.name,
        url: network.explorerUrl,
      },
    },
  });
}
