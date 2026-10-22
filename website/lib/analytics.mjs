import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const EVENTS = {
  website: [
    "page_view",
    "download_click",
    "extension_download",
    "demo_click",
    "example_click",
    "engaged_visit",
    "provider_click",
  ],
  extension: [
    "analytics_enabled",
    "extension_enabled",
    "category_created",
    "labels_used",
  ],
};
export const REFS = ["x", "reddit", "hn", "producthunt", "other", "direct"];
const REF_EVENTS = ["page_view", "download_click"];
export const RETENTION_DAYS = 400;
export const dayOf = (date = new Date()) => date.toISOString().slice(0, 10);
export const datesFor = (days, now = new Date()) =>
  Array.from({ length: days }, (_, i) =>
    dayOf(
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - days + i + 1,
        ),
      ),
    ),
  );
export function validEvent(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const hasRef = Object.hasOwn(body, "ref");
  return (
    typeof body.source === "string" &&
    typeof body.event === "string" &&
    Object.hasOwn(EVENTS, body.source) &&
    Object.keys(body).length === (hasRef ? 3 : 2) &&
    EVENTS[body.source].includes(body.event) &&
    !(body.source === "website" && body.event === "extension_download") &&
    (!hasRef ||
      (body.source === "website" &&
        REF_EVENTS.includes(body.event) &&
        REFS.includes(body.ref)))
  );
}
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("Analytics storage is not configured");
  return neon(process.env.DATABASE_URL, {
    fetchOptions: { signal: AbortSignal.timeout(8000) },
  });
}
export const INCREMENT_SQL = `WITH cleanup AS (
  DELETE FROM analytics_daily WHERE day < CURRENT_DATE - 400
) INSERT INTO analytics_daily (day, source, event, count) SELECT $1::date, $2, unnest($3::text[]), 1
ON CONFLICT (day, source, event) DO UPDATE SET count = analytics_daily.count + 1
WHERE analytics_daily.count < 100000 RETURNING count`;
// Atomic increment; no individual events or identifying fields are persisted.
export async function recordEvent({ source, event, ref }, sql = database()) {
  if (!EVENTS[source]?.includes(event)) throw new Error("Invalid event");
  if (ref !== undefined && !REFS.includes(ref)) throw new Error("Invalid ref");
  const events = ref ? [event, `${event}.${ref}`] : [event];
  return sql.query(INCREMENT_SQL, [dayOf(), source, events]);
}
export async function summary(days, sql = database()) {
  const dates = datesFor(days);
  const data = await sql.query(
    `WITH cleanup AS (DELETE FROM analytics_daily WHERE day < CURRENT_DATE - 400)
    SELECT to_char(day, 'YYYY-MM-DD') AS day, source, event, count FROM analytics_daily
    WHERE day >= $1::date AND day <= $2::date ORDER BY day`,
    [dates[0], dates.at(-1)],
  );
  return dates.map((day) => ({
    day,
    counts: Object.fromEntries(
      data
        .filter((row) => row.day === day)
        .map((row) => [`${row.source}:${row.event}`, Number(row.count)]),
    ),
  }));
}
export async function loginAttempts(sql = database()) {
  const bucket = Math.floor(Date.now() / 60000);
  const rows = await sql.query(
    `INSERT INTO analytics_login_limit (id, bucket, count) VALUES (1, $1, 1)
    ON CONFLICT (id) DO UPDATE SET bucket = EXCLUDED.bucket,
    count = CASE WHEN analytics_login_limit.bucket = EXCLUDED.bucket THEN analytics_login_limit.count + 1 ELSE 1 END RETURNING count`,
    [bucket],
  );
  return Number(rows[0].count);
}
export function equal(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function session(now = Date.now()) {
  const expires = String(now + 30 * 86400000);
  return `${expires}.${createHmac("sha256", process.env.ANALYTICS_PASSWORD).update(expires).digest("hex")}`;
}
export function authenticated(token = "", now = Date.now()) {
  if (!process.env.ANALYTICS_PASSWORD || !token) return false;
  const [expires, signature] = token.split(".");
  if (
    !/^\d+$/.test(expires) ||
    Number(expires) <= now ||
    Number(expires) > now + 30 * 86400000
  )
    return false;
  return equal(
    signature,
    createHmac("sha256", process.env.ANALYTICS_PASSWORD)
      .update(expires)
      .digest("hex"),
  );
}
export function privacyOptOut(headers) {
  return headers.dnt === "1" || headers["sec-gpc"] === "1";
}
export function bot(headers) {
  return /bot|crawler|spider|headless/i.test(headers["user-agent"] || "");
}
