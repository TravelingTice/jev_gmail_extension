# Gmail email classifier

Detailed product and implementation specification for a future implementation agent.

- **Extension name:** Gmail email classifier (use this exact spelling in the manifest, UI, documentation, and store listing).
- **Repository:** https://github.com/TravelingTice/jev_gmail_extension — private.
- **Working directory:** `~/code/TravelingTice/jev_gmail_extension`.
- **Spec date:** 2026-10-11.
- **Status:** Ready for implementation. This repository initially contains the specification only; the extension has not been built or tested.
- **Primary implementation language:** TypeScript.
- **Required tooling:** Prettier, ESLint, TypeScript type checks, automated tests, and a production build.

## 1. Goal and product decisions

Make an overloaded Gmail inbox easier to understand by classifying emails with TypeSafe's Jev decision model. Users describe the categories they care about in everyday language. The extension adds category chips, filters, and priority information to Gmail so users can quickly find messages that need attention.

The first release is an overlay on Gmail's web interface. It reads visible list metadata and displays its own UI. It does not send, delete, archive, mark read, or apply native Gmail labels. Category names refer to extension categories, not Gmail labels. Make that distinction explicit in onboarding and help text.

These are proposed implementation defaults, selected to make the handoff executable without another product-design interview:

1. Custom categories can overlap: one message may be Work, Invoices, and Needs attention.
2. Classification and importance are separate judgments.
3. The default view preserves Gmail's order and adds chips. Users can select an extension-owned priority queue or filter by category.
4. Avoid visually rearranging Gmail's native message rows in v1. Use a separate extension-owned list for priority order, because Gmail's keyboard navigation and checkbox actions otherwise become inconsistent with visual order.
5. Classify loaded unread messages by default. Offer an explicit option to include loaded read messages.
6. Only loaded list rows are in scope. Do not imply the extension has searched the entire account.
7. The developer/user provides their Jev key in a local, gitignored `.env` file for development; installed extension users enter it in extension settings. Follow the key provisioning workflow in section 8. No backend, extension account, subscription, or telemetry is needed for v1. Provider charges are separate.
8. Use direct TypeSafe HTTP calls first. Keep the provider behind an interface so Vercel AI Gateway can be added later.
9. Build a local fixture mode early so development and automated tests do not require a real inbox or paid API requests.

## 2. References and what to learn from them

Source code was inspected through the GitHub CLI on 2026-10-11. Recheck the current code before adopting a design. These are reference implementations, not dependencies or endorsements. Do not copy code without retaining the applicable license and attribution.

### Jev Inbox for Gmail

- Repository: https://github.com/iamomiid/jev-inbox
- Classifier: https://github.com/iamomiid/jev-inbox/blob/main/src/jev.ts
- Gmail integration and rendering: https://github.com/iamomiid/jev-inbox/blob/main/src/content.ts
- Worker: https://github.com/iamomiid/jev-inbox/blob/main/src/background.ts
- Types/settings/cache helpers: https://github.com/iamomiid/jev-inbox/blob/main/src/shared.ts
- Gmail DOM notes: https://github.com/iamomiid/jev-inbox/blob/main/docs/gmail-dom.md
- Fixture/demo: https://github.com/iamomiid/jev-inbox/blob/main/dev/demo.html

Useful pattern: independently ask whether each email belongs to each user-defined category. It sends sender name/address, subject, Gmail's visible snippet, and date; it does not read bodies or attachments. Its default threshold is 0.7, used for both critical status and category chips. Several chips can appear on one email. It scores urgency and prioritizes critical unread messages.

Caution: its native-row visual reordering has a documented mismatch with Gmail's `j`/`k` navigation. Learn from its extraction and classification, but use a dedicated extension-owned priority queue rather than repeating that interaction tradeoff.

### Jev for Gmail

- Repository: https://github.com/JeonKH81/jev-for-gmail
- Typed questions/API calls: https://github.com/JeonKH81/jev-for-gmail/blob/main/background.js
- Badges/scoring: https://github.com/JeonKH81/jev-for-gmail/blob/main/content.js
- Local privacy checks: https://github.com/JeonKH81/jev-for-gmail/blob/main/privacy.js
- English README: https://github.com/JeonKH81/jev-for-gmail/blob/main/README.en.md

