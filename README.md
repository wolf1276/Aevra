# Aevra

Chrome extension wallet for **Avalanche eERC confidential assets**, targeting the **Fuji testnet**.

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · pnpm

> Scaffold only — no wallet features implemented yet.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in values as needed
pnpm dev                     # popup UI at http://localhost:3000, hot reload
```

## Scripts

| Command                  | What it does                                       |
| ------------------------ | -------------------------------------------------- |
| `pnpm dev`               | Dev server with fast refresh (popup UI in browser) |
| `pnpm build`             | Next.js static export → `out/`                     |
| `pnpm build:ext`         | Full extension build (popup + worker + manifest)   |
| `pnpm package`           | `build:ext` + zip → `aevra-extension.zip`          |
| `pnpm lint` / `lint:fix` | ESLint (import sorting, unused-import removal)     |
| `pnpm format`            | Prettier                                           |
| `pnpm typecheck`         | `tsc --noEmit`                                     |

## Build & load the extension

```bash
pnpm build:ext
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `out/` directory
4. Copy the extension ID into `NEXT_PUBLIC_EXTENSION_ID` in `.env.local`

Rebuild (`pnpm build:ext`) and click the extension's reload button after changes. For fast UI iteration use `pnpm dev` in the browser; the popup is a plain Next.js page.

## Project structure

```
src/
  app/            Next.js App Router (popup entry = /)
  components/     Shared React components
  hooks/          React hooks
  lib/
    eerc/         eERC confidential-asset logic (placeholder)
    avalanche/    Avalanche helpers (placeholder)
    contracts/    ABIs + typed contract wrappers (placeholder)
  config/         env.ts, chains.ts, wagmi.ts
  providers/      React context providers
  store/          Client state
  types/          Shared TypeScript types
  utils/          Pure utilities
  extension/
    manifest.json Manifest V3
    background/   Service worker entry
    content/      Content script entry
public/
  assets/         Static assets
  icons/          Extension icons (16/48/128)
contracts/        Raw contract artifacts (ABIs, deployments)
docs/             Documentation
scripts/          build-extension.mjs
```

## Fuji configuration

Network config lives in `src/config/chains.ts`, driven by env vars:

| Variable                   | Default                                      |
| -------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_FUJI_RPC_URL` | `https://api.avax-test.network/ext/bc/C/rpc` |
| `NEXT_PUBLIC_CHAIN_ID`     | `43113`                                      |
| `NEXT_PUBLIC_EXPLORER_URL` | `https://testnet.snowtrace.io`               |

**Switching RPCs:** set `NEXT_PUBLIC_FUJI_RPC_URL` in `.env.local` (e.g. an Infura/Ankr/QuickNode Fuji endpoint) and rebuild.

## Wallets

`src/config/wagmi.ts` declares connectors only (nothing connects at import time):

- **Injected** — covers Core Wallet and any EIP-6963 provider
- **WalletConnect** — enabled when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set

## Adding future contracts

1. Drop the ABI/artifact in `contracts/`
2. Add the address as a `NEXT_PUBLIC_*_ADDRESS` var in `.env.example` and `.env.local`, expose it in `src/config/env.ts`
3. Create a typed wrapper in `src/lib/contracts/`
