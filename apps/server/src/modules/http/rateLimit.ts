import type { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function getRequestKey(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0];
  }

  return req.ip || 'unknown';
}

export function createMemoryRateLimiter({
  limit,
  windowMs,
}: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${req.method}:${req.path}:${getRequestKey(req)}`;
    const current = entries.get(key);

    if (!current || current.resetAt <= now) {
      entries.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    current.count += 1;
    if (current.count <= limit) {
      next();
      return;
    }

    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Muitas tentativas em pouco tempo. Tente novamente em instantes.',
    });
  };
}
