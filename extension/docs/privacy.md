# Privacy

GmailClass offers optional anonymous usage events, off by default. The first-party endpoint is hosted on Vercel, with daily aggregate counts in Neon Postgres retained for up to 400 days (older totals are pruned on subsequent activity). Only fixed event names are sent: analytics opt-in, classification activation, category creation, and successful matching label use (once per browser per UTC day). No category text, email data, API keys, account details, or device IDs are sent. Fixture mode never reports. Small duplicate-prevention markers stay locally. Disable reporting in settings to stop future events. Hosting providers may retain connection logs such as IP addresses; the analytics database stores only UTC dates, event names, and totals.

When classification is enabled, list metadata and your category instructions are sent to TypeSafe at `https://api.typesafe.ai/v1/systemone`. The extension shows this disclosure before enablement and requires an explicit acknowledgment. A connection test uses a synthetic subject, not mail from the inbox.

The TypeSafe API key is stored in `chrome.storage.local` with trusted-context access, so content scripts cannot read it. That storage is still part of the browser profile. It is not a hardware-backed encrypted vault. Replacing or removing the key clears the saved connection check. The old key is not written to logs.

Cached judgments store probabilities and ids, not message bodies. Overrides stay on this browser until you reset them or delete the category. Account scopes are SHA-256 hashes of the observed account email. Hashing is not encryption.

Email text is sent as data. It is not rendered as HTML, and model output can only change chips and the extension’s own queue.

Permissions: `storage`, `alarms`, host access to `https://mail.google.com/*` `https://api.typesafe.ai/*`, and `https://gmailclass.ticekralt.com/*` for optional analytics.

The public privacy policy is https://gmailclass.ticekralt.com/privacy.
