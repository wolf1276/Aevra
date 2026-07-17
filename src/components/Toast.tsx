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
          className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-none bg-[#111] px-3 py-[6px] text-[9px] font-semibold text-white"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
