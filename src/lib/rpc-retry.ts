// Retry/fallback helpers for flaky read-only RPC/HTTP calls. Never use these
// for transaction submission — retrying a send risks double-submission.

function isTemporary(e: unknown): boolean {
  const status = (e as { status?: number; code?: number | string } | undefined)?.status;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /429|rate.?limit|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|fetch failed|network|502|503|504/i.test(
    msg,
  );
}

async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), ms)),
  ]);
}

/** Bounded retry with exponential backoff for a single read operation.
 *  Stops immediately on non-temporary errors (bad input, reverts, etc). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseMs = 250,
  timeoutMs = 10_000,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await withTimeout(fn, timeoutMs);
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1 || !isTemporary(e)) throw e;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw lastErr;
}

/** Try a read operation against each RPC URL in order (each with its own
 *  retry budget), falling through to the next on a temporary failure. */
export async function withRpcFallback<T>(
  urls: (string | undefined)[],
  run: (rpcUrl: string) => Promise<T>,
): Promise<T> {
  const list = urls.filter((u): u is string => !!u);
  let lastErr: unknown;
  for (const url of list) {
    try {
      return await withRetry(() => run(url));
    } catch (e) {
      lastErr = e;
      if (!isTemporary(e)) throw e;
    }
  }
  throw lastErr;
}