Useful pattern: distinguish action required, urgency, importance, and already handled. Its priority score is 40% action + 30% normalized urgency + 30% normalized importance, reduced according to already-handled probability. It displays colored badges rather than rearranging mail.

Caution: its fixed categories and importance instructions emphasize healthcare and academic research. Do not reuse those criteria for a general Gmail product. It fetches redacted thread text via Gmail's print view; that is outside this v1's metadata-only scope. Its privacy masking is a useful reference, not proof that arbitrary email data can be anonymized reliably.

### Other related projects

- https://github.com/fazlerocks/jevmail — separate local Gmail triage application with category trays; useful UI inspiration, not a Chrome extension.
- https://github.com/ilyamk/jev-gmail-ai-spam-filter-and-labeling — Gmail classification with native labels; useful for a possible future Gmail API/Apps Script integration.
- https://github.com/parth-kp/jev-mail-classifier — configurable per-category decisions and actions over IMAP; useful category-design reference, not the v1 architecture.
- https://www.reddit.com/r/LLMDevs/comments/1wmffky/built_an_ai_inbox_triage_using_jev/ — creator demonstration and discussion of another Jev inbox classifier.

## 3. User experience

### First run

1. Open a polished options page with the extension name, short explanation, and logo.
2. Explain exactly what leaves the browser: sender name/address, subject, visible snippet, date, category descriptions, and optional general priority context. Bodies and attachments are not read.
3. Explain that metadata can contain private information. Do not advertise metadata-only as anonymous or fully local processing.
4. Ask the user to enter their TypeSafe API key, acknowledge the disclosure, and test the connection using synthetic email data.
5. Offer starter categories with editable descriptions.
6. Show a synthetic demo before enabling processing of real mail.
7. Enable classification only after the key, disclosure acknowledgment, and explicit enable switch are set.

### Starter categories

| Category | Initial criteria |
| --- | --- |
| Work | Professional collaboration, clients, business projects, and work administration. |
| Invoices & payments | Bills, invoices, amounts due, payment requests, refunds, and payment confirmations. |
| Travel | Bookings, tickets, accommodation, itinerary changes, and travel arrangements. |
| Accounts & security | Login alerts, account recovery, password resets, and account access notices. |
| Personal | Direct personal correspondence, family, friends, and personal appointments. |
| Newsletters | Subscribed editorial updates, digests, and recurring informational publications. |
| Promotions | Advertising, discounts, product sales, and unsolicited commercial outreach. |

These are editable starting points, not a forced exclusive taxonomy. Avoid a default Spam category that suggests a verified security judgment. A future “Possible spam” category should be explicit about uncertainty.

### Gmail toolbar

Inject one compact toolbar above a supported list:

- Enable/pause toggle.
- Status: number classified / number eligible and loaded; queued/in-flight count.
- Category selector with All, user categories, Needs attention, and Review.
- Button to open the extension-owned priority queue.
- Retry failed classifications; settings shortcut.
- Note that counts apply to the current loaded view.

Use a Shadow DOM root for extension UI styling and accessible native elements. Handle Gmail light/dark themes, high contrast, reduced motion, and compact density. Never cover Gmail controls or steal ordinary Gmail keyboard shortcuts.

### Category chips on rows

Show up to two matching category chips plus a `+N` overflow control. The full accessible popover lists all matches, probabilities, priority judgments, processing status, and the metadata fields used. Show “Based on subject and preview” rather than a fabricated explanation of the email.

Each row can be pending, classified, review-needed, excluded, or failed. A failed API request must not be displayed as “not important.” Colors supplement text, never replace it.

### Category filters and priority queue

Render filters in an extension-owned panel/list. Do not hide or shuffle Gmail's native rows. Each result contains sender, subject, preview, category chips, urgency, and an Open in Gmail action using a verified thread link.

Queue order:

1. Critical messages, sorted by urgency descending, critical probability descending, then original Gmail list position.
2. Other messages requiring action, with the same stable urgency tie-breaks.
3. Remaining eligible messages in original Gmail order.

Review is a separate filter for ambiguous or incomplete classification. Preserve the user's selected category while new rows load. Clear the panel on account/view changes so another account's rows never remain visible.

### Settings and popup

Popup: enabled state, current provider/key suffix, current-tab status, Open settings, and Pause. Keep complex editing in the options page.

Options: create/edit/delete/reorder categories, separate category and critical thresholds, include-read switch, supported-view toggles, sender/domain exclusions, daily request limit, key replacement/removal, cache deletion, and optional non-sensitive priority context such as “I work as a freelance developer.”

