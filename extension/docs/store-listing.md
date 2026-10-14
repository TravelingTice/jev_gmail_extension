# Chrome Web Store draft

This extension is not published.

## Description

GmailClass adds category chips and a separate priority list to the Gmail messages already loaded on screen. You describe the categories. One message can match more than one. The extension does not change Gmail labels, and it does not send, delete, or archive mail.

## Permission justification

- `storage`: settings, cached judgments, and the API key.
- `alarms`: recover classification work after the service worker stops.
- `https://mail.google.com/*`: read the open message list and show chips.
- `https://api.typesafe.ai/*`: send list metadata for classification when you enable it.

## Privacy

Use the text in `docs/privacy.md`. The public policy URL is https://gmailclass.ticekralt.com/privacy.

## Assets

Icons are in `public/icons`. Screenshots in `docs/screenshots` use synthetic mail. Package the production build with `pnpm package:store` after `pnpm build`.

## Optional usage reporting

Anonymous usage reporting is off by default. If enabled in settings, GmailClass reports fixed events for opt-in, classification activation, category creation, and successful label use once per browser per UTC day. Reports contain no email data, category names/descriptions, keys, account information, or device identifiers. The first-party endpoint on Vercel stores daily aggregate counts in Neon. Providers may retain operational connection logs; see the public privacy policy.

Additional host access: `https://gmailclass.ticekralt.com/*` permits optional first-party usage reporting only. Before any future store submission, the developer dashboard data-use disclosures must accurately reflect this reporting. No store submission was made by this analytics release.

## Prepared Chrome Web Store draft — 12 October 2026

Draft item ID: `hijgjiaejoneclmfogbmhmgicphoddnm`. Prepared through the signed-in Arc browser; not submitted for review. Package version `0.1.0`, SHA-256 `9852abda917a967deb52b72a2c4ddabcf908596be6df8fbdaeca1f73722e361c`. ZIP contents were verified against every current `dist/` file.

Saved description, Tools category, English language, homepage/support URLs, the existing demo video, purpose and permission justifications, remote-code declaration, data-use disclosures, privacy URL, free/public/all-region draft distribution, and reviewer setup instructions. No private API key or Gmail credentials were supplied to reviewers.

Assets: 128 px packaged icon, two genuine Arc screenshots of current options/default categories cropped to 1280×800 without keys or personal inbox content, and promotional tiles derived from the existing website artwork. Prepared assets are in `docs/store-assets/`.
