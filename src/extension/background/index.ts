// Aevra background service worker (Manifest V3).
// Holds the only in-memory copy of decrypted key material. The popup talks
// to it exclusively through chrome.runtime messages — see
// src/lib/keyring/protocol.ts and src/lib/providers/wallet.ts (client side).
//
// SW restarts (Chrome can kill this at any time) drop `Keyring`'s in-memory
// state, which naturally re-locks the wallet — that's the intended MV3-safe
// behavior, not a bug: the decrypted key must never be persisted to storage.
import { Keyring } from "@/lib/keyring/core";
import { dispatch } from "@/lib/keyring/dispatch";
import { KEYRING_MESSAGE, type KeyringRequest, type KeyringResponse } from "@/lib/keyring/protocol";
import { storageGet } from "@/lib/storage";

const keyring = new Keyring();
const ALARM_NAME = "aevra-autolock";

interface Settings {
  autoLockMinutes?: number;
}

async function resetAutoLockAlarm(): Promise<void> {
  if (!keyring.isUnlocked()) return;
  const raw = await storageGet("aevra.settings");
  const settings: Settings = raw ? JSON.parse(raw) : {};
  const minutes = settings.autoLockMinutes ?? 5;
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: minutes });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) keyring.lock();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== KEYRING_MESSAGE) return undefined;
  (async () => {
    let response: KeyringResponse;
    try {
      const result = await dispatch(keyring, msg.request as KeyringRequest);
      response = { ok: true, result };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const code = message === "Wallet locked" ? "LOCKED" : undefined;
      response = { ok: false, error: message, code };
    }
    void resetAutoLockAlarm();
    sendResponse(response);
  })();
  return true; // keep the message channel open for the async response
});