Limit categories to 15 in v1. Validate names and descriptions; warn about near-duplicate names. Deleting a category deletes its overrides and invalidates the relevant cached classifications.

## 4. Classification contract

### Inputs

Use only the Gmail row's sender display name/address (when available), subject, rendered snippet, displayed date, and stable local message/thread identity. Supply the current timestamp/time zone when evaluating urgency. Do not silently open messages or print views to extract more information.

Unavailable fields are explicitly absent, not invented. Do not infer an exact deadline from a relative Gmail date label. Keep untrusted email text in the state payload; category instructions and application rules are separate.

Trim total outbound metadata to a documented bound, initially 4,000 characters per email. Display that classification is based on limited context. Skip configured sender/domain exclusions locally before any API request.

### Questions per email

One API evaluation per email, containing all questions:

- `category_<stable_id>`: Noul/yes-no question for each enabled category. True criteria = user's description; false criteria = not matching those criteria.
- `requires_action`: asks whether the recipient needs to reply, decide, approve, submit, pay, attend, or otherwise perform a concrete task.
- `critical`: imminent material consequences, a person awaiting a consequential response, a hard deadline, or an account/security issue that merits attention. Routine receipts/FYI are not automatically critical merely because they mention money.
- `urgency`: ordered score 0–3: no time pressure; next few days; today; immediately. Tell the model to use supplied dates/current time and avoid inventing deadlines.

Do not include an already-handled judgment in v1: visible list metadata generally does not contain enough thread history to know that. Do not reuse the healthcare-specific importance scale.

### Probability and review rules

- Category membership threshold: 0.70 by default, configurable separately from critical threshold.
- Critical threshold: 0.70 by default.
- Review lower boundary: 0.40 initially. Any category probability in [0.40, category threshold), or ambiguous action/critical probability in [0.40, critical threshold), adds Review status.
- Category judgments are independent; do not normalize their probabilities to sum to one.
- All category probabilities below 0.40 with complete valid answers = Uncategorized, not a failure.
- Several categories above threshold = several chips; no exclusive winner.
- Malformed, missing, non-finite, or out-of-range answers = failed classification, no confident chips or priority promotion.
- A high predicted membership probability is not guaranteed correctness. Keep any provider-specific confidence statistic separate from membership probability.

Expose the numeric values in details for transparency. Ordinary UI labels should remain plain language.

### Examples (synthetic expected behavior, not guaranteed model outputs)

| Message | Expected behavior |
| --- | --- |
| “Invoice due today — please transfer €200” | Invoices & payments; action required; high urgency; likely Needs attention. |
| “Your hotel booking is confirmed” | Travel; usually informational, unless the preview contains an action/deadline. |
| “Weekly developer digest” | Newsletters, possibly Work if its configured criteria also match; not automatically critical. |
| “New login from an unknown device” | Accounts & security; likely Needs attention. Do not claim the message itself is authentic. |
| “Following up on that thing” with no useful preview | Review or Uncategorized; do not invent a topic. |
| One work invoice for a business trip | Work + Invoices & payments + Travel can all apply. |

### Corrections

Allow Include/Exclude category overrides and Critical/Not critical overrides per thread, plus Reset overrides. Overrides are local, account-scoped, and take precedence over Jev results. They are not sent as provider training data and do not silently alter category descriptions. Reading a message removes it from the default unread-only view but does not erase its cached result/override.

## 5. Technical stack

Use TypeScript throughout application and test code, strict mode, ESLint flat configuration with typescript-eslint, and Prettier. Use a current supported Node LTS release, pin the selected version in `.nvmrc`, and pin the package manager through `packageManager` in `package.json`.

Recommended build: Vite with explicit multi-entry extension bundling, React for popup/options/extension-owned panel, and small framework-independent Gmail extraction modules. Bundle the content script into a self-contained file rather than leaving unsupported static module imports. Produce a module service worker. If using a maintained extension build plugin, verify its current Manifest V3 support and document the choice.

Use Zod or an equivalent small runtime validator for messages, settings, and provider responses. Use Vitest for domain/adapter tests and Playwright for end-to-end fixture tests. Do not introduce a server or database service.

Required scripts:

