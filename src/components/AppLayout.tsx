import type { ReactNode } from "react";

import { BottomNav } from "@/components/BottomNav";

export function AppLayout({
  header,
  footer,
  showBottomNav = false,
  activeTab,
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  showBottomNav?: boolean;
  activeTab?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header && <div className="shrink-0">{header}</div>}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      {footer && <div className="shrink-0">{footer}</div>}
      {showBottomNav && <BottomNav active={activeTab!} />}
    </div>
  );
}
