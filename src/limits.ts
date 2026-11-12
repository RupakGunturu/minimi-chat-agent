export type LimitResult = { ok: boolean; remaining: number; retryAfterMs: number };

export class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, limit: number, windowMs: number, now = Date.now()): LimitResult {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
    }
    bucket.count++;
    if (bucket.count > limit) {
      return { ok: false, remaining: 0, retryAfterMs: Math.max(1, bucket.resetAt - now) };
    }
    return { ok: true, remaining: Math.max(0, limit - bucket.count), retryAfterMs: 0 };
  }

  prune(now = Date.now()) {
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }
}