```json
{
  "dev": "<extension build/watch command>",
  "build": "<production extension build command>",
  "typecheck": "tsc --noEmit",
  "lint": "eslint",
  "format": "prettier --write",
  "format:check": "prettier --check",
  "test": "vitest run",
  "test:e2e": "playwright test"
}
```

Replace placeholders with actual commands during scaffolding. Ensure typecheck covers all application, test, and build configuration TypeScript; use referenced TS projects if needed.

## 6. Proposed code structure

```text
jev_gmail_extension/
  SPEC.md
  README.md
  AGENTS.md
  LICENSE
  THIRD_PARTY_NOTICES.md        # if reference code is reused
  package.json
  pnpm-lock.yaml
  .nvmrc
  .gitignore
  .env.example                 # placeholder only; .env is local and ignored
  scripts/setup-local-key.ts   # optional local provisioning helper
  .prettierignore
  .prettierrc.json
  eslint.config.mjs
  tsconfig.json
  vite.config.ts
  playwright.config.ts
  manifest.json
  public/icons/                # 16, 32, 48, 128 px PNG icons
  assets/brand/                 # original logo and export notes
  src/
    background/
      index.ts                 # synchronous listener registration
      message-router.ts        # validates message type and sender
      scheduler.ts             # bounded queue, leases, restart recovery
    content/
      index.ts                 # idempotent mount/teardown
      gmail-adapter.ts          # view/account detection, row extraction
      gmail-selectors.ts        # isolated Gmail selectors and fallbacks
      observer.ts              # debounced incremental DOM observation
      row-chips.ts              # chips only, no native-row sorting
      mount-panel.tsx           # extension-owned panel
    domain/
      types.ts
      questions.ts             # pure question builder
      classify.ts              # threshold/review decisions
      ranking.ts               # stable queue sort
      overrides.ts
    providers/
      provider.ts              # provider interface
      typesafe.ts              # fetch/abort/retry/response mapping
      schemas.ts               # validates provider wire response
      mock.ts                  # deterministic synthetic results
    storage/
      settings.ts              # validation, schema migrations
      cache.ts                 # account scope, TTL, LRU and invalidation
      secrets.ts               # restricted local API key storage
      jobs.ts                  # persisted non-sensitive queue descriptors
    shared/
      messages.ts              # discriminated request/response unions
      schemas.ts
      limits.ts
    ui/
      popup/                   # index.html and React entry
      options/                 # index.html and React entry
      panel/                   # filterable priority list
      components/
      styles/
  tests/
    unit/
    integration/
    e2e/
    fixtures/gmail/            # synthetic Gmail-like DOM variants
  docs/
    architecture.md
    gmail-dom.md
    privacy.md
    testing.md
    store-listing.md
  .github/workflows/checks.yml
  dist/                        # generated, gitignored
```

Keep classification logic pure and independent of Chrome APIs and Gmail DOM. Inject provider/storage/clock dependencies for meaningful tests. Keep selectors in one adapter, so Gmail markup changes do not require editing UI or classification code.

## 7. Manifest V3 and extension architecture

Manifest name must be `Gmail email classifier`. Set `manifest_version: 3`, an action popup, options page, module background service worker, icons, and a declarative isolated-world content script restricted to `https://mail.google.com/*` in the top frame.

Initial permissions: `storage` and `alarms` (alarms only if used for persisted retry/recovery). Host access: Gmail and `https://api.typesafe.ai/*`. Avoid `tabs`, `scripting`, `identity`, `cookies`, `debugger`, broad `<all_urls>`, and `unlimitedStorage` unless a concrete requirement proves one necessary. A declarative content script and sender metadata generally avoid several of these permissions.

No remote executable code, remote JavaScript, CDN script loading, inline scripts, or eval-based bundling. Package all runtime assets. Use a restrictive extension CSP compatible with MV3.

Flow:

1. Content adapter detects a supported Gmail list and account scope.
2. It extracts eligible rows, fingerprints metadata, and requests cached results/classification through typed runtime messages.
3. Worker validates sender origin/tab, input bounds, settings, opt-in, exclusions, rate limit, and cache.
4. Worker invokes the TypeSafe provider, validates and maps the response, saves a bounded result, and returns/broadcasts it to the requesting account/view.
5. Content script applies local overrides and renders chips/panel entries keyed to stable thread identity.
6. On navigation/account/view changes, tear down old UI, cancel obsolete content requests, and reject stale results.

