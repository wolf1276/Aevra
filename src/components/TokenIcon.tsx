// Local inline token logos — no network fetch (avoids leaking held-asset data to a CDN).
// Falls back to symbol initials for anything not in the map.
const LOGOS: Record<string, React.ReactNode> = {
  AVAX: (
    <svg viewBox="0 0 36 36" width="100%" height="100%">
      <circle cx="18" cy="18" r="18" fill="#E84142" />
      <path
        fill="#fff"
        d="M24.1 22.4h2.6c.55 0 .82 0 .98-.11a.68.68 0 0 0 .3-.5c.01-.19-.12-.42-.4-.9L19.9 8.6c-.27-.47-.4-.7-.58-.79a.68.68 0 0 0-.6 0c-.17.09-.3.32-.57.79l-1.55 2.66-.01.02c-.29.5-.44.75-.5.99a1.15 1.15 0 0 0 0 .46c.06.28.22.51.53 1l6.85 8.7.02.02c.28.35.42.53.6.65.16.11.34.18.53.21.22.03.44.03.99.03Z"
      />
      <path
        fill="#fff"
        d="m14.36 15.3-2.24 3.8-.02.03c-.26.44-.4.66-.45.9-.06.25-.06.5 0 .76.05.24.19.46.46.9l.02.02.01.02c.26.43.4.65.58.8.16.15.36.25.57.3.24.05.5.03.99.03h4.5c.5 0 .74.02.98-.03.21-.05.4-.15.57-.3.18-.15.32-.37.58-.8l.01-.03.02-.02c.27-.44.4-.66.46-.9.06-.25.06-.51 0-.76-.05-.24-.19-.46-.46-.9l-2.25-3.8-2.16-3.6c-.28-.45-.42-.68-.6-.76a.68.68 0 0 0-.58 0c-.18.08-.32.31-.6.76l-2.16 3.6Z"
      />
    </svg>
  ),
  USDC: (
    <svg viewBox="0 0 36 36" width="100%" height="100%">
      <circle cx="18" cy="18" r="18" fill="#2775CA" />
      <path
        fill="#fff"
        d="M18.6 27.6c-5.3.6-9.6-3.7-9-9 .4-3.9 3.6-7.1 7.5-7.5 5.3-.6 9.6 3.7 9 9-.4 3.9-3.6 7.1-7.5 7.5Z"
      />
      <path
        fill="#2775CA"
        d="M20.4 20.4c0-1.1-.7-1.5-2-1.7-1-.1-1.2-.4-1.2-.8s.3-.7 1-.7c.6 0 .9.2 1.1.7 0 .1.1.2.3.2h.5c.1 0 .2-.1.2-.3v-.1c-.2-.7-.7-1.2-1.4-1.3v-.7c0-.1-.1-.2-.3-.2h-.5c-.1 0-.2.1-.2.3v.7c-1 .1-1.7.8-1.7 1.6 0 1 .6 1.5 1.9 1.7 1 .2 1.3.4 1.3.9s-.4.8-1.1.8c-.9 0-1.2-.4-1.3-.8-.1-.1-.1-.2-.3-.2h-.5c-.2 0-.3.1-.3.3v.1c.2.8.7 1.4 1.7 1.5v.7c0 .1.1.2.3.2h.5c.1 0 .2-.1.2-.3v-.7c1-.2 1.8-.9 1.8-1.8Z"
      />
      <path
        fill="#fff"
        d="M15.3 24.5c-2.6-.9-4-3.8-3-6.4.5-1.4 1.6-2.5 3-3 .2-.1.3-.2.3-.5v-.4c0-.2-.1-.3-.3-.3h-.1c-3.4 1.1-5.2 4.7-4.2 8 .6 1.9 2.1 3.4 4.2 4h.1c.2 0 .3-.1.3-.3v-.4c0-.2-.1-.4-.3-.7Zm5.4-10.5c0-.2-.1-.3-.3-.3h-.1c-.2 0-.3.1-.3.3v.4c0 .3.1.4.3.5 2.6.9 4 3.8 3 6.4-.5 1.4-1.6 2.5-3 3-.2.1-.3.2-.3.5v.4c0 .2.1.3.3.3h.1c3.4-1.1 5.2-4.7 4.2-8-.6-1.9-2.1-3.4-4.2-4Z"
      />
    </svg>
  ),
};
LOGOS.WAVAX = LOGOS.AVAX;

export function TokenIcon({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const base = symbol.replace(/^e/, ""); // eAVAX/eUSDC (shielded) share the underlying logo
  const logo = LOGOS[symbol] ?? LOGOS[base];

  if (logo) {
    return (
      <div className="shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
        {logo}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--av-bg-2)] text-[11px] font-bold"
    >
      {symbol.slice(0, 4)}
    </div>
  );
}
