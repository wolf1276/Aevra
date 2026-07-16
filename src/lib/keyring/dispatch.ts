// Routes a KeyringRequest to the matching Keyring method. Shared by the
// background service worker's message listener and the dev (no-extension)
// fallback in the popup-side client, so both paths run identical logic.
import type { Keyring } from "./core";
import type { KeyringRequest } from "./protocol";

export async function dispatch(keyring: Keyring, req: KeyringRequest): Promise<unknown> {
  switch (req.op) {
    case "hasWallet":
      return keyring.hasWallet();
    case "generateMnemonic":
      return keyring.generateMnemonic();
    case "createWallet":
      return keyring.createWallet(req.mnemonic, req.password);
    case "unlock":
      return keyring.unlock(req.password);
    case "lock":
      return keyring.lock();
    case "isUnlocked":
      return keyring.isUnlocked();
    case "addAccount":
      return keyring.addAccount();
    case "removeLastAccount":
      return keyring.removeLastAccount();
    case "renameAccount":
      return keyring.renameAccount(req.index, req.name);
    case "getAccounts":
      return keyring.getAccounts();
    case "getMnemonic":
      return keyring.getMnemonic();
    case "changePassword":
      return keyring.changePassword(req.current, req.next);
    case "sendTransaction":
      return keyring.sendTransaction(req.accountIndex, req.tx, req.network);
    case "signMessage":
      return keyring.signMessage(req.address, req.message);
    case "signTransaction":
      return keyring.signTransaction(req.address, req.tx);
    case "signTypedData":
      return keyring.signTypedData(req.address, req.data);
    case "reset":
      return keyring.reset();
  }
}