Do not put API keys in content messages, page DOM, logs, source code, or Gmail localStorage. Extension pages and the worker access secrets; content scripts get only non-sensitive settings and classifications. Restrict `chrome.storage.local` access to trusted contexts using the supported storage access API; expose safe settings through the worker.

## 8. Jev provider implementation

Official starting point: https://docs.typesafe.ai/introduction/quickstart

The documented direct API is `POST https://api.typesafe.ai/v1/systemone` with bearer authorization, model `jev-latest`, a state payload, and a questions object. The documented wire question types are `noul`, `choice`, and `score`. Direct responses use `.noul` for yes/no probabilities and `.score` for score questions. The Vercel AI SDK reference project maps these differently; do not mix its boolean result shape with the raw TypeSafe API.

Verify current endpoint/schema/model availability before implementing. Isolate wire types from domain types. Serialize state consistently using the currently documented supported form. Treat the provider response as untrusted runtime data.

Initial request behavior:

- At most 2 concurrent evaluation requests across tabs.
- UI batches of up to 20 rows are scheduling batches, not an assumption that one Jev call accepts 20 independent emails.
- Abort after 15 seconds; show a retryable error.
- Retry transient network/429/5xx responses up to 3 total attempts using bounded exponential backoff, jitter, and supported Retry-After values.
- Do not retry authentication errors automatically; pause and ask for a corrected key.
- Daily request cap initially 500 attempted real evaluations, user-adjustable. Count retries toward the cap and clearly distinguish connection tests. Avoid claiming a precise currency budget when provider pricing can change.
- Return aggregate usage when available; never log raw payloads or keys.

A successful connection test proves connectivity only, not classification accuracy. Use fixture mode for offline demos and tests.

### API key provisioning: local `.env` and extension settings

The Jev API key will be provided by the developer/user in a local `.env` file at the repository root:

```dotenv
TYPESAFE_API_KEY=your_jev_api_key_here
```

Commit `.env.example` with a placeholder only. Ignore `.env`, `.env.*` (except `.env.example`), browser profiles, and any local credential artifacts. Never ask the user to commit the real key, including to this private repository.

Chrome extensions do not natively load a repository `.env` file or Node's `process.env` at runtime. Do not use a `VITE_`-prefixed secret, build-time string replacement, or a generated key-bearing module to make the key available: these approaches embed credentials in JavaScript or packaged assets.

Use this workflow instead:

1. For local development, read `TYPESAFE_API_KEY` in Node-side tooling only. The simplest supported setup is for the user to copy their key from `.env` into the extension's options page.
2. Optionally implement `scripts/setup-local-key.ts`: a local Playwright helper reads `.env`, opens the unpacked extension's actual options page in a dedicated development profile, and fills/saves the key through the normal settings UI. It must target the verified extension origin, never Gmail or another website, and disable screenshots, video, tracing, and key-bearing logs for the provisioning step. Do not create an externally accessible key-import endpoint.
3. Save the key in restricted `chrome.storage.local`, accessible only to trusted extension contexts. The worker reads it for requests. Do not expose it to content scripts.
4. Provisioning a key does not acknowledge the email-data disclosure or enable real-email processing. Those remain explicit user actions.
5. For a distributed extension, users provide their own key through settings; `.env` is neither included nor required on their computer.
6. Builds, mock tests, and CI work without a real `.env` or key. If an explicitly requested live developer test uses `.env`, keep its execution and artifacts separate from normal recorded tests.

Document both local setup paths in README. Include a production-artifact verification that the supplied key and `.env` files are absent from `dist/` and the store ZIP. Key replacement/removal must invalidate local provider authorization state without leaking the old value.

## 9. Gmail adapter and lifecycle requirements

Gmail is a dynamically changing single-page application. Observe a bounded list container, not the entire document on every mutation. Debounce extraction and process changed rows only. Ignore mutations created by the extension itself.

Support Primary inbox first, then other inbox tabs, labels, and search-result lists through explicit view toggles. If selectors or stable identity fail, show an unsupported-view status and stop processing that view. Do not guess a row's identity from its numeric position.

Use observed stable Gmail thread attributes/links where available; verify them manually against current Gmail markup. Do not build a fabricated link from subject text. Adapter outputs must distinguish thread identity, account identity, metadata fingerprint, and original list order.

