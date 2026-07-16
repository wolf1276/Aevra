"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { Activity } from "@/components/screens/Activity";
import { Assets, TokenDetails } from "@/components/screens/Assets";
import { Home } from "@/components/screens/Home";
import {
  BackupPhrase,
  CreateWallet,
  ImportWallet,
  Unlock,
  Welcome,
} from "@/components/screens/Onboarding";
import { Privacy } from "@/components/screens/Privacy";
import { Receive, Send, SendReview, SendSuccess } from "@/components/screens/Send";
import { Settings } from "@/components/screens/Settings";
import { Shield, ShieldSuccess, Unshield } from "@/components/screens/Shield";
import { type Screen, useWallet, walletProvider } from "@/store/wallet";

function render(screen: Screen) {
  switch (screen.name) {
    case "welcome":
      return <Welcome />;
    case "create":
      return <CreateWallet />;
    case "import":
      return <ImportWallet />;
    case "unlock":
      return <Unlock />;
    case "home":
      return <Home />;
    case "assets":
      return <Assets />;
    case "token":
      return <TokenDetails symbol={screen.symbol} shielded={screen.shielded} />;
    case "send":
      return <Send symbol={screen.symbol} />;
    case "send-review":
      return <SendReview />;
    case "send-success":
      return <SendSuccess />;
    case "receive":
      return <Receive />;
    case "shield":
      return <Shield symbol={screen.symbol} />;
    case "shield-success":
      return <ShieldSuccess mode="shield" />;
    case "unshield":
      return <Unshield symbol={screen.symbol} />;
    case "unshield-success":
      return <ShieldSuccess mode="unshield" />;
    case "activity":
      return <Activity />;
    case "privacy":
      return <Privacy />;
    case "settings":
      return <Settings />;
    case "backup":
      return <BackupPhrase />;
  }
}

export default function Popup() {
  const { booted, screen, boot, lock, autoLockMinutes } = useWallet();

  useEffect(() => {
    void boot();
  }, [boot]);

  // auto-lock after inactivity
  useEffect(() => {
    if (!walletProvider.isUnlocked()) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => lock(), autoLockMinutes * 60_000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [autoLockMinutes, lock, screen.name]);

  if (!booted) return null;

  return (
    <main className="flex h-[650px] w-[380px] flex-col overflow-hidden bg-white">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen.name}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.12 }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {render(screen)}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
