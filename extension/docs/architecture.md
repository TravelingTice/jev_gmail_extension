# Architecture

The content script reads the visible Gmail list and renders chips plus an extension-owned panel. It never reorders Gmail’s rows. Classification decisions are pure functions in `src/domain`. The service worker is the only caller of TypeSafe. Content scripts receive decisions, not the API key.

Cache keys include the account hash, thread id, metadata fingerprint, category configuration, model, and question version. Threshold changes reuse cached probabilities. Results are not shared across account hashes. If the account email cannot be read, the scope is ephemeral and is not written to the cache.

The worker persists job ids and leases without email text. When it restarts, expired leases are cleared and open Gmail tabs are asked to send the current rows again. At most two provider requests run at once.

Fixture mode swaps in `src/providers/mock.ts`. The production manifest does not allow the local fixture host. The test build does, only so Playwright can open synthetic pages.