Account scope must survive tab reloads and distinguish simultaneously signed-in accounts. `/mail/u/0` alone is not a stable long-term account identifier. Use a reliable locally observed account identifier when available and hash it; if identity cannot be established, disable persistent cache reuse for that view rather than risking cross-account results. Hashing is pseudonymization, not encryption.

Do not attach chips to selection checkboxes, stars, or action buttons. Preserve Gmail click targets, selection, keyboard navigation, and ARIA semantics. Verify row recycling and route changes. Clicking an extension result must open the corresponding verified Gmail thread only through a deliberate user action.

## 10. Cache, overrides, and restart recovery

Cache key includes account scope, stable thread ID, metadata fingerprint, category configuration hash, provider/model identifier, question version, and relevant context/settings version.

Initial limits: 2,000 result entries, seven-day TTL, and a conservative storage byte budget with least-recently-used eviction. Cache only judgments/probabilities and minimal identifiers; do not persist body text or metadata merely to render a queue. Keep the current display metadata in content memory.

Invalidation: new snippet/subject, changed category criteria, question version, provider/model, account, or priority context. Changing display thresholds recalculates local decisions without another API call. Manual overrides persist independently until reset or removed with their category/account data.

MV3 workers can terminate between requests. Register event listeners synchronously and do not rely on global in-memory queues, long timers, or a worker staying alive indefinitely. Persist bounded job descriptors/leases without email payloads. On restart, reclaim expired leases and ask live content contexts to resubmit current metadata before sending a new request. Deduplicate concurrently submitted work across tabs. Reject late responses when their view/configuration fingerprint is stale.

Offer Delete cached classifications, Reset local corrections, and Remove API key. Explain each action accurately. Clearing a cache should not silently trigger a costly full reclassification until the user resumes/enables it.

## 11. Privacy and security requirements

- All inference requests leave the browser for the selected provider. Metadata-only does not mean local inference.
- Display and acknowledge the exact data flow before real-email classification.
- No Gmail password collection, cookies access, OAuth, message sending, native labels, or full-body reads in v1.
- No analytics or extension-operated server.
- No secret values in screenshots, logs, fixtures, crash reports, commits, or CI.
- Store the key locally with trusted-context access restrictions; explicitly state that extension local storage is not a hardware-backed encrypted vault.
- Render all sender/subject/category text as plain text or safe React text; never inject email HTML via innerHTML.
- Treat malicious instructions inside email previews as data, not executable instructions. Model output can affect chips/ranking only, never execute page actions.
- Validate sender and message schemas in the worker, cap input sizes, and avoid exposing externally connectable APIs.
- Exclusions are exact normalized sender/domain matches with clear semantics, not arbitrary executable regex.
- Account-scoped results and overrides must never leak across signed-in accounts.

Native Gmail modifications, full thread reading, and additional providers are future features requiring a new scope/design decision and updated disclosure/permissions.

## 12. Testing and required checks

The implementation agent must actually run checks and fix failures. Do not mark checks passed merely because scripts exist. Report commands, outcomes, and any live checks that could not be performed.

### Unit/integration coverage

Test independent category overlap, threshold boundaries, Review and Uncategorized behavior, malformed/missing/out-of-range provider answers, stable sorting, override precedence, exclusions, account-scoped caching, configuration invalidation, threshold-only recalculation, retry limits, caps, and worker restart/deduplication.

Gmail adapter tests should cover unread/read rows, missing fields, different densities, recycled rows, navigation, account changes, unsupported selectors, correct thread targets, and no interference with native controls. Include malicious HTML-like subjects and prompt-injection-like snippets.

### Playwright end-to-end tests

Use a dedicated persistent Chromium test context that loads the built extension and synthetic Gmail-like pages. Refer to the current Playwright extension guide; Chrome/Edge flags differ from bundled Chromium. Fixture hosts must be permitted only in a test-specific manifest/build, never in the production package.

Test setup/disclosure gating, key replacement/removal, synthetic connection test, category CRUD, chips/overflow, filters, queue order, pause/resume, errors/retry, local overrides, keyboard accessibility, light/dark themes, cache reuse, and teardown. Mock inference at the provider boundary without embedding real credentials.

Live Gmail smoke testing is a separate manual/user-assisted step: real inbox page, two account scopes, Primary and search views, native checkbox/star/open interactions, and pause. If no authorized real Gmail/API session is available, report that limitation honestly; complete fixture tests and all other checks.

### Required completion commands

