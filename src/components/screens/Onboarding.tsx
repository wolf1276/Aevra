"use client";
// Onboarding screens (welcome / create / import / unlock / backup).
// Not drawn in the wireframe set — kept in the same visual language,
// minimal, since Phase 1 requires wallet creation & import.
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Avatar, Box, Btn, Divider, Hd, Header, Lbl, Ph } from "@/components/ui";
import { AVATAR_STYLES, type AvatarStyle } from "@/lib/avatar";
import { profileFor, useWallet, walletProvider } from "@/store/wallet";

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
  "w-full rounded-[12px] border border-[var(--av-border)] p-3 text-[12px] outline-none placeholder:text-[var(--av-text-3)] focus:border-[var(--av-red)]";

export function Welcome() {
  const navigate = useWallet((s) => s.navigate);
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
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
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    void walletProvider.generateMnemonic().then(setMnemonic);
  }, []);

  const submit = form.handleSubmit(async ({ password }) => {
    setBusy(true);
    try {
      await createWallet(mnemonic, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create wallet");
      setBusy(false);
    }
  });

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Create Wallet" onBack={() => navigate({ name: "welcome" })} />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-[14px] overflow-y-auto p-4">
        <div>
          <Lbl className="mb-[6px]">Recovery Phrase — write it down</Lbl>
          {revealed ? (
            <Box className="grid grid-cols-3 gap-1 p-3">
              {mnemonic.split(" ").map((w, i) => (
                <div key={i} className="text-[10px]">
                  <span className="text-[var(--av-text-3)]">{i + 1}.</span> {w}
                </div>
              ))}
            </Box>
          ) : (
            <Ph className="cursor-pointer p-6 text-center">
              <button type="button" onClick={() => setRevealed(true)} className="cursor-pointer">
                <Lbl>Tap to reveal phrase</Lbl>
              </button>
            </Ph>
          )}
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
        <div className="flex-1" />
        <Btn primary disabled={!revealed || busy}>
          {busy ? "Creating…" : "Create Wallet"}
        </Btn>
      </form>
    </div>
  );
}

const importSchema = z
  .object({
    mnemonic: z
      .string()
      .refine((v) => v.trim().split(/\s+/).length >= 12, "Enter your 12/24-word phrase"),
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

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Import Wallet" onBack={() => navigate({ name: "welcome" })} />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-[14px] p-4">
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
        <div className="flex-1" />
        <Btn primary disabled={busy}>
          {busy ? "Importing…" : "Import Wallet"}
        </Btn>
      </form>
    </div>
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
      <Hd className="text-[20px]">Aevra</Hd>
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

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Personalize" />
      <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4">
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
        <div className="flex-1" />
      </div>
      <Divider />
      <div className="flex gap-2 p-4">
        <Btn className="flex-1" onClick={() => s.navigate({ name: "home" })}>
          Skip
        </Btn>
        <Btn primary className="flex-1" onClick={done}>
          Done
        </Btn>
      </div>
    </div>
  );
}

export function BackupPhrase() {
  const navigate = useWallet((s) => s.navigate);
  const [mnemonic, setMnemonic] = useState("");
  const reveal = () => {
    void walletProvider.getMnemonic().then(setMnemonic);
  };
  return (
    <div className="flex flex-1 flex-col">
      <Header title="Backup Phrase" onBack={() => navigate({ name: "settings" })} />
      <div className="flex flex-1 flex-col p-4">
        <Lbl className="mb-[6px]">Never share this phrase with anyone</Lbl>
        {mnemonic ? (
          <Box className="grid grid-cols-3 gap-1 p-3">
            {mnemonic.split(" ").map((w, i) => (
              <div key={i} className="text-[10px]">
                <span className="text-[var(--av-text-3)]">{i + 1}.</span> {w}
              </div>
            ))}
          </Box>
        ) : (
          <Ph className="p-6 text-center">
            <button type="button" onClick={reveal} className="cursor-pointer">
              <Lbl>Tap to reveal phrase</Lbl>
            </button>
          </Ph>
        )}
        <div className="flex-1" />
      </div>
      <Divider />
      <div className="p-4">
        <Btn primary className="w-full" onClick={() => navigate({ name: "settings" })}>
          Done
        </Btn>
      </div>
    </div>
  );
}
