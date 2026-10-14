# GmailClass

This folder is the Chrome extension. From the repository root, `cd extension` before the commands below. The public site is in `../website`.

Chrome extension that classifies the Gmail messages currently loaded on screen. Categories are yours to describe, and they can overlap. The extension adds chips, filters, and its own priority queue. It does not send, delete, archive, or apply Gmail labels.

## What is sent

After you acknowledge the disclosure and enable classification, each loaded row can send:

- sender name and address, when Gmail shows them
- subject
- visible snippet
- displayed date
- your category descriptions and optional priority context

Bodies and attachments are not read. Metadata can still be private. This is not local or anonymous inference. Requests go to `https://api.typesafe.ai` with your own TypeSafe key. There is no extension account. Optional anonymous usage reporting is off by default and can be enabled independently in settings. It sends only fixed event names to GmailClass (hosted on Vercel), where Neon stores daily aggregate counts; no email data, category text, API keys, or device IDs are sent. See [privacy details](docs/privacy.md).

Fixture mode classifies with a built-in demo model and does not call the API.

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 10.5.2
- Chrome

## Setup

```bash
pnpm install
cp .env.example .env
```

Put your TypeSafe key in `.env` as `TYPESAFE_API_KEY`. Do not commit `.env`. Builds do not need a key.

```bash
pnpm typecheck
pnpm exec eslint src scripts vite.config.ts vite.content.config.ts eslint.config.mjs
pnpm exec prettier --check .
pnpm build
```

Do not run `pnpm run lint`. Lint with the explicit file list above.

Load `dist/` from `chrome://extensions` with Developer mode on. Open the extension’s settings, paste the key from `.env`, acknowledge the disclosure, run the synthetic connection test, then enable classification.

## Limits

- Only rows already loaded in the current Gmail list are classified.
- Primary inbox, other inbox tabs, labels, and search can be turned on separately.
- Changing a threshold reuses cached judgments. Changing category text, the priority note, or the question version asks again.
- The default daily cap is 500 real evaluation attempts, including retries. Connection tests are separate. The cap is not a currency budget.
- Extension storage is not a hardware-backed vault. Removing the key deletes it from this browser profile.

## Troubleshooting

- If Gmail’s markup is not recognized, the toolbar says the view is unsupported and nothing is sent.
- A failed request stays failed until you press Retry. It is not shown as “not important.”
- Delete cached classifications also pauses classification, so clearing the cache does not immediately send the list again.
- Live Gmail checks need you to be signed in.

## Store package

`pnpm package:store` checks the production `dist/` folder and writes `gmail-email-classifier.zip`. The extension is not published.