```bash
pnpm typecheck
pnpm exec eslint src tests scripts vite.config.ts playwright.config.ts eslint.config.mjs
pnpm exec prettier --check .
pnpm test
pnpm test:e2e
pnpm build
```

Adapt lint targets to files actually present. During iteration lint only changed files. **Do not run standalone `pnpm run lint`**; use explicit targets. CI must enumerate project source/configuration targets and exclude generated output. Typecheck, targeted lint, formatting, tests, and production build must all pass before implementation is handed back.

Also validate the generated manifest, packaged file paths, icon sizes, absence of remote executable code, absence of test-host permissions, and absence of secrets. Document baseline classification results on synthetic examples; do not claim an accuracy percentage without an actual evaluation dataset and method.

## 13. Logo and icon direction

Create a friendly, polished logo for **Gmail email classifier**. It should communicate email being organized into useful categories and remain legible at tiny toolbar sizes. Use an original mark rather than Google's Gmail logo or branding. Suggested direction: a simple envelope with three orderly colored tabs, clean geometry, deep navy/teal with a warm accent, minimal detail.

### Copyable image-generation prompt

> Design a polished original app icon for a Chrome extension named “Gmail email classifier”. Create one centered, compact symbol combining a clean envelope silhouette with three neatly organized category tabs or small stacked tiles. The visual should communicate clarity, calm, and effortlessly organized email. Use simple confident geometry, a distinctive deep navy and teal palette with a restrained warm coral accent, generous negative space, and crisp silhouettes that remain recognizable at 16×16 pixels. Modern and friendly, premium productivity-tool quality. No text, no letters, no Google or Gmail logo, no robot, no sparkles, no busy background, no photo, no mockup, no 3D rendering. Transparent background. Produce a square 1024×1024 master icon with ample padding and a strong single focal shape. Avoid faint details and thin strokes. Deliver only the icon artwork.

### Requested generation workflow

The logo can be generated through **Playwright by logging into the user's paid ChatGPT account** and using its image-generation interface. This is a future asset-production task, not completed by this specification.

Use an authorized browser session or dedicated browser profile. If the login requires a password, MFA, CAPTCHA, or other user-only step, let the user complete that step; do not copy credentials into code or the repository. Do not overwrite the user's normal browser profile or assume a paid account/session is already accessible. Inspect the real page and interact with its current image-generation UI; do not rely on brittle guessed selectors or undocumented private endpoints. Follow the active environment's browser-automation and confirmation rules.

Submit the prompt, review the result at small sizes, refine if needed, and download the original image. Save the master under `assets/brand/`, then export PNG icons at 16, 32, 48, and 128 px to `public/icons/`. Verify transparency, padding, contrast on light/dark backgrounds, and small-size legibility. If a true vector version is needed, draw/trace it deliberately; renaming a raster file to SVG is not conversion. Record the prompt and generation date in brand notes. If ChatGPT automation is unavailable, keep this task visibly pending and request user assistance or an approved alternative rather than claiming the logo is finished.

## 14. Installation, documentation, and Chrome Web Store

README must explain prerequisites, API-key setup, exact outbound data, synthetic demo, unpacked installation, build commands, limitations, troubleshooting, and cache/key deletion. Include genuine screenshots using synthetic mail only.

Local installation:

1. Install dependencies using the pinned package manager.
2. Copy `.env.example` to `.env` and provide `TYPESAFE_API_KEY` locally for developer setup; never commit it. Builds and fixture tests do not require a key.
3. Run required checks and production build.
4. Open `chrome://extensions`, enable Developer mode, and Load unpacked using `dist/`.
5. Enter the key from `.env` in extension settings (or use the local provisioning helper), acknowledge disclosure, test with synthetic data, then enable in Gmail.

Prepare a store ZIP containing the built extension with manifest at the ZIP root. Exclude source secrets, fixtures/test-host permissions, node_modules, and development tooling. Prepare a clear description, screenshots, icons, privacy policy text, and permission justification. A public hosted privacy policy/store submission may be a later task; a private GitHub repository is not a publicly accessible policy URL. Verify current Chrome Web Store asset/policy requirements when packaging. Do not claim it is published until an actual store listing is approved and visible.

## 15. Implementation sequence

