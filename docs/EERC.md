# eERC Converter Mode Integration

The Shield layer is implemented with the official Ava Labs SDK
([`@avalabs/eerc-sdk`](https://www.npmjs.com/package/@avalabs/eerc-sdk),
docs: [docs.avacloud.io/encrypted-erc](https://docs.avacloud.io/encrypted-erc/welcome))
in **Converter Mode**: existing public ERC-20s are deposited into the
EncryptedERC contract and become confidential eERC balances.

```
Public ERC20 → approve → deposit(Converter) → encrypted balance
             → confidential transfer → withdraw → public ERC20
```

## Providers

| File                                | Replaces          | Role                                              |
| ----------------------------------- | ----------------- | ------------------------------------------------- |
| `src/lib/providers/shield.eerc.ts`  | `shield.mock.ts`  | `EERCConverterProvider implements ShieldProvider` |
| `src/lib/providers/privacy.eerc.ts` | `privacy.mock.ts` | `EERCPrivacyProvider implements PrivacyProvider`  |

The provider interfaces in `types.ts` are unchanged; the UI, store, and
navigation are untouched (only the two import lines in `src/store/wallet.ts`
now point at the real implementations).

The SDK's non-React `EERC` core class is used directly (not the `useEERC`
hook), driven by viem clients built from the wallet vault's private key —
this keeps the existing class-based provider architecture intact.

## Setup

1. **Deploy contracts** (Fuji). eERC has no canonical public Converter
   deployment; deploy your own with the official contracts:
   [github.com/ava-labs/EncryptedERC](https://github.com/ava-labs/EncryptedERC)
   — run its converter deployment script, which deploys the verifiers,
   Registrar and the EncryptedERC contract with `isConverter = true`, and
   set an auditor public key (required before any transfer/withdraw).
2. **Configure `.env.local`**:
   ```
   NEXT_PUBLIC_EERC_CONVERTER_ADDRESS=0x…   # EncryptedERC (converter)
   NEXT_PUBLIC_EERC_REGISTRAR_ADDRESS=0x…   # Registrar
   ```
3. **Fetch circuit artifacts**: `pnpm circuits` downloads the compiled
   Registration/Transfer/Withdraw/Mint wasm + Groth16 zkeys into
   `public/circuits/` (gitignored; ~tens of MB). Proofs are generated
   client-side by the SDK via snarkjs.

## Behavior notes (documented limitations, not fabrications)

- **ERC-20 only.** The Converter cannot accept native AVAX; the provider
  rejects `shield("AVAX")` with a message to wrap to WAVAX first.
  Shieldable tokens = `TRACKED_TOKENS` (USDC, WAVAX on Fuji).
- **Decimals.** Encrypted balances use the eERC contract's own decimals
  (typically 2), not the underlying ERC-20's. `ShieldedBalance.decimals`
  reports the eERC decimals, so UI amount parsing stays consistent. The SDK
  converts on deposit; sub-precision dust is returned by the contract.
- **Registration.** First shield/unshield/transfer auto-registers the user:
  a decryption key is deterministically derived from a wallet signature
  (`REGISTER(address)` scheme inside the SDK) and the BabyJubJub public key
  is registered on-chain. The derived key is cached in extension storage —
  it is re-derivable from the vault at any time.
- **Recipients must be registered** before they can receive a confidential
  transfer; the provider checks the Registrar and fails with a clear error.
- **Proof IDs.** eERC embeds each Groth16 proof inside the transaction
  itself; the SDK exposes no standalone proof artifacts. Wherever the UI
  shows a proof reference, the transaction hash is used — it is the real
  on-chain artifact. `PrivacyProvider.generateProof` verifies the tx is
  decryptable with the user's viewing key and returns the tx hash.
  Nothing cryptographic is fabricated.
- **Reveals** use `EERC.decryptTransaction` — real viewing-key decryption
  of the on-chain encrypted amounts.
- **Activity** lists the real transactions performed from this device
  (real hashes, explorer links). Reconstructing history purely from chain
  logs (for multi-device sync) is a possible upgrade — see the `ponytail:`
  note in `shield.eerc.ts`.

## Manual E2E verification (requires funded Fuji wallet + deployment)

1. Create/unlock wallet → fund with Fuji AVAX (gas) and Fuji USDC.
2. Shield USDC → approve + deposit txs on Snowtrace; eUSDC appears under
   Shielded Assets with the decrypted balance.
3. Send → Shielded → registered recipient address → amount shows `••••`
   in Activity; recipient's wallet decrypts the received balance.
4. Unshield eUSDC → withdraw tx; USDC returns to Public Assets.
5. Activity → Reveal on the shielded send → real decrypted amount.

`pnpm smoke` covers the provider layer's offline behavior (unsupported
tokens, unconfigured converter, locked-wallet degradation) without
spending funds.
