"use client";
// Onboarding screens (welcome / create / import / unlock / backup).
// Not drawn in the wireframe set — kept in the same visual language,
// minimal, since Phase 1 requires wallet creation & import.
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { Avatar, Box, Btn, Divider, Hd, Header, Lbl, Mascot } from "@/components/ui";
import { AVATAR_STYLES, type AvatarStyle } from "@/lib/avatar";
import { storageGet } from "@/lib/storage";
import { CREATED_AT_KEY, profileFor, useWallet, walletProvider } from "@/store/wallet";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Min 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

const inputCls =
  "w-full rounded-none border border-[var(--av-text)] p-3 text-[12px] outline-none placeholder:text-[var(--av-text-3)] focus:border-[var(--av-red)]";

export function Welcome() {
  const navigate = useWallet((s) => s.navigate);
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <Mascot size={84} className="mb-2" />
      <Hd className="text-[20px]">Aevra</Hd>
      <Lbl className="mt-2">Confidential wallet for Avalanche</Lbl>
      <Btn primary className="mt-8 w-[200px]" onClick={() => navigate({ name: "create" })}>
        Create New Wallet
      </Btn>
      <Btn className="mt-3 w-[200px]" onClick={() => navigate({ name: "import" })}>
        Import Existing Wallet
      </Btn>
    </div>
  );
}

export function CreateWallet() {
  const { navigate, createWallet } = useWallet();
  const [mnemonic, setMnemonic] = useState("");
  const [revealedWords, setRevealedWords] = useState<boolean[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    void walletProvider.generateMnemonic().then((m) => {
      setMnemonic(m);
      setRevealedWords(new Array(m.split(" ").length).fill(false));
    });
  }, []);

  const revealWord = (i: number) =>
    setRevealedWords((prev) => prev.map((v, idx) => (idx === i ? true : v)));
  const revealed = revealedWords.length > 0 && revealedWords.every(Boolean);

  const submit = form.handleSubmit(async ({ password }) => {
    setBusy(true);
    try {
      await createWallet(mnemonic, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create wallet");
      setBusy(false);
    }
  });

  const header = <Header title="Create Wallet" onBack={() => navigate({ name: "welcome" })} />;

  const footer = (
    <div className="p-4">
      <Btn primary disabled={!revealed || busy} className="w-full" onClick={submit}>
        {busy ? "Creating…" : "Create Wallet"}
      </Btn>
    </div>
  );

  return (
    <AppLayout header={header} footer={footer}>
      <form onSubmit={submit} className="flex flex-col gap-[14px] p-4">
        <div>
          <Lbl className="mb-[6px]">
            Recovery Phrase — tap each word to reveal, then write it down
          </Lbl>
          <Box className="grid grid-cols-3 gap-2 p-3">
            {mnemonic.split(" ").map((w, i) => (
              <button
                key={i}
                type="button"
                onClick={() => revealWord(i)}
                className="cursor-pointer rounded-none border border-[var(--av-text)] bg-white p-2 text-left text-[10px]"
              >
                <span className="text-[var(--av-text-3)]">{i + 1}.</span>{" "}
                <span
                  className={`inline-block transition-[filter,opacity] duration-200 ${
                    revealedWords[i] ? "" : "opacity-60 blur-[5px] select-none"
                  }`}
                >
                  {w}
                </span>
              </button>
            ))}
          </Box>
        </div>
        <div>
          <Lbl className="mb-[6px]">Password</Lbl>
          <input type="password" className={inputCls} {...form.register("password")} />
          {form.formState.errors.password && (
            <Lbl className="mt-1 text-[var(--av-red)]">
              {form.formState.errors.password.message}
            </Lbl>
          )}
        </div>
        <div>
          <Lbl className="mb-[6px]">Confirm Password</Lbl>
          <input type="password" className={inputCls} {...form.register("confirm")} />
          {form.formState.errors.confirm && (
            <Lbl className="mt-1 text-[var(--av-red)]">{form.formState.errors.confirm.message}</Lbl>
          )}
        </div>
        {error && <Lbl className="text-[var(--av-red)]">{error}</Lbl>}
      </form>
    </AppLayout>
  );
}