1. Read this spec and repository instructions; verify provider and extension documentation.
2. Scaffold TypeScript/build/lint/format/test tooling and CI; create a minimal valid MV3 bundle.
3. Implement pure questions, response validation, thresholds, ranking, corrections, and storage schemas with tests.
4. Implement synthetic Gmail fixtures and mock provider; demonstrate the complete UX without credentials.
5. Implement popup/options and disclosure/setup flow.
6. Implement Gmail extraction and idempotent chips/panel integration.
7. Implement real TypeSafe worker calls, bounded scheduling, retries, caps, cache, and restart recovery.
8. Complete Playwright tests and available live smoke checks; address Gmail interaction regressions.
9. Generate/review/export the logo through the requested authorized ChatGPT workflow.
10. Finish documentation, production package, store assets, and verification report.

## 16. Acceptance criteria

- Exact extension name is used consistently.
- TypeScript implementation; Prettier and ESLint configured; all required checks actually pass.
- User can define overlapping categories in plain language and see chips on eligible loaded emails.
- Category and critical thresholds are independent and changing them does not unnecessarily call Jev again.
- Filters/priority queue are extension-owned; Gmail native order/actions/keyboard controls remain functional.
- Ambiguity, missing context, API errors, and excluded messages are represented explicitly.
- Local `.env` key provisioning and `.env.example` are documented; real keys are ignored and never bundled or committed.
- No real-email API calls before disclosure acknowledgment and enablement.
- No bodies/attachments, Gmail writes, telemetry, exposed keys, or cross-account cache reuse.
- Repeated Gmail rendering does not duplicate controls or repeat cached inference unnecessarily.
- Worker restart and multiple Gmail tabs do not cause uncontrolled duplicate work.
- Fixture demo and end-to-end tests run without a real mailbox or key.
- Production output can be loaded unpacked, has valid icons, and contains no test permissions.
- README/privacy/testing/store materials and logo assets are present, or any blocked live/asset work is specifically documented.
- Repo remains private unless the user explicitly requests a visibility change.

## 17. Repository workflow instructions

- Use GitHub CLI (`gh`) for GitHub repository, issue, PR, and source inspection operations.
- New branch names use snake_case and do not use a `codex/` prefix; example `build_gmail_classifier`.
- Default branch is `main`.
- Do not run standalone `pnpm run lint`; target changed/project files explicitly.
- Commit implementation in coherent steps. Do not commit API keys, cookies, browser profiles, real email fixtures, or generated `dist/`.
- The initial spec-only repository is private and should not be treated as a published extension.

## 18. Official technical pointers

- Manifest: https://developer.chrome.com/docs/extensions/reference/manifest
- Content scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- Runtime messaging: https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- Service worker lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- Storage API/access levels: https://developer.chrome.com/docs/extensions/reference/api/storage
- Extension security: https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure
- Web Store publishing: https://developer.chrome.com/docs/webstore/publish
- Jev API quickstart: https://docs.typesafe.ai/introduction/quickstart
- Playwright extensions: https://playwright.dev/docs/chrome-extensions
- TypeScript: https://www.typescriptlang.org/docs/
- ESLint: https://eslint.org/docs/latest/use/configure/configuration-files
- typescript-eslint: https://typescript-eslint.io/getting-started/
- Prettier: https://prettier.io/docs/install

Reference links are starting points. Verify current APIs and tooling versions at build time; do not substitute community look-alike documentation sites for TypeSafe's official documentation.

## 19. Copyable prompt for the implementation agent

> Build “Gmail email classifier” in this repository according to SPEC.md. Read it fully and follow its scope, privacy/data flow, custom overlapping categories, extension-owned filters/priority queue, TypeScript architecture, Manifest V3 requirements, and repository workflow rules. Use the linked open-source projects as references while verifying current source through the GitHub CLI. Implement a complete fixture demo and tests before relying on a live inbox. Use TypeScript, Prettier, ESLint, Vitest, and Playwright; actually run typecheck, explicitly targeted lint, formatting checks, tests, and a production build, fix failures, and report outcomes. Do not run standalone pnpm run lint. Create snake_case branches without a codex/ prefix. Keep the repository private. Generate the logo using the prompt and authorized Playwright/paid-ChatGPT workflow in the spec, letting the user complete authentication challenges as necessary. Finish a loadable unpacked extension, documentation, and store-ready package; report any genuinely unavailable live smoke test or logo step precisely. Do not publish the extension or expand permissions/features beyond this spec without a separate user request.
