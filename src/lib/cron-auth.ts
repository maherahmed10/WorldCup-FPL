// Shared guard for Vercel Cron routes (ROADMAP 3.1). Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` on scheduled invocations when the
// CRON_SECRET env var is set. We reject anything else so the sync/settle
// endpoints can't be triggered by the public. When CRON_SECRET is unset
// (local dev), we allow it so the routes are easy to hit by hand.

export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured (dev) — allow manual hits
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
