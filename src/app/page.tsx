"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { Activity } from "@/components/screens/Activity";
import { AddressBook } from "@/components/screens/AddressBook";
import { Assets, TokenDetails, TokenHistory } from "@/components/screens/Assets";
import { Home } from "@/components/screens/Home";
import {
  CreateWallet,
  ExportPrivateKey,
  ImportWallet,
  Personalize,
  RecoveryPhrase,
  Unlock,
  VerifyRecoveryPassword,
  Welcome,
} from "@/components/screens/Onboarding";
import { Privacy } from "@/components/screens/Privacy";
import { Receive, Send, SendReview, SendSuccess } from "@/components/screens/Send";
import { Settings } from "@/components/screens/Settings";
import { Toast } from "@/components/Toast";
import { Hd, Mascot, Spinner } from "@/components/ui";
import { type Screen, useWallet } from "@/store/wallet";

function Splash() {
  return (
    <main className="relative flex h-[650px] w-[380px] flex-col items-center justify-center gap-4 overflow-hidden rounded-none border-2 border-[var(--av-text)] bg-white">
      <Mascot size={84} />
      <Hd className="text-[22px] tracking-[0.02em]">AEVRA</Hd>
      <Spinner />
    </main>
  );
}

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
      return <TokenDetails symbol={screen.symbol} />;
    case "token-history":
      return <TokenHistory symbol={screen.symbol} />;
    case "send":
      return <Send symbol={screen.symbol} />;
    case "send-review":
      return <SendReview />;
    case "send-success":
      return <SendSuccess />;
    case "receive":
      return <Receive />;
    case "activity":
      return <Activity />;
    case "privacy":
      return <Privacy />;
    case "settings":
      return <Settings />;
    case "backup-verify":
      return <VerifyRecoveryPassword />;
    case "backup":
      return <RecoveryPhrase />;
    case "export-key":
      return <ExportPrivateKey />;
    case "address-book":
      return <AddressBook />;
    case "personalize":
      return <Personalize />;
  }
}

export default function Popup() {
  const { booted, screen, boot } = useWallet();

  useEffect(() => {
    void boot();
  }, [boot]);

  if (!booted) return <Splash />;

  return (
    <main className="relative flex h-[650px] w-[380px] flex-col overflow-hidden rounded-none border-2 border-[var(--av-text)] bg-white">
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
      <Toast />
    </main>
  );
}
