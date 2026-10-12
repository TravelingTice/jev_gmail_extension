import {
  authenticated,
  session,
  equal,
  validEvent,
  loginAttempts,
  recordEvent,
  summary,
  privacyOptOut,
  bot,
} from "../lib/analytics.mjs";

const origin = "https://gmailclass.ticekralt.com";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  const action = req.query.action || "summary";
  try {
    if (action === "collect" && req.method === "POST") {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!validEvent(body))
        return res.status(400).json({ error: "Invalid event" });
      const requestOrigin = req.headers.origin;
      if (
        body.source === "website" &&
        requestOrigin !== origin &&
        !(
          process.env.VERCEL_ENV !== "production" &&
          requestOrigin === "http://localhost:4173"
        )
      )
        return res.status(403).end();
      if (
        body.source === "extension" &&
        !/^chrome-extension:\/\/[a-p]{32}$/.test(requestOrigin || "")
      )
        return res.status(403).end();
      if (privacyOptOut(req.headers) || bot(req.headers))
        return res.status(204).end();
      await recordEvent(body.source, body.event);
      return res.status(204).end();
    }
    if (action === "login" && req.method === "POST") {
      if (
        req.headers.origin !== origin &&
        !(
          process.env.VERCEL_ENV !== "production" &&
          req.headers.origin === "http://localhost:4173"
        )
      )
        return res.status(403).end();
      if (!process.env.ANALYTICS_PASSWORD)
        return res
          .status(503)
          .json({ error: "Dashboard login is not configured." });
      // Shared attempt limit, deliberately without storing IPs or visitor identifiers.
      if ((await loginAttempts()) > 20)
        return res
          .status(429)
          .json({ error: "Too many attempts. Try again in a minute." });
      if (!equal(req.body?.password || "", process.env.ANALYTICS_PASSWORD))
        return res.status(401).json({ error: "Incorrect password." });
      res.setHeader(
        "Set-Cookie",
        `gmailclass_analytics=${session()}; HttpOnly; Secure; SameSite=Strict; Path=/api/analytics; Max-Age=43200`,
      );
      return res.json({ ok: true });
    }
    if (action === "logout" && req.method === "POST") {
      res.setHeader(
        "Set-Cookie",
        "gmailclass_analytics=; HttpOnly; Secure; SameSite=Strict; Path=/api/analytics; Max-Age=0",
      );
      return res.json({ ok: true });
    }
    if (action !== "summary" || req.method !== "GET")
      return res.status(405).end();
    if (!authenticated(req.headers.cookie))
      return res.status(401).json({ error: "Sign in to view analytics." });
    const days = Number(req.query.days || 14);
    if (![7, 14, 30, 90].includes(days))
      return res.status(400).json({ error: "Invalid date range" });
    return res.json({
      days: await summary(days),
      timeZone: "UTC",
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      error: "Analytics is temporarily unavailable. Please try again.",
    });
  }
}
