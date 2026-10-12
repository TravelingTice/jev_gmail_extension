import { mkdir, cp, rm } from "node:fs/promises";

await rm("public", { recursive: true, force: true });
await mkdir("public");
for (const file of [
  "index.html",
  "privacy.html",
  "analytics.html",
  "styles.css",
  "main.js",
  "tracking.js",
  "analytics.css",
  "analytics.js",
  "favicon.png",
  "logo.png",
  "typesafe-logo.svg",
  "gmailclass-og.png",
  "robots.txt",
  "sitemap.xml",
]) {
  await cp(file, `public/${file}`);
}
await cp("assets/figtree.woff2", "public/figtree.woff2");

await cp("assets/OFL.txt", "public/font-license.txt");
