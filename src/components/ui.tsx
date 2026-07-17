// Wireframe design primitives — direct translations of the .dc.html classes.
import type { ReactNode } from "react";
import { useId, useMemo } from "react";

import { type AvatarStyle, DEFAULT_AVATAR_STYLE, generateAvatarSvg } from "@/lib/avatar";

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

/** .lbl — 9px uppercase gray label */
export function Lbl({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "text-[9px] font-medium tracking-[0.4px] text-[var(--av-text-3)] uppercase",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** .hd — bold heading, no uppercase (size set per-usage) */
export function Hd({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-[13px] font-bold", className)}>{children}</div>;
}

/** .divider — full-width 1px light rule */
export const Divider = () => <div className="h-px w-full shrink-0 bg-[var(--av-divider)]" />;

/** light rule used between sections (same treatment as .divider in the wireframe) */
export const DividerL = () => <div className="h-px w-full shrink-0 bg-[var(--av-divider)]" />;

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
        "rounded-none border border-[var(--av-text)] px-[10px] py-[3px] text-center text-[9px] font-semibold",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** .card — rounded light-gray-bordered container */
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
      className={cx(
        "rounded-none border border-[var(--av-text)] bg-white",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** .btn / .btn-p / .btn-s — rounded action button */
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
        "rounded-none py-[12px] text-center text-[12px] font-semibold transition-colors duration-150",
        "outline-none focus-visible:ring-2 focus-visible:ring-[var(--av-red)] focus-visible:ring-offset-1",
        primary
          ? "bg-[var(--av-red)] text-white hover:bg-[var(--av-red-hover)] active:bg-[var(--av-red-press)]"
          : "border border-[var(--av-text)] text-[var(--av-text)] hover:bg-[var(--av-red-tint)]",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** .circ — light-gray-bordered circle (avatar/token/tx icon slot) */
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
        "flex shrink-0 items-center justify-center rounded-none border-2 border-[var(--av-text)] bg-[var(--av-bg-2)]",
        ph &&
          "border-dashed border-[#999] [background:repeating-linear-gradient(45deg,#f2f2f2,#f2f2f2_4px,#e4e4e4_4px,#e4e4e4_8px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** DiceBear SVGs hardcode ids (masks/gradients) that collide when several
 * avatars share a document — rewrite them to be unique per instance. */
function namespaceSvgIds(svg: string, uid: string): string {
  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  let out = svg;
  for (const id of ids) {
    out = out
      .split(`id="${id}"`)
      .join(`id="${id}--${uid}"`)
      .split(`#${id})`)
      .join(`#${id}--${uid})`);
  }
  return out;
}

/** Deterministic DiceBear avatar (local SVG, cached by seed+style) */
export function Avatar({
  seed,
  style = DEFAULT_AVATAR_STYLE,
  size,
  className,
  onClick,
}: {
  seed: string;
  style?: AvatarStyle;
  size: number;
  className?: string;
  onClick?: () => void;
}) {
  const uid = useId().replace(/:/g, "");
  const svg = useMemo(
    () => namespaceSvgIds(generateAvatarSvg(seed, style), uid),
    [seed, style, uid],
  );
  return (
    <div
      onClick={onClick}
      style={{ width: size, height: size }}
      className={cx(
        "shrink-0 overflow-hidden rounded-none border-2 border-[var(--av-text)] bg-[var(--av-bg-2)] [&>svg]:h-full [&>svg]:w-full",
        onClick && "cursor-pointer",
        className,
      )}
      // ponytail: DiceBear SVGs are locally generated, not user/network input — safe to inject.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Aevra mascot — floats per the design doc's `mascotfloat` keyframe */
export function Mascot({ size = 84, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/mascot.png"
      alt="Aevra mascot"
      style={{ width: size, height: size, animation: "mascotfloat 2.4s ease-in-out infinite" }}
      className={cx("object-contain", className)}
    />
  );
}

/** .spinner — accent-topped ring spinner */
export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, Math.round(size / 7)),
        borderStyle: "solid",
        borderColor: "var(--av-divider)",
        borderTopColor: "var(--av-red)",
        animation: "spin 0.9s linear infinite",
      }}
      className="rounded-full"
    />
  );
}

/** .slot — hatched placeholder panel */
export function Ph({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-none border border-dashed border-[#bbb] [background:repeating-linear-gradient(45deg,#f2f2f2,#f2f2f2_4px,#e4e4e4_4px,#e4e4e4_8px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Screen header with optional back arrow (matches "← Title" rows) */
export function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2 px-[18px] py-[14px]">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="cursor-pointer text-[13px] text-[var(--av-text-3)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--av-red)] focus-visible:ring-offset-1"
          >
            ←
          </button>
        )}
        <Hd className="text-[13px]">{title}</Hd>
      </div>
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
