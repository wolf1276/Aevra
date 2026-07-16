"use client";
import { AnimatePresence, motion } from "framer-motion";

import { useWallet } from "@/store/wallet";

export function Toast() {
  const toast = useWallet((s) => s.toast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 border border-[#111] bg-white px-3 py-1 text-[9px] font-bold tracking-[0.5px] uppercase"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
