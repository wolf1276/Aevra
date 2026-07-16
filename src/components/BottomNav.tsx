import { Divider } from "@/components/ui";
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
    <>
      <Divider />
      <div className="flex shrink-0 justify-around py-[10px]">
        {TABS.map((t) => {
          const isActive = active === t.screen.name;
          return (
            <button
              key={t.label}
              onClick={() => navigate(t.screen)}
              className={`flex cursor-pointer flex-col items-center gap-[3px] text-[9px] font-medium ${
                isActive ? "text-[#111]" : "text-[#999]"
              }`}
            >
              <div className={`h-5 w-5 rounded-[6px] ${isActive ? "bg-[#111]" : "bg-[#f0f0f0]"}`} />
              {t.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
