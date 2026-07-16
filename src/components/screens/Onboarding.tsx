"use client";
// Onboarding screens (welcome / create / import / unlock / backup).
// Not drawn in the wireframe set — kept in the same visual language,
// minimal, since Phase 1 requires wallet creation & import.
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Box, Btn, Divider, Hd, Header, Lbl, Ph } from "@/components/ui";
import { useWallet, walletProvider } from "@/store/wallet";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Min 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

const inputCls = "w-full border border-[#111] p-3 text-[11px] outline-none placeholder:text-[#999]";

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
                  <span className="text-[#999]">{i + 1}.</span> {w}
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
            <Lbl className="mt-1 text-[#111]">{form.formState.errors.password.message}</Lbl>
          )}
        </div>
        <div>
          <Lbl className="mb-[6px]">Confirm Password</Lbl>
          <input type="password" className={inputCls} {...form.register("confirm")} />
          {form.formState.errors.confirm && (
            <Lbl className="mt-1 text-[#111]">{form.formState.errors.confirm.message}</Lbl>
          )}
        </div>
        {error && <Lbl className="text-[#111]">{error}</Lbl>}
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
            <Lbl className="mt-1 text-[#111]">{form.formState.errors.mnemonic.message}</Lbl>
          )}
        </div>
        <div>
          <Lbl className="mb-[6px]">New Password</Lbl>
          <input type="password" className={inputCls} {...form.register("password")} />
          {form.formState.errors.password && (
            <Lbl className="mt-1 text-[#111]">{form.formState.errors.password.message}</Lbl>
          )}
        </div>
        <div>
          <Lbl className="mb-[6px]">Confirm Password</Lbl>
          <input type="password" className={inputCls} {...form.register("confirm")} />
          {form.formState.errors.confirm && (
            <Lbl className="mt-1 text-[#111]">{form.formState.errors.confirm.message}</Lbl>
          )}
        </div>
        {error && <Lbl className="text-[#111]">{error}</Lbl>}
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
      {error && <Lbl className="mt-2 text-[#111]">{error}</Lbl>}
      <Btn primary className="mt-4 w-[220px]" disabled={busy || !password}>
        {busy ? "Unlocking…" : "Unlock"}
      </Btn>
    </form>
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
                <span className="text-[#999]">{i + 1}.</span> {w}
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
