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
  Personalize,
  Unlock,
  Welcome,
} from "@/components/screens/Onboarding";
import { Privacy } from "@/components/screens/Privacy";
import { Receive, Send, SendReview, SendSuccess } from "@/components/screens/Send";
import { Settings } from "@/components/screens/Settings";
import { Toast } from "@/components/Toast";
import { type Screen, useWallet } from "@/store/wallet";

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
    case "backup":
      return <BackupPhrase />;
    case "personalize":
      return <Personalize />;
  }
}

export default function Popup() {
  const { booted, screen, boot } = useWallet();

  useEffect(() => {
    void boot();
  }, [boot]);

  if (!booted) return null;

  return (
    <main className="relative flex h-[650px] w-[380px] flex-col overflow-hidden rounded-[16px] border border-[#ccc] bg-white">
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
