<div align="center">

<img src="public/icons/icon128.png" width="72" alt="Aevra" />

# Aevra

**Privacy by Default.**

A privacy-native Chrome wallet built on Avalanche that makes confidential payments effortless.

[![Version](https://img.shields.io/badge/version-0.1.0-6366f1)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-2ea043)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](tsconfig.json)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-f9ab00)](src/extension/manifest.json)

Aevra is a Chrome extension wallet that shields balances, amounts, and history on Avalanche — without asking the user to understand how.

</div>

---

## The Problem

Every wallet in production today puts your financial life on a public billboard. Connect a wallet to a dApp and anyone can see:

- What you hold
- What you've sent, to whom, and how much
- Your entire transaction history, indexed and searchable forever

None of this is a bug — it's how public blockchains work. But it means privacy today requires opting in: bridging to a shielded pool, learning a new mental model, trusting a mixer. Privacy should not be a power-user feature. It should be what happens when you do nothing at all.

## The Solution

Aevra is a wallet, not a protocol client. You receive funds. You send funds. That's the whole interface.

Underneath, every balance and transfer is confidential by default — encrypted on-chain, provable without being visible. There is no "enable privacy" toggle, no separate shielded balance to manage, no extra step between you and a private payment. The wallet handles conversion, encryption, and proof generation automatically, on every transaction, every time.

## Why Avalanche

Aevra is built on Avalanche's [eERC (Encrypted ERC) standard](https://github.com/ava-labs/EncryptedERC) rather than a bespoke privacy layer, because:

- **Confidential assets are native, not bolted on.** eERC brings encrypted balances and amounts to standard token contracts, with zero-knowledge proofs verified on-chain.
- **Subsecond finality, high throughput.** Confidential transfers still need to feel instant — Avalanche's consensus makes that possible.
- **A real developer ecosystem.** Tooling, RPCs, and audited contracts already exist; Aevra composes with them instead of reinventing cryptography.

Aevra doesn't reimplement confidential transfers — it's a thin, opinionated client over Avalanche's own privacy infrastructure.

## Key Features

|                              |                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Privacy by Default**       | Every balance and transfer is confidential from the first transaction — no setup required.             |
| **Confidential Payments**    | Amounts and balances are encrypted on-chain; only sender and recipient can decrypt them.               |
| **Chrome Extension**         | Manifest V3, runs as a real browser extension — popup, service worker, and all.                        |
| **Automatic Asset Handling** | Converting a public asset into its confidential form happens behind the send flow, not in front of it. |
| **Proof Generation**         | Zero-knowledge proofs are generated client-side for every shielded operation.                          |
| **Recovery & Security**      | Standard recovery phrase, encrypted local storage, no custodial component.                             |
| **Fast UX**                  | One balance, one send button, one QR code to receive — no protocol jargon in the UI.                   |
| **Modern Interface**         | React 19, Tailwind CSS 4, motion-tuned transitions.                                                    |
| **Minimal Setup**            | Install, create a wallet, receive. No bridging tutorial required.                                      |

## Product Philosophy

> The best privacy technology is invisible.

A user of Aevra should never need to know what a converter mode is, what a viewer key does, or when a shield operation happens. They shouldn't need to know eERC exists at all. Every one of those concepts is real, load-bearing infrastructure — and every one of them is the wallet's problem, not the user's.

If a feature needs an explanation to use safely, it isn't done yet.

## Screenshots

| Home                   | Assets              | Send                        |
| ---------------------- | ------------------- | --------------------------- |
| _balance, at a glance_ | _holdings, unified_ | _one recipient, one amount_ |

| Receive                | Activity                 | Privacy                    | Settings                      |
| ---------------------- | ------------------------ | -------------------------- | ----------------------------- |
| _QR code, no ceremony_ | _plain-language history_ | _what's shielded, and why_ | _recovery, network, security_ |

## Demo

- **Demo video** — a full create → receive → send walkthrough
- **Live walkthrough** — loading the unpacked extension and sending a first confidential payment
- **Architecture diagram** — see [Architecture](#architecture) below

## User Journey

```
   Create Wallet
        │
        ▼
   Receive Funds  ──────  share address / QR, no configuration
        │
        ▼
   Send Payment   ──────  enter amount, hit send
        │
        ▼
Recipient Receives ─────  balance updates, nothing else leaked
        │
        ▼
       Done
```

## Architecture

```
┌─────────────────────────┐
│   Chrome Extension       │  Manifest V3 · popup + service worker
└────────────┬─────────────┘
             ▼
┌─────────────────────────┐
│   React UI                │  screens, components, state (Zustand)
└────────────┬─────────────┘
             ▼
┌─────────────────────────┐
│   Wallet Layer            │  accounts, signing, storage
└────────────┬─────────────┘
             ▼
┌─────────────────────────┐
│   Privacy Layer           │  shield/unshield, proof generation
└────────────┬─────────────┘
             ▼
┌─────────────────────────┐
│   Avalanche eERC           │  encrypted balances, ZK verification
└────────────┬─────────────┘
             ▼
┌─────────────────────────┐
│   Avalanche Network        │  C-Chain (Fuji testnet)
└─────────────────────────┘
```

## Technical Highlights

- **Manifest V3** — service worker background, no persistent background page
- **TypeScript (strict)** — end to end, including provider and store layers
- **React 19 + Next.js 15** — static-exported App Router as the extension's popup UI
- **Tailwind CSS 4** — utility-first styling, no component-library lock-in
- **Provider pattern** — wallet, shield, portfolio, and transaction concerns are isolated behind typed providers (`src/lib/providers/`), so the store never talks to Avalanche directly
- **Secure local storage** — wallet state persisted through a single storage abstraction (`src/lib/storage.ts`)
- **Privacy engine** — confidential send/receive logic lives in `src/lib/eerc/` and `src/lib/providers/shield.eerc.ts`, isolated from UI code

## Folder Structure

```
src/
├── app/                    Next.js App Router — popup entry point
├── components/
│   ├── screens/             Home, Assets, Send, Receive, Activity, Privacy, Settings, Onboarding
│   └── ui.tsx                Shared primitives
├── config/                 env.ts, chains.ts, networks.ts, wagmi.ts
├── extension/
│   ├── manifest.json         Manifest V3
│   └── background/            Service worker entry
├── hooks/                   React hooks
├── lib/
│   ├── avalanche/             Chain + RPC helpers
│   ├── contracts/             ABIs + typed contract wrappers
│   ├── eerc/                  eERC confidential-asset logic
│   ├── providers/             wallet, shield, portfolio, transaction providers
│   └── storage.ts             Encrypted local storage wrapper
├── providers/               React context providers
├── store/                   Zustand app state (screens, accounts, sends)
├── types/                   Shared TypeScript types
└── utils/                   Pure utilities

contracts/                 Raw ABIs and deployment artifacts
docs/                       EERC.md, RELEASE.md
scripts/                    build-extension.mjs, validate-build.mjs, fetch-circuits.mjs
public/                     Static assets, extension icons, ZK circuits
```

## Getting Started

```bash
pnpm install
cp .env.example .env.local
pnpm dev              # popup UI at http://localhost:3000, hot reload
```

### Production build

```bash
pnpm build:prod        # static export → out/
pnpm package           # build + validate + zip → aevra-extension.zip
```

### Load unpacked

1. `pnpm build:ext`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select `out/`
5. Copy the generated extension ID into `NEXT_PUBLIC_EXTENSION_ID` in `.env.local`

## Configuration

Environment variables live in `.env.example`. Copy to `.env.local` and fill in as needed.

| Variable                                     | Purpose                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_FUJI_RPC_URL`                   | Avalanche Fuji RPC endpoint                                       |
| `NEXT_PUBLIC_CHAIN_ID`                       | Target chain ID (`43113` = Fuji)                                  |
| `NEXT_PUBLIC_EXPLORER_URL`                   | Block explorer for links                                          |
| `NEXT_PUBLIC_EERC_CONVERTER_ADDRESS`         | Deployed eERC Converter contract                                  |
| `NEXT_PUBLIC_EERC_REGISTRAR_ADDRESS`         | Deployed eERC Registrar contract                                  |
| `NEXT_PUBLIC_EERC_CIRCUITS_BASE`             | Where compiled ZK circuits are served from                        |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`       | [WalletConnect Cloud](https://cloud.walletconnect.com) project ID |
| `NEXT_PUBLIC_EXTENSION_ID`                   | Chrome extension ID (post-install)                                |
| `NEXT_PUBLIC_FEATURE_CONFIDENTIAL_TRANSFERS` | Feature flag for confidential transfers                           |

Network config is centralized in `src/config/chains.ts` and `src/config/networks.ts` — switching RPC providers is a single env var change plus a rebuild.

## Security

- **Encrypted local storage** — wallet state never persists in plaintext
- **Recovery phrase** — standard mnemonic-based account recovery, generated and shown once
- **Viewer keys** — decrypt your own transaction history without exposing it to anyone else
- **Client-side proof generation** — zero-knowledge proofs are produced locally; the wallet never sends plaintext amounts anywhere
- **No custody** — Aevra never holds keys or funds; it's a client, not a service

## Testing

```bash
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint
pnpm format:check     # Prettier
pnpm test             # Vitest unit tests
pnpm test:e2e         # Playwright
pnpm audit:deps       # dependency audit
pnpm validate         # manifest + build output validation
```

Run the full release gate with:

```bash
pnpm verify
```

`verify` chains lint → format check → typecheck → tests → dependency audit → production package build, and only exits 0 when `aevra-extension.zip` is release-ready.

## Roadmap

- [x] Privacy-first wallet
- [x] Chrome extension (Manifest V3)
- [x] Avalanche eERC integration
- [x] Confidential payments
- [x] Automatic asset handling
- [x] Production build pipeline
- [ ] Cross-wallet support
- [ ] Mobile wallet
- [ ] Hardware wallet
- [ ] Mainnet launch

## Contributing

Issues and PRs are welcome.

1. Fork the repo and create a branch off `main`
2. Run `pnpm install` and `pnpm verify` before opening a PR — CI runs the same gate
3. Keep diffs focused; unrelated formatting changes make review harder
4. Describe _why_ a change is needed, not just what changed

## License

[MIT](LICENSE)

## Acknowledgements

- [Avalanche](https://www.avax.network/) and the [EncryptedERC](https://github.com/ava-labs/EncryptedERC) team, for the confidential-asset standard Aevra builds on
- The broader open-source community whose tooling makes a project like this possible
