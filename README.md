# Aevra

Aevra is a Chrome extension wallet for Avalanche that shields balances and transfer amounts by default, using the [eERC (Encrypted ERC) standard](https://github.com/ava-labs/EncryptedERC) in Converter Mode. It targets people who want to hold and send assets on Avalanche without every balance and transfer being permanently public — without asking them to understand zero-knowledge proofs, viewer keys, or converter contracts to do it.

Public blockchains make every balance and transaction history visible to anyone who looks. eERC addresses this at the contract level: balances and amounts are encrypted on-chain, and transfers are proven valid with zero-knowledge proofs instead of being readable in plaintext. Aevra is a client for that standard — it generates the proofs, manages the encrypted state, and converts assets in and out of their confidential form as part of the normal send flow, rather than as a separate step the user has to think about.

## Status

Fuji testnet. Mainnet contract addresses are supported in configuration but the extension currently ships testnet-first (see [Supported networks](#supported-networks)).

## Features

- Avalanche wallet — HD account generation and management, standard mnemonic recovery
- Confidential payments via eERC Converter Mode — encrypted balances and transfer amounts
- Automatic shielding — a send that needs more confidential balance than is currently shielded converts the shortfall from the public balance first
- Automatic unshielding — native-AVAX-backed withdrawals automatically unwrap WAVAX back to AVAX
- Proof caching — a prepared transfer (proof, simulated calldata, gas estimate) is cached per sender and invalidated automatically when the underlying encrypted balance changes, so fee estimation and the actual send don't regenerate the same proof twice
- Fee estimation that reflects the real transaction — determines which steps (wrap, approve, shield, transfer) a send actually needs and simulates each one, including generating the real ZK proof
- Background key management — private keys and the decrypted vault live only in the extension's service worker, never in the popup
- Auto-lock — the wallet re-locks after a configurable idle period, and also re-locks whenever Chrome kills the service worker, by design
- Dynamic network support — switching networks drops chain-bound sessions and proof caches and rebuilds them against the new chain
- Portfolio view — public and shielded balances, USD valuation, percent of portfolio shielded
- Activity history — plain-language transaction log; shielded-transfer amounts are stored masked and only revealed through explicit decryption
- Manifest V3 extension — service worker background, no persistent background page

## Architecture

```
Popup (React / Next.js, static export)
        │
        ▼
Background Service Worker  ──  holds the only decrypted keyring instance
        │
        ▼
Wallet Provider  ──  message-passing client, proxies signing to the SW
        │
        ▼
Shield Provider  ──  eERC Converter: registration, shield/unshield, proofs
        │
        ▼
Privacy Provider  ──  portfolio shielded %, transaction reveal/disclosure
        │
        ▼
EncryptedERC Converter (on-chain contract)
        │
        ▼
Avalanche C-Chain
```

The popup never holds a private key. `KeyringClientProvider` (`src/lib/providers/wallet.ts`) sends every signing operation to the background service worker over `chrome.runtime.sendMessage`; the service worker is the only place a decrypted key exists in memory. When running outside the extension (`pnpm dev`), the same provider falls back to an in-process `Keyring` so local development doesn't require loading an unpacked extension.

## Confidential payment pipeline

Implemented in `src/lib/providers/shield.eerc.ts` (`EERCConverterProvider`).

**Registration.** Before an address can send or receive confidentially, it registers a keypair with the eERC Registrar contract. `registerUserIfNeeded()` checks on-chain registration status, and if unregistered, generates a registration proof and submits it. Recipients must also be registered — a shielded send to an unregistered address is rejected before it reaches the network, because the recipient's public key is what the amount gets encrypted against.

**Session setup.** A session is built per `{network, address}`: a read client using viem's `fallback()` transport across a primary and secondary RPC, and a single-shot write client (no retries, to avoid double-submitting a broadcast transaction). The session checks the RPC's reported chain ID against the expected network and validates that the on-chain auditor public key is a nonzero point on the curve before allowing any transfer or withdrawal.

**Decryption key.** Derived deterministically from a wallet signature using the eERC SDK's own scheme, cached in extension storage per address, and re-derivable at any time from the vault.

**Proof generation.** Registration, transfer, mint, and withdraw each have their own circuit (WASM + Groth16 zkey), fetched from a configurable base path and loaded in a Web Worker. `prepareTransfer()` builds and caches one proof per sender, keyed by a signature over the transfer parameters and the current encrypted-balance snapshot — the cache is invalidated the instant that snapshot changes, so a stale proof is never reused for money it no longer describes.

**Simulation, broadcast, confirmation.** Every state-changing call — approve, shield deposit, withdraw, confidential transfer, WAVAX wrap/unwrap — goes through simulate, then write, then confirm. Confirmation polls for a receipt with a bounded number of retries; if it times out, the pipeline does not treat the transaction as failed. It surfaces a pending result carrying the transaction hash, since the transaction may still land.

**Auto shield / auto unshield.** A send checks the current shielded (encrypted) balance first. If it's insufficient, the shortfall is shielded from the public balance automatically before the confidential transfer is sent. Native AVAX is wrapped to WAVAX before shielding, since eERC operates on ERC-20s; an unshield of AVAX-backed balance unwraps back to native AVAX afterward.

**Gas estimation.** `estimateSendFee()` determines exactly which steps a given send requires (wrap, approve, shield, transfer) and simulates each — including generating the real transfer proof, at the same cost as an actual send. Callers debounce on recipient/amount/token changes rather than calling this per keystroke.

## Security

- **Private keys.** Held only in the background service worker's memory, as an ethers HD wallet decrypted from a password-encrypted (scrypt) JSON vault in storage. The vault at rest is encrypted; the decrypted key is never written to storage and never crosses into the popup.
- **Background isolation.** All signing is proxied from the popup through `chrome.runtime.sendMessage` to the service worker. The popup only ever receives signatures, not key material.
- **Session handling.** An auto-lock alarm (`chrome.alarms`) is reset on every keyring operation and fires `keyring.lock()` after a configurable idle period. If Chrome terminates the service worker — which it can do at any time under Manifest V3 — the in-memory keyring is gone and the wallet is locked on next use. This is treated as the intended behavior, not a bug to work around.
- **Proof generation.** Runs client-side; no transaction amount or balance is ever sent to a third party to be proven.
- **Transaction simulation.** Every write is simulated before being broadcast, surfacing revert reasons ahead of submission rather than after paying gas for a failed transaction.
- **Auditor key validation.** The on-chain auditor public key is checked to be a valid, nonzero curve point before any transfer or withdrawal is allowed to proceed.
- **Receipt confirmation.** Broadcast transactions are polled for a receipt rather than assumed successful; reverted receipts are reported as reverted, not silently treated as sent.
- **Network verification.** The chain ID reported by the connected RPC is checked against the expected network before any session is used.
- **RPC fallback.** Reads go through a primary/fallback RPC pair with retries; writes use a single RPC with no retries, so a broadcast is never accidentally submitted twice.

## Project structure

```
src/
  app/                Next.js App Router — the popup UI, static-exported
  components/
    screens/          Home, Assets, Send, Activity, Privacy, Settings, Onboarding, AddressBook
    home/              Home-screen widgets (e.g. FaucetCard)
    ui.tsx              Shared UI primitives
  config/             env.ts (typed env + fail-fast validation), chains.ts, networks.ts
  extension/
    manifest.json       Manifest V3 definition
    background/          Service worker entry point
  hooks/              React hooks
  lib/
    avalanche/           Chain and RPC helpers
    contracts/            ABIs and typed contract wrappers
    keyring/               Keyring core, message protocol, dispatcher
    providers/             wallet, shield (eERC), privacy (eERC), portfolio, transactions
    storage.ts             Extension storage wrapper
    format.ts              Numeric/unit formatting
  store/              Zustand application state
  types/              Shared TypeScript types
  utils/              Pure utilities

contracts/            ABIs and deployment artifacts
docs/                  EERC.md, RELEASE.md
scripts/               build-extension.mjs, validate-build.mjs, fetch-circuits.mjs
public/                Static assets, extension icons, ZK circuit artifacts
```

`src/lib/eerc/` and top-level `src/providers/` currently exist but hold no logic — the confidential-payment implementation lives in `src/lib/providers/shield.eerc.ts` and `privacy.eerc.ts`.

## Installation

Requires [pnpm](https://pnpm.io) (`packageManager: pnpm@11.13.1` in `package.json`).

```bash
pnpm install
cp .env.example .env.local
pnpm circuits          # fetch ZK circuit artifacts into public/circuits
```

**Development**

```bash
pnpm dev               # popup UI at http://localhost:3000, hot reload
```

**Production build**

```bash
pnpm build:prod        # static export → out/
pnpm package           # build + validate + zip → Aevra-v<version>.zip
```

**Load unpacked extension**

1. `pnpm build:prod`
2. Open `chrome://extensions`
3. Enable Developer mode
4. Load unpacked → select `out/`
5. Copy the generated extension ID into `NEXT_PUBLIC_EXTENSION_ID` in `.env.local`

## Configuration

All variables are read and validated in `src/config/env.ts`. If `NEXT_PUBLIC_FEATURE_CONFIDENTIAL_TRANSFERS` is `true` but converter/registrar addresses are missing, the app fails fast at startup rather than degrading silently.

| Variable                                     | Purpose                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_FUJI_RPC_URL`                   | Fuji RPC endpoint (default `https://api.avax-test.network/ext/bc/C/rpc`) |
| `NEXT_PUBLIC_FUJI_RPC_URL_FALLBACK`          | Fallback Fuji RPC for the read client                                    |
| `NEXT_PUBLIC_MAINNET_RPC_URL`                | Mainnet RPC endpoint (default `https://api.avax.network/ext/bc/C/rpc`)   |
| `NEXT_PUBLIC_MAINNET_RPC_URL_FALLBACK`       | Fallback mainnet RPC                                                     |
| `NEXT_PUBLIC_CHAIN_ID`                       | Active chain ID (`43113` = Fuji)                                         |
| `NEXT_PUBLIC_EXPLORER_URL`                   | Fuji block explorer                                                      |
| `NEXT_PUBLIC_MAINNET_EXPLORER_URL`           | Mainnet block explorer                                                   |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`       | [WalletConnect Cloud](https://cloud.walletconnect.com) project ID        |
| `NEXT_PUBLIC_EERC_REGISTRAR_ADDRESS`         | Fuji Registrar contract                                                  |
| `NEXT_PUBLIC_EERC_CONVERTER_ADDRESS`         | Fuji Converter contract                                                  |
| `NEXT_PUBLIC_EERC_TOKEN_ADDRESS`             | Fuji test token address                                                  |
| `NEXT_PUBLIC_EERC_REGISTRAR_ADDRESS_MAINNET` | Mainnet Registrar contract                                               |
| `NEXT_PUBLIC_EERC_CONVERTER_ADDRESS_MAINNET` | Mainnet Converter contract                                               |
| `NEXT_PUBLIC_EERC_CIRCUITS_BASE`             | Where compiled ZK circuits are served from (default `/circuits`)         |
| `NEXT_PUBLIC_FEATURE_CONFIDENTIAL_TRANSFERS` | Feature flag gating the confidential pipeline                            |
| `NEXT_PUBLIC_EXTENSION_ID`                   | Chrome extension ID, set after first unpacked load                       |

`.env.example` currently documents the Fuji and shared variables; the mainnet RPC, explorer, and contract-address variables above are read by `env.ts` but not yet listed there.

## Supported networks

Defined in `src/config/networks.ts`: Fuji (chain ID `43113`) and Avalanche mainnet (chain ID `43114`), each with its own RPC/fallback RPC, explorer, and Converter/Registrar addresses. `chainFor(network)` in `src/config/chains.ts` builds the viem `Chain` for whichever network is currently active — there's no hardcoded default baked into the client.

Switching networks (`setNetwork()` on the shield and privacy providers) drops all cached sessions and proof caches, since both are bound to a specific chain and contract deployment, and rebuilds them against the new network on next use.

The extension manifest currently describes the wallet as targeting Fuji; mainnet host permissions and configuration exist but the primary target is testnet.

## Error handling

Errors from the confidential payment pipeline are normalized in `shield.eerc.ts` to consistent, user-facing messages:

| Condition                 | Behavior                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet locked             | `"Wallet locked"`, mapped to a `LOCKED` code by the background handler                                                                             |
| Wrong network             | `"Network mismatch — RPC is chain {id}"`                                                                                                           |
| Registration timeout      | Separate timeouts for status check, proof generation, and confirmation                                                                             |
| Simulation failure        | `"Simulation failed: {message}"` before anything is broadcast                                                                                      |
| Transaction reverted      | Reported after a confirmed receipt with `status !== "success"`                                                                                     |
| Pending transaction       | Receipt polling timeout raises a `TransactionPendingError` carrying the tx hash; treated as pending, not failed, so it stays trackable in Activity |
| RPC failure               | Network/connection errors normalized to `"RPC error: {message}"`                                                                                   |
| Invalid auditor key       | `"Auditor public key is invalid or not configured on-chain."`                                                                                      |
| Unregistered recipient    | `"Recipient can't receive private payments yet"`                                                                                                   |
| User-rejected transaction | `"Transaction rejected"`                                                                                                                           |
| Insufficient balance      | `"Insufficient balance"`                                                                                                                           |

## Performance

- **Proof cache** — a prepared transfer (proof, calldata, gas estimate) is generated once per sender and reused between fee estimation and the actual send, invalidated only when the encrypted balance it was computed against changes.
- **Simulation before broadcast** — catches reverts before a transaction is submitted, avoiding wasted gas and a slower failure path.
- **Fee estimation** — computes only the steps a given send actually needs (wrap/approve/shield/transfer) rather than a fixed upper bound.
- **RPC fallback** — reads retry across a primary and secondary RPC with bounded retry count and delay; writes are single-shot to avoid duplicate broadcasts.
- **Background session cache** — shield/privacy sessions are cached per `{network, address}` and reused across popup opens until the network or account changes.

## Development

```bash
pnpm install
pnpm dev               # Next.js dev server
pnpm build:prod        # production static export
pnpm lint               # ESLint (flat config, import sort + unused-imports)
pnpm typecheck          # tsc --noEmit, strict mode
pnpm test               # Vitest
```

`pnpm verify` runs the full release gate: lint → format check → typecheck → test → dependency audit → production package build.

## Testing

TypeScript runs in `strict` mode throughout. Vitest runs in a Node environment by default — ethers' vault encryption doesn't behave correctly under jsdom's cross-realm `Uint8Array` — with jsdom opted into per-file where a test needs the DOM. Current suite: `src/lib/format.test.ts`, `src/store/wallet.test.ts`, `src/lib/keyring/core.test.ts`.

Playwright is configured for end-to-end testing (`playwright.config.ts`, `e2e/`). Exercising the confidential payment pipeline against real Fuji contracts — registration, shielding, a confidential transfer — requires a funded testnet wallet and isn't covered by the automated suite.

## Roadmap

- Mainnet launch
- Additional Avalanche network support
- Hardware wallet support
- Transaction batching
- Improved activity analytics

## Contributing

1. Fork the repo and branch off `main`.
2. Run `pnpm verify` before opening a PR — it's the same gate CI runs.
3. Keep diffs focused to the change being made.
4. Write commit messages that explain why a change is needed, not just what changed.

## License

[MIT](LICENSE)
