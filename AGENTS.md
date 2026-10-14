# Agent notes

- Extension name is exactly `GmailClass`. Description is `GmailClass - Gmail Email Classifier Powered By Jev`.
- Extension source is in `extension/`. Follow `extension/SPEC.md`. Run extension commands from that directory. The marketing site is in `website/`.
- Do not add Gmail writes, body reads, telemetry, or extra permissions without a new decision.
- Solo project: commit and push directly to `main`. Never create branches unless asked.
- Do not run `pnpm run lint`. Lint explicit paths.
- Do not commit `.env`, `dist/`, or browser profiles.
- Keep the repository private unless a human asks to change visibility.
