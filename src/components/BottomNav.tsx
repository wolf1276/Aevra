import { Divider } from "@/components/ui";
import { type Screen, useWallet } from "@/store/wallet";

const TABS: { label: string; screen: Screen }[] = [
  { label: "Home", screen: { name: "home" } },
  { label: "Assets", screen: { name: "assets" } },
  { label: "Activity", screen: { name: "activity" } },
  { label: "Privacy", screen: { name: "privacy" } },
  { label: "Settings", screen: { name: "settings" } },
];

export function BottomNav({ active }: { active: string }) {
  const navigate = useWallet((s) => s.navigate);
  return (
    <>
      <Divider />
      <div className="flex shrink-0 justify-around py-[10px]">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => navigate(t.screen)}
            className={`cursor-pointer text-[9px] tracking-[0.5px] uppercase ${
              active === t.screen.name ? "font-bold text-[#111]" : "text-[#777]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </>
  );
}
