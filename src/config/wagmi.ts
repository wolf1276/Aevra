import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

import { avalancheFuji } from "./chains";
import { env } from "./env";

// Configuration only — no connection is initiated here.
// `injected` covers Core Wallet (and any EIP-6963 provider).
export const wagmiConfig = createConfig({
  chains: [avalancheFuji],
  connectors: [
    injected(),
    ...(env.walletConnectProjectId
      ? [walletConnect({ projectId: env.walletConnectProjectId })]
      : []),
  ],
  transports: {
    [avalancheFuji.id]: http(env.fujiRpcUrl),
  },
});
