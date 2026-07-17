"use client";
// Onboarding screens (welcome / create / import / unlock / backup).
// Not drawn in the wireframe set — kept in the same visual language,
// minimal, since Phase 1 requires wallet creation & import.
import { zodResolver } from "@hookform/resolvers/zod";
import { Mnemonic, wordlists } from "ethers";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AppLayout } from "@/components/AppLayout";
import { Avatar, Box, Btn, Divider, Hd, Header, Lbl, Mascot } from "@/components/ui";
import { AVATAR_STYLES, type AvatarStyle } from "@/lib/avatar";
import { storageGet } from "@/lib/storage";
import { CREATED_AT_KEY, profileFor, useWallet, walletProvider } from "@/store/wallet";

// Accepts phrases copied from any wallet: numbered ("1. word", "2) word",
// "3: word", "4 - word"), comma-separated, newline-separated, or plain
// whitespace-separated. Digits never appear inside BIP-39 words, so
// stripping all numbering/punctuation up front is safe.
function normalizeMnemonic(text: string): string[] {
  return text
    .replace(/\d+\s*[.):,\-:]?\s*/g, " ")
    .replace(/[,;]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

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

const STANDARD_LENGTHS = [12, 15, 18, 21, 24];

/** 3-column grid of per-word boxes with smart paste, autofocus, and BIP-39 validation. */
function MnemonicGrid({
  words,
  setWords,
  invalidIdx,
}: {
  words: string[];
  setWords: (w: string[]) => void;
  invalidIdx: Set<number>;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const applyParsed = (parsed: string[]) => {
    const targetLen =
      parsed.length > words.length
        ? (STANDARD_LENGTHS.find((l) => l >= parsed.length) ?? parsed.length)
        : words.length;
    const next = Array(targetLen).fill("");
    parsed.forEach((w, i) => {
      if (i < next.length) next[i] = w;
    });
    setWords(next);
    const focusIdx = Math.min(parsed.length, next.length - 1);
    requestAnimationFrame(() => inputRefs.current[focusIdx]?.focus());
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parsed = normalizeMnemonic(e.clipboardData.getData("text"));
    if (parsed.length < 2) return; // single word: let default paste behavior fill this box
    e.preventDefault();
    applyParsed(parsed);
  };

  const setWord = (i: number, value: string) => {
    const next = [...words];
    next[i] = value.replace(/\s/g, "").toLowerCase();
    setWords(next);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (e.key === " ") {
      e.preventDefault();
      if (el.value.trim()) inputRefs.current[i + 1]?.focus();
    } else if (e.key === "Backspace" && el.value === "" && i > 0) {
      e.preventDefault();
      inputRefs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && el.selectionStart === 0 && i > 0) {
      inputRefs.current[i - 1]?.focus();
    } else if (
      e.key === "ArrowRight" &&
      el.selectionStart === el.value.length &&
      i < words.length - 1
    ) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  return (
    <Box className="grid grid-cols-3 gap-2 p-3">
      {words.map((w, i) => (
        <div
          key={i}
          className={`flex items-center gap-1 rounded-none border bg-white px-2 ${
            invalidIdx.has(i) ? "border-[var(--av-red)]" : "border-[var(--av-text)]"
          }`}
        >
          <span className="text-[10px] text-[var(--av-text-3)]">{i + 1}</span>
          <input
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            value={w}
            onChange={(e) => setWord(i, e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => handleKeyDown(i, e)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={`Word ${i + 1}`}
            className="w-full min-w-0 p-2 text-[10px] outline-none"
          />
        </div>
      ))}
    </Box>
  );
}

const RECOVERY_STEPS = [
  "Finding your wallet…",
  "Deriving accounts…",
  "Creating encrypted vault…",
  "Loading balances…",
  "Almost ready…",
];

function RecoveringState() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, RECOVERY_STEPS.length - 1)), 700);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--av-text-3)] border-t-[var(--av-red)]" />
      <div role="status" aria-live="polite">
        <Lbl>{RECOVERY_STEPS[step]}</Lbl>
      </div>
    </div>
  );
}

