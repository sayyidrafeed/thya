// Fixed-window counter per key, in memory: the API runs as one process, and a restart that forgets
// the counts only hands a visitor one extra window.
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  let window = -1;
  let counts = new Map<string, number>();

  return function allow(key: string, now = Date.now()) {
    const current = Math.floor(now / windowMs);

    if (current !== window) {
      window = current;
      counts = new Map();
    }

    const used = (counts.get(key) ?? 0) + 1;
    counts.set(key, used);

    return used <= limit;
  };
}

// Behind Traefik the socket address is the proxy's, so the first forwarded address is the visitor.
export function clientAddress(request: Request, socketAddress: string | null) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwarded || socketAddress || "unknown";
}