const importSchema = z
  .object({
    mnemonic: z
      .string()
      .refine((v) => v.trim().split(/\s+/).length >= 12, "Enter 12/24-word phrase"),
    password: z.string().min(8, "Min 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export function ImportWallet() {
  const { navigate, createWallet } = useWallet();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm({ resolver: zodResolver(importSchema) });

  const submit = form.handleSubmit(async ({ mnemonic, password }) => {
    setBusy(true);
    setError("");
    try {
      await createWallet(mnemonic, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setBusy(false);
    }
  });

  const header = <Header title="Import Wallet" onBack={() => navigate({ name: "welcome" })} />;

  const footer = (
    <div className="p-4">
      <Btn primary disabled={busy} className="w-full" onClick={submit}>
        {busy ? "Importing…" : "Import Wallet"}
      </Btn>
    </div>
  );

  return (
    <AppLayout header={header} footer={footer}>
      <form onSubmit={submit} className="flex flex-col gap-[14px] p-4">
        <div>
          <Lbl className="mb-[6px]">Recovery Phrase</Lbl>
          <textarea rows={3} className={inputCls} {...form.register("mnemonic")} />
          {form.formState.errors.mnemonic && (
            <Lbl className="mt-1 text-[var(--av-red)]">
              {form.formState.errors.mnemonic.message}
            </Lbl>
          )}
        </div>
        <div>
          <Lbl className="mb-[6px]">New Password</Lbl>
          <input type="password" className={inputCls} {...form.register("password")} />
          {form.formState.errors.password && (
            <Lbl className="mt-1 text-[var(--av-red)]">
              {form.formState.errors.password.message}
            </Lbl>
          )}
        </div>
        <div>
          <Lbl className="mb-[6px]">Confirm Password</Lbl>
          <input type="password" className={inputCls} {...form.register("confirm")} />
          {form.formState.errors.confirm && (
            <Lbl className="mt-1 text-[var(--av-red)]">{form.formState.errors.confirm.message}</Lbl>
          )}
        </div>
        {error && <Lbl className="text-[var(--av-red)]">{error}</Lbl>}
      </form>
    </AppLayout>
  );
}

export function Unlock() {
  const unlock = useWallet((s) => s.unlock);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await unlock(password);
    } catch {
      setError("Incorrect password");
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-1 flex-col items-center justify-center p-6 text-center"
    >
      <Mascot size={84} className="mb-2" />
      <Hd className="text-[20px]">Welcome back</Hd>
      <Lbl className="mt-2">Enter password to unlock</Lbl>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={`${inputCls} mt-6 w-[220px] text-center`}
        placeholder="Password"
      />
      {error && <Lbl className="mt-2 text-[var(--av-red)]">{error}</Lbl>}
      <Btn primary className="mt-4 w-[220px]" disabled={busy || !password}>
        {busy ? "Unlocking…" : "Unlock"}
      </Btn>
    </form>
  );
}

export function Personalize() {
  const s = useWallet();
  const account = s.accounts[s.activeIndex];
  const profile = account ? profileFor(s.profiles, account.address) : null;
  const [username, setUsernameLocal] = useState("");

  if (!account || !profile) return null;

  const done = () => {
    const name = username.trim();
    if (name) s.setUsername(account.address, name);
    s.navigate({ name: "home" });
  };

  const header = <Header title="Personalize" />;

  const footer = (
    <>
      <Divider />
      <div className="flex gap-2 p-4">
        <Btn className="flex-1" onClick={() => s.navigate({ name: "home" })}>
          Skip
        </Btn>
        <Btn primary className="flex-1" onClick={done}>
          Done
        </Btn>
      </div>
    </>
  );

  return (
    <AppLayout header={header} footer={footer}>
      <div className="flex flex-col items-center gap-4 p-4">
        <Avatar seed={profile.avatarSeed} style={profile.avatarStyle} size={72} />
        <button
          type="button"
          className="cursor-pointer text-[10px] text-[var(--av-text-3)] underline"
          onClick={() => s.regenerateAvatar(account.address)}
        >
          Regenerate avatar
        </button>
        <div className="w-full">
          <Lbl className="mb-[6px]">Username</Lbl>
          <input
            autoFocus
            className={inputCls}
            placeholder={account.name}
            value={username}
            onChange={(e) => setUsernameLocal(e.target.value)}
          />
        </div>
        <div className="w-full">
          <Lbl className="mb-[6px]">Avatar Style</Lbl>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(AVATAR_STYLES) as AvatarStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                className="flex cursor-pointer flex-col items-center gap-1"
                onClick={() => s.setAvatarStyle(account.address, style)}
              >
                <Avatar
                  seed={profile.avatarSeed}
                  style={style}
                  size={40}
                  className={
                    style === profile.avatarStyle ? "ring-2 ring-[var(--av-red)] ring-offset-1" : ""
                  }
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

/** Password gate in front of the recovery phrase — same behavior as unlocking. */
export function VerifyRecoveryPassword() {
  const navigate = useWallet((s) => s.navigate);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ok = await walletProvider.verifyPassword(password);
      if (!ok) throw new Error("Incorrect password");
      navigate({ name: "backup" });
    } catch {
      setError("Incorrect password");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className={`flex flex-1 flex-col items-center justify-center p-6 text-center ${
        shake ? "animate-[shake_0.4s]" : ""
      }`}
    >
      <Mascot size={84} className="mb-2" />
      <Hd className="text-[20px]">Verify your password</Hd>
      <Lbl className="mt-2 max-w-[240px]">
        Enter your wallet password to view your recovery phrase.
      </Lbl>
      <div className="relative mt-6 w-[220px]">
        <input
          type={showPassword ? "text" : "password"}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputCls} pr-14 text-center`}
          placeholder="Password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-[9px] font-bold text-[var(--av-text-3)] uppercase"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      {error && <Lbl className="mt-2 text-[var(--av-red)]">{error}</Lbl>}
      <Btn primary className="mt-4 w-[220px]" disabled={busy || !password}>
        {busy ? "Verifying…" : "Continue"}
      </Btn>
      <Btn className="mt-2 w-[220px]" onClick={() => navigate({ name: "settings" })}>
        Cancel
      </Btn>
    </form>
  );
}

const downloadRecoveryBackup = (mnemonic: string, address: string, createdAt: string) => {
  const text = [
    "Recovery Phrase",
    mnemonic,
    "",
    "Wallet Address",
    address,
    "",
    "Creation Date",
    createdAt,
    "",
    "Security Reminder",
    "Never share this file or your recovery phrase with anyone. Anyone with these words can access your wallet.",
  ].join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aevra-recovery-backup.txt";
  a.click();
  URL.revokeObjectURL(url);
};

/** Reached only after password verification — mirrors the design's premium
 * recovery-phrase page. Never caches the phrase longer than this screen is
 * open: it clears on back, tab-hide, or unmount, forcing re-verification. */
export function RecoveryPhrase() {
  const navigate = useWallet((s) => s.navigate);
  const account = useWallet((s) => s.accounts[s.activeIndex]);
  const [mnemonic, setMnemonic] = useState("");

  useEffect(() => {
    let cancelled = false;
    void walletProvider.getMnemonic().then((m) => {
      if (!cancelled) setMnemonic(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hide = () => navigate({ name: "settings" });

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") hide();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = <Header title="Recovery Phrase" onBack={hide} />;

  const words = mnemonic ? mnemonic.split(" ") : [];

  return (
    <AppLayout header={header}>
      <div className="flex flex-col gap-4 p-4">
        <Box className="border-[var(--av-red)] bg-[var(--av-red-tint)] p-3">
          <div className="text-[11px] font-bold text-[var(--av-red)]">
            ⚠ Never share your recovery phrase with anyone.
          </div>
          <Lbl className="mt-1 normal-case">Anyone with these words can access your wallet.</Lbl>
        </Box>

        <div className="grid grid-cols-3 gap-2">
          {words.map((w, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-[var(--av-divider)] bg-white p-3 text-center shadow-sm"
            >
              <div className="text-[9px] text-[var(--av-text-3)]">{i + 1}.</div>
              <div className="mt-1 text-[12px] font-semibold text-[var(--av-text)]">{w}</div>
            </div>
          ))}
        </div>

        <Btn
          primary
          className="w-full"
          disabled={!mnemonic}
          onClick={() => {
            void navigator.clipboard.writeText(mnemonic);
            useWallet.getState().showToast("✓ Recovery phrase copied.");
          }}
        >
          Copy Recovery Phrase
        </Btn>
        <Btn
          className="w-full"
          disabled={!mnemonic || !account}
          onClick={async () => {
            if (!account) return;
            const createdAtRaw = await storageGet(CREATED_AT_KEY);
            const createdAt = createdAtRaw
              ? new Date(Number(createdAtRaw)).toLocaleString()
              : "Unknown";
            downloadRecoveryBackup(mnemonic, account.address, createdAt);
            useWallet.getState().showToast("✓ Backup downloaded.");
          }}
        >
          Download Backup
        </Btn>
        <button
          type="button"
          onClick={hide}
          className="cursor-pointer text-center text-[10px] font-bold text-[var(--av-red)] uppercase"
        >
          Hide Recovery Phrase
        </button>
      </div>
    </AppLayout>
  );
}

export function ExportPrivateKey() {
  const navigate = useWallet((s) => s.navigate);
  return (
    <AppLayout
      header={<Header title="Export Private Key" onBack={() => navigate({ name: "settings" })} />}
    >
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <Lbl>Private key export is not yet implemented.</Lbl>
        <Btn className="mt-4 w-[200px]" onClick={() => navigate({ name: "settings" })}>
          Go Back
        </Btn>
      </div>
    </AppLayout>
  );
}
