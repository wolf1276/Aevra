import { ArrowLeftRight, Hexagon, Home, Wallet } from "lucide-react";

import { type Screen, useWallet } from "@/store/wallet";

const TABS: { label: string; screen: Screen; icon: typeof Home }[] = [
  { label: "Home", screen: { name: "home" }, icon: Home },
  { label: "Assets", screen: { name: "assets" }, icon: Wallet },
  { label: "Activity", screen: { name: "activity" }, icon: ArrowLeftRight },
  { label: "Settings", screen: { name: "settings" }, icon: Hexagon },
];

/** Premium Avalanche-red bottom bar: fixed height, rounded top, glowing active tab. */
export function BottomNav({ active }: { active: string }) {
  const navigate = useWallet((s) => s.navigate);
  return (
    <div
      className="relative flex h-[78px] shrink-0 items-stretch justify-around rounded-t-[26px] shadow-[0_-10px_28px_rgba(0,0,0,0.22)]"
      style={{
        background: "linear-gradient(180deg, var(--av-red-hover) 0%, var(--av-red) 100%)",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
      }}
    >
      {TABS.map((t, i) => {
        const isActive = active === t.screen.name;
        const Icon = t.icon;
        return (
          <button
            key={t.label}
            onClick={() => navigate(t.screen)}
            aria-label={t.label}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-[6px] text-white transition-[transform,opacity,filter] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--av-red)] active:scale-95 ${
              i > 0 ? "border-l border-white/15" : ""
            } ${isActive ? "scale-[1.03] opacity-100" : "opacity-75 hover:opacity-90"}`}
          >
            <Icon
              size={25}
              strokeWidth={2.1}
              style={
                isActive ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.65))" } : undefined
              }
            />
            <span className={`text-[12px] ${isActive ? "font-semibold" : "font-medium"}`}>
              {t.label}
            </span>
            <span
              className={`absolute bottom-1 h-[3px] w-4 rounded-full bg-white transition-opacity duration-200 ${
                isActive ? "opacity-100" : "opacity-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
