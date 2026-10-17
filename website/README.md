# GmailClass website analytics

The production dashboard is https://gmailclass.ticekralt.com/analytics. Its data requires a password, with a signed, secure, HttpOnly administrator cookie lasting 12 hours. The page carries both a `noindex` meta tag and an `X-Robots-Tag` header, is omitted from the sitemap, and is not linked from the public pages. It stays crawlable so search engines can read its `noindex` directive. The homepage remains indexable.

## Data and limitations

- Website: homepage page loads, 15 visible seconds of engagement, download clicks, demo-link clicks, example clicks, and provider-link clicks. Page views and download clicks are also counted per coarse source (x, reddit, hn, producthunt, other, direct) from the referrer or a `?ref=` tag; referrer URLs are never sent.
- Extension: optional reporting, off by default, for first opt-in, classification activations, category additions, and fresh successful matching label classifications once per local browser per UTC day.
- No unique visitors or unique people: there are no visitor, device, installation, or account IDs. Download clicks do not prove installation. Website visits cannot be linked to extension usage. Existing extension builds must be updated to report events.
- The database stores only UTC date, source, fixed event name (optionally suffixed with a source bucket, e.g. `page_view.hn`), and count. Atomic updates are capped at 100,000 per event/day. Older totals are pruned after 400 days on subsequent reporting or dashboard reads. A separate single-row aggregate counter limits administrator login attempts without storing IPs.
- Website collection respects DNT/GPC and skips detectable automation. Privacy disclosures describe providers' separate connection logs. Public event endpoints can be spoofed; counts are indicative, not audited conversion figures.

## Development and deployment

Run website commands in this directory:

```sh
npm ci
npm test
npm run build
vercel deploy --prod --yes
```

Only the explicit assets copied by `scripts/build.mjs` are published. API functions are in `api/`. Secrets, tests, source libraries, and the password file are excluded from the static output.

Production environment variables: `DATABASE_URL` (the dedicated free Neon database connected through Vercel) and `ANALYTICS_PASSWORD`. The initial schema is created with `node --env-file=.env.production.local scripts/init-analytics.mjs`. Keep environment files private and gitignored. To rotate the dashboard password, update its Vercel production variable and redeploy; old administrator sessions become invalid.

The initial password is in the owner's gitignored `.analytics-password.local` file with mode 0600. It is excluded from deployment uploads.

Verified: automated event-contract/session/storage tests, extension opt-out and duplicate suppression, router/scheduler event hooks, Playwright MCP desktop/mobile/dashboard states, real production login/collection/download counting, and local Chromium extension opt-in/category reporting to production. Synthetic production counts were subtracted after verification.
