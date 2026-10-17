import test from "node:test";
import assert from "node:assert/strict";
import {
  validEvent,
  datesFor,
  session,
  authenticated,
  summary,
  recordEvent,
  privacyOptOut,
} from "../lib/analytics.mjs";
import handler from "../api/analytics.js";

test("event contract rejects identifiers, category content, unknown events, and client download claims", () => {
  assert.equal(validEvent({ source: "website", event: "page_view" }), true);
  assert.equal(validEvent({ source: "extension", event: "labels_used" }), true);
  assert.equal(
    validEvent({ source: "website", event: "download_click", ref: "hn" }),
    true,
  );
  for (const body of [
    { source: "__proto__", event: "page_view" },
    { source: "constructor", event: "page_view" },
    { source: "extension", event: "labels_used", label: "Work" },
    { source: "website", event: "page_view", id: "person" },
    { source: "website", event: "extension_download" },
    { source: "other", event: "page_view" },
    { source: "website", event: "unknown" },
    {
      source: "website",
      event: "page_view",
      ref: "https://news.ycombinator.com/",
    },
    { source: "website", event: "demo_click", ref: "hn" },
    { source: "extension", event: "labels_used", ref: "x" },
  ])
    assert.equal(Boolean(validEvent(body)), false);
});
test("UTC ranges include today and missing days across year boundary", () => {
  assert.deepEqual(datesFor(3, new Date("2027-01-01T23:59:00Z")), [
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
  ]);
});
test("administrator sessions reject tampering, expiry, missing secrets and password rotation", () => {
  process.env.ANALYTICS_PASSWORD = "synthetic-test-password";
  const token = session(1000);
  assert.equal(authenticated(`gmailclass_analytics=${token}`, 1001), true);
  assert.equal(authenticated(`gmailclass_analytics=${token}x`, 1001), false);
  assert.equal(
    authenticated(`gmailclass_analytics=${token}`, 1000 + 12 * 3600000),
    false,
  );
  process.env.ANALYTICS_PASSWORD = "rotated-password";
  assert.equal(authenticated(`gmailclass_analytics=${token}`, 1001), false);
  delete process.env.ANALYTICS_PASSWORD;
  assert.equal(authenticated(`gmailclass_analytics=${token}`, 1001), false);
});
test("aggregate storage uses fixed fields, atomic updates, pruning and zero-filled days", async () => {
  const calls = [];
  const sql = {
    query: async (query, params) => {
      calls.push({ query, params });
      return query.includes("SELECT to_char")
        ? [
            {
              day: datesFor(7)[0],
              source: "website",
              event: "page_view",
              count: "2",
            },
          ]
        : [{ count: "1" }];
    },
  };
  await recordEvent({ source: "extension", event: "labels_used" }, sql);
  assert.deepEqual(calls[0].params, [
    datesFor(1)[0],
    "extension",
    ["labels_used"],
  ]);
  await recordEvent(
    { source: "website", event: "page_view", ref: "reddit" },
    sql,
  );
  assert.deepEqual(calls[1].params[2], ["page_view", "page_view.reddit"]);
  assert.match(calls[0].query, /ON CONFLICT/);
  assert.match(
    calls[0].query,
    /DELETE FROM analytics_daily WHERE day < CURRENT_DATE - 400/,
  );
  calls.length = 1;
  const rows = await summary(7, sql);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows[0].counts, { "website:page_view": 2 });
  assert.deepEqual(rows[1].counts, {});
});
const response = () => ({
  code: 200,
  headers: {},
  setHeader(key, value) {
    this.headers[key] = value;
  },
  status(code) {
    this.code = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  end() {
    return this;
  },
});
test("API protects private totals and rejects wrong origins before writing", async () => {
  let res = response();
  await handler({ query: {}, method: "GET", headers: {} }, res);
  assert.equal(res.code, 401);
  assert.equal(res.headers["Cache-Control"], "no-store");
  res = response();
  await handler(
    {
      query: { action: "collect" },
      method: "POST",
      headers: { origin: "https://other.test" },
      body: { source: "website", event: "page_view" },
    },
    res,
  );
  assert.equal(res.code, 403);
  res = response();
  await handler(
    {
      query: { action: "collect" },
      method: "POST",
      headers: { origin: "https://gmailclass.ticekralt.com", dnt: "1" },
      body: { source: "website", event: "page_view" },
    },
    res,
  );
  assert.equal(res.code, 204);
  assert.equal(privacyOptOut({ "sec-gpc": "1" }), true);
});