export function ImportWallet() {
  const { navigate, createWallet } = useWallet();
  const [words, setWords] = useState<string[]>(Array(12).fill(""));
  const [phraseError, setPhraseError] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState("");
  const form = useForm({ resolver: zodResolver(passwordSchema), mode: "onChange" });
  const startedRef = useRef(false); // guards against double-firing the auto-import

  const filled = words.every((w) => w.length > 0);
  const phrase = words.join(" ");
  const invalidIdx = new Set(
    words.map((w, i) => (w && wordlists.en.getWordIndex(w) === -1 ? i : -1)).filter((i) => i >= 0),
  );

  useEffect(() => {
    if (!filled) {
      setPhraseError("");
      return;
    }
    setPhraseError(Mnemonic.isValidMnemonic(phrase) ? "" : "Invalid recovery phrase.");
  }, [filled, phrase]);

  const phraseValid = filled && !phraseError;

  // As soon as the phrase checks out, jump straight into the password
  // field — the only step left before recovery can start.
  useEffect(() => {
    if (phraseValid) form.setFocus("password");
  }, [phraseValid, form]);

  const password = form.watch("password");
  const confirm = form.watch("confirm");

  const runImport = async (pw: string) => {
    startedRef.current = true;
    setRecovering(true);
    setError("");
    try {
      await createWallet(phrase, pw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setRecovering(false);
      startedRef.current = false;
    }
  };

  // Auto-import the instant every requirement is met — no button, no
  // extra confirmation. A short debounce lets the last keystroke of a
  // matching confirm-password land before we act on it.
  useEffect(() => {
    if (!phraseValid || startedRef.current) return;
    if (!password || !confirm) return;
    if (!passwordSchema.safeParse({ password, confirm }).success) return;
    const id = setTimeout(() => void runImport(password), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phraseValid, password, confirm, phrase]);

  const header = <Header title="Import Wallet" onBack={() => navigate({ name: "welcome" })} />;

  if (recovering) {
    return (
      <AppLayout header={header}>
        <RecoveringState />
      </AppLayout>
    );
  }

  const footer = (
    <div className="p-4">
      <Btn className="w-full" onClick={() => navigate({ name: "welcome" })}>
        Cancel
      </Btn>
    </div>
  );

  return (
    <AppLayout header={header} footer={footer}>
      <form className="flex flex-col gap-[14px] p-4">
        <div>
          <Lbl className="mb-[6px]">
            Recovery Phrase — paste your whole phrase, or type it word by word
          </Lbl>
          <MnemonicGrid words={words} setWords={setWords} invalidIdx={invalidIdx} />
          {phraseError && <Lbl className="mt-1 text-[var(--av-red)]">{phraseError}</Lbl>}
        </div>
        <div>
          <Lbl className="mb-[6px]">New Password</Lbl>
          <input
            type="password"
            className={inputCls}
            disabled={!phraseValid}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <Lbl className="mt-1 text-[var(--av-red)]">
              {form.formState.errors.password.message}
            </Lbl>
          )}
        </div>
        <div>
          <Lbl className="mb-[6px]">Confirm Password</Lbl>
          <input
            type="password"
            className={inputCls}
            disabled={!phraseValid}
            {...form.register("confirm")}
          />
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
          aria-label="Wallet password"
          aria-invalid={!!error}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputCls} pr-14 text-center`}
          placeholder="Password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-[9px] font-bold text-[var(--av-text-3)] uppercase outline-none focus-visible:ring-2 focus-visible:ring-[var(--av-red)]"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      {error && (
        <div role="alert">
          <Lbl className="mt-2 text-[var(--av-red)]">{error}</Lbl>
        </div>
      )}
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
    "AEVRA WALLET BACKUP",
    "",
    "Wallet Address",
    address,
    "",
    "Created",
    createdAt,
    "",
    "Recovery Phrase",
    "",
    mnemonic,
    "",
    "IMPORTANT",
    "Anyone with this phrase can control your wallet.",
    "Never store this file online.",
    "Never share it.",
    "",
    "Generated by Aevra Wallet.",
  ].join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aevra-recovery-backup.txt";
  a.click();
  URL.revokeObjectURL(url);
};

const INACTIVITY_HIDE_MS = 30_000;

/** Reached only after password verification — mirrors the design's premium
 * recovery-phrase page. Never caches the phrase longer than this screen is
 * open: it clears on back, tab-hide, window blur, 30s of inactivity, or
 * unmount, forcing re-verification next time. */
export function RecoveryPhrase() {
  const navigate = useWallet((s) => s.navigate);
  const account = useWallet((s) => s.accounts[s.activeIndex]);
  const [mnemonic, setMnemonic] = useState("");
  const [copied, setCopied] = useState(false);

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

  // Auto-hide after 30s of no interaction on this page.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(hide, INACTIVITY_HIDE_MS);
    };
    const events = ["pointerdown", "keydown", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard.writeText(mnemonic);
    useWallet.getState().showToast("✓ Recovery phrase copied.");
    setCopied(true);
  };

  const download = async () => {
    if (!account) return;
    const createdAtRaw = await storageGet(CREATED_AT_KEY);
    const createdAt = createdAtRaw
      ? new Date(Number(createdAtRaw)).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Unknown";
    downloadRecoveryBackup(mnemonic, account.address, createdAt);
    useWallet.getState().showToast("✓ Backup downloaded.");
  };

  const header = <Header title="Recovery Phrase" onBack={hide} />;

  const words = mnemonic ? mnemonic.split(" ") : [];

  const footer = (
    <>
      <Divider />
      <div className="flex flex-col gap-2 p-4">
        <Btn primary className="w-full" disabled={!mnemonic} onClick={copy}>
          {copied ? "✓ Copied" : "Copy Recovery Phrase"}
        </Btn>
        <Btn className="w-full" disabled={!mnemonic || !account} onClick={() => void download()}>
          Download Backup
        </Btn>
        <button
          type="button"
          onClick={hide}
          className="cursor-pointer text-center text-[10px] font-bold text-[var(--av-red)] uppercase outline-none focus-visible:ring-2 focus-visible:ring-[var(--av-red)] focus-visible:ring-offset-1"
        >
          Hide Recovery Phrase
        </button>
      </div>
    </>
  );

  return (
    <AppLayout header={header} footer={footer}>
      <div className="flex flex-col gap-4 p-4">
        <Box className="border-[var(--av-red)] bg-[var(--av-red-tint)] p-3">
          <div className="text-[11px] font-bold text-[var(--av-red)]">
            ⚠ Keep these words offline.
          </div>
          <Lbl className="mt-1 normal-case">
            Never share them with anyone, and never share screenshots of this page.
          </Lbl>
        </Box>

        <div className="grid grid-cols-3 gap-3">
          {words.map((w, i) => (
            <div
              key={i}
              tabIndex={0}
              role="text"
              aria-label={`Word ${i + 1}: ${w}`}
              className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-[var(--av-divider)] bg-white shadow-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--av-red)] focus-visible:ring-offset-1"
            >
              <div className="text-[9px] text-[var(--av-text-3)]">{i + 1}.</div>
              <div className="text-[12px] font-semibold text-[var(--av-text)]">{w}</div>
            </div>
          ))}
        </div>
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
