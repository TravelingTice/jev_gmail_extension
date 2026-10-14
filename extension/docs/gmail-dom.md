# Gmail DOM

Selectors live in `src/content/gmail-selectors.ts`. They follow the list markup described by current Gmail and the notes in the reference projects as of 2026-10-11. Re-check them against a signed-in inbox before trusting a live session.

- List: the visible `.Cp` inside `div[role=main]` that contains `tr.zA`. Hidden lists are ignored.
- Unread rows have class `zE`. Read rows have `zA` without `zE`.
- Thread id: `data-thread-id` and `data-legacy-thread-id` on `span.bqe`.
- Sender: `span.zF[email][name]`.
- Snippet: `span.y2`, with `span.Zt` removed from the text.
- Date: `td.xW` title, then its text.
- Account: the Google Account control’s aria-label email, or `data-gec-account-email` on fixture pages. `/mail/u/0` is not used as the account id.
- Open links are accepted only when they are `https://mail.google.com/mail/...` hashes that contain the legacy thread id.

Chips are inserted in `div.y6`, not on the checkbox, star, or action buttons. A hash that opens one thread, such as `#inbox/<thread id>`, is not a list.
