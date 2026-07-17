import { type Screen, useWallet } from "@/store/wallet";

const TABS: { label: string; screen: Screen }[] = [
  { label: "Home", screen: { name: "home" } },
  { label: "Assets", screen: { name: "assets" } },
  { label: "Activity", screen: { name: "activity" } },
  { label: "Settings", screen: { name: "settings" } },
];

export function BottomNav({ active }: { active: string }) {
  const navigate = useWallet((s) => s.navigate);
  return (
    <div className="flex h-[68px] shrink-0 items-center justify-around border-t border-[var(--av-divider)] bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      {TABS.map((t) => {
        const isActive = active === t.screen.name;
        return (
          <button
            key={t.label}
            onClick={() => navigate(t.screen)}
            className={`flex cursor-pointer flex-col items-center gap-[3px] text-[9px] font-medium transition-colors duration-150 ${
              isActive ? "text-[var(--av-red)]" : "text-[var(--av-text-3)]"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-none transition-colors duration-150 ${
                isActive ? "bg-[var(--av-red)]" : "bg-[var(--av-bg-2)]"
              }`}
            />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
