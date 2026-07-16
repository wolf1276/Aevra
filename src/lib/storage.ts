// Persistent key-value storage: chrome.storage.local in the extension,
// localStorage fallback during `next dev`.

const hasChrome = typeof chrome !== "undefined" && !!chrome.storage?.local;

export async function storageGet(key: string): Promise<string | null> {
  if (hasChrome) {
    const res = await chrome.storage.local.get(key);
    return (res[key] as string | undefined) ?? null;
  }
  return localStorage.getItem(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (hasChrome) {
    await chrome.storage.local.set({ [key]: value });
  } else {
    localStorage.setItem(key, value);
  }
}

export async function storageRemove(key: string): Promise<void> {
  if (hasChrome) {
    await chrome.storage.local.remove(key);
  } else {
    localStorage.removeItem(key);
  }
}
