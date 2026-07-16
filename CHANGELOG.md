# Changelog

All notable changes to Aevra are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

## [1.0.0] - 2026-07-17

### Added

- CI pipeline (lint, format, typecheck, unit tests, Playwright, manifest validation, packaging).
- `pnpm verify` — single-command release gate.
- Production build validation (`scripts/validate-build.mjs`): manifest, permissions, secrets, size, debug code.
- Unit tests: wallet create/import/unlock/lock, store navigation, settings persistence.
- Playwright extension smoke test.
- Pre-push hook, Dependabot.

### Removed

- Placeholder `<all_urls>` content script (unused; Chrome Web Store rejection risk).
- Debug logging from the background service worker.

## [0.1.0] - 2026-07-16

### Added

- Initial wallet: create/import (BIP-39), encrypted vault in `chrome.storage.local`.
- Avalanche Fuji support: portfolio, send, activity.
- eERC confidential assets: shield/unshield, private transfers, privacy dashboard.
- All wireframe screens, Zustand store, settings persistence.
