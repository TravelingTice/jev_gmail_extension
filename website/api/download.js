import { readFile } from "node:fs/promises";
import { recordEvent, privacyOptOut, bot } from "../lib/analytics.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (!["GET", "HEAD"].includes(req.method)) return res.status(405).end();
  const zip = await readFile(
    new URL("../assets/gmailclass.zip", import.meta.url),
  );
  if (
    req.method === "GET" &&
    !privacyOptOut(req.headers) &&
    !bot(req.headers)
  ) {
    try {
      await recordEvent("website", "extension_download");
    } catch {
      /* Downloads remain available if analytics is down. */
    }
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="gmailclass.zip"');
  res.setHeader("Content-Length", zip.length);
  return res.status(200).end(req.method === "HEAD" ? undefined : zip);
}
