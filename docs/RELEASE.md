# Release Guide

## Release checklist

1. `git checkout main && git pull` — clean tree, CI green on main.
2. Bump version in **both** `package.json` and `src/extension/manifest.json` (must match — `pnpm validate` enforces it).
3. Update `CHANGELOG.md`: move Unreleased items under the new version + date.
4. `pnpm verify` — must pass end to end. Produces `aevra-extension.zip`.
5. Commit, tag `vX.Y.Z`, push tag. Create a GitHub release — CI re-runs the full gate and attaches the artifact.

## Chrome Web Store submission checklist

- [ ] `pnpm verify` passed; `aevra-extension.zip` is the artifact from CI (not a local build).
- [ ] Manifest version bumped above the currently published version.
- [ ] Store listing: name, description, 128px icon, screenshots (1280×800), category "Productivity" or "Tools".
- [ ] Privacy tab: declare `storage` permission justification ("stores the user's encrypted wallet vault and settings locally; no data leaves the device").
- [ ] Privacy policy URL up to date (wallet data never transmitted; RPC calls go to Avalanche endpoints only).
- [ ] Single purpose description: "Confidential asset wallet for Avalanche eERC".
- [ ] Upload zip at <https://chrome.google.com/webstore/devconsole>, submit for review.

## Production deployment

Chrome Web Store is the only deployment target. After review approval:

1. Publish from the developer console (staged rollout % if desired).
2. Verify the live version loads: install from the store on a clean profile, create a throwaway wallet, check popup boots.
3. Announce in the changelog / release notes.

## Rollback

The Web Store cannot re-publish an older version number. To roll back:

1. `git checkout vX.Y.Z` (last good tag).
2. Bump **patch** version above the bad release in `package.json` + `manifest.json`.
3. `pnpm verify`, upload the new zip, submit. Use expedited review notes if the bad release is harmful.
4. If the bad release corrupts local state, the fix must migrate `chrome.storage.local` — never instruct users to reinstall (their vault lives there; reinstalling deletes it).
