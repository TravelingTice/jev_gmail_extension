import { database } from "../lib/analytics.mjs";
const sql = database();
await sql.query(`CREATE TABLE IF NOT EXISTS analytics_daily (
  day date NOT NULL,
  source text NOT NULL CHECK (source IN ('website', 'extension')),
  event text NOT NULL,
  count bigint NOT NULL CHECK (count >= 0),
  PRIMARY KEY (day, source, event)
)`);
await sql.query(`CREATE TABLE IF NOT EXISTS analytics_login_limit (
  id integer PRIMARY KEY CHECK (id = 1), bucket bigint NOT NULL, count bigint NOT NULL
)`);
console.log("Analytics aggregate tables are ready.");
