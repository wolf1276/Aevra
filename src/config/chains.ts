import { defineChain } from "viem";
import { avalancheFuji as fujiBase } from "viem/chains";

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
