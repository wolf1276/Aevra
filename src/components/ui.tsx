// Wireframe design primitives — direct translations of the .dc.html classes.
import type { ReactNode } from "react";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

/** .lbl — 9px uppercase gray label */
export function Lbl({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("text-[9px] tracking-[0.5px] text-[#777] uppercase", className)}>
      {children}
    </div>
  );
}

/** .hd — 11px bold uppercase heading */
export function Hd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("text-[11px] font-bold tracking-[0.5px] uppercase", className)}>
      {children}
    </div>
  );
}

/** .divider — full-width 1px black rule */
export const Divider = () => <div className="h-px w-full shrink-0 bg-[#111]" />;

/** .dividerL — light rule */
export const DividerL = () => <div className="h-px w-full shrink-0 bg-[#bbb]" />;

/** .pill — bordered rounded chip */
export function Pill({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "rounded-[20px] border border-[#111] px-[10px] py-[4px] text-center text-[9px]",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** .box — 1px black border container */
export function Box({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cx("border border-[#111]", onClick && "cursor-pointer", className)}
    >
      {children}
    </div>
  );
}

/** .btn — bordered action button */
export function Btn({
  children,
  className,
  primary,
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "border-[1.5px] border-[#111] py-[10px] text-center text-[10px] font-bold",
        primary && "bg-[#111] text-white",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** .circ .ph — dashed hatched placeholder circle (token/tx icon slot) */
export function Circ({
  size,
  ph,
  children,
  className,
}: {
  size: number;
  ph?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full border border-[#111]",
        ph &&
          "border-dashed border-[#999] [background:repeating-linear-gradient(45deg,#f2f2f2,#f2f2f2_4px,#e4e4e4_4px,#e4e4e4_8px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** .ph — hatched placeholder panel */
export function Ph({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "border border-dashed border-[#999] [background:repeating-linear-gradient(45deg,#f2f2f2,#f2f2f2_4px,#e4e4e4_4px,#e4e4e4_8px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Screen header with optional back arrow (matches "← TITLE" rows) */
export function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-[14px]">
        {onBack && (
          <button onClick={onBack} className="cursor-pointer text-[11px] text-[#777]">
            ←
          </button>
        )}
        <Hd>{title}</Hd>
      </div>
      <Divider />
    </>
  );
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 5)}...${addr.slice(-3)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
