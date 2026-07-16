// Typed access to public environment variables. No secrets here.
export const env = {
  fujiRpcUrl: process.env.NEXT_PUBLIC_FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113),
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://testnet.snowtrace.io",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  eercRegistrarAddress: process.env.NEXT_PUBLIC_EERC_REGISTRAR_ADDRESS ?? "",
  eercTokenAddress: process.env.NEXT_PUBLIC_EERC_TOKEN_ADDRESS ?? "",
  /** EncryptedERC contract deployed in Converter Mode (deposit/withdraw enabled). */
  eercConverterAddress: process.env.NEXT_PUBLIC_EERC_CONVERTER_ADDRESS ?? "",
  /** Base URL serving the compiled ZK circuit artifacts (wasm/zkey). */
  eercCircuitBase: process.env.NEXT_PUBLIC_EERC_CIRCUITS_BASE ?? "/circuits",
  featureConfidentialTransfers: process.env.NEXT_PUBLIC_FEATURE_CONFIDENTIAL_TRANSFERS === "true",
} as const;
