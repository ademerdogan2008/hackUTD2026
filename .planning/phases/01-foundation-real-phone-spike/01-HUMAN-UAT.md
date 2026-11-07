---
status: partial
phase: 01-foundation-real-phone-spike
source: [01-VERIFICATION.md]
started: 2026-11-07T16:20:00Z
updated: 2026-11-07T16:20:00Z
---

## Current Test

Physical-phone run in Expo Go (SDK 58). Start Metro: `cd app && PATH=/opt/homebrew/opt/node@24/bin:$HOME/.local/bin:$PATH npx expo start` (add `--tunnel` if not on same Wi-Fi).

## Tests

- [ ] Hermes in Expo Go: badge Live, Seed 150 shows Rows: 150, no `decompress failed` in Metro
- [ ] On-device Sign & verify → Server verified: true / MATCH; tampered → false / MATCH
- [ ] Background > 30 s then foreground → badge returns to Live, Touch updates live
- [ ] Airplane mode on → Reconnecting…; off → Live, rows intact
- [ ] Cold restart → same identity prefix (native SecureStore persistence)

## Summary

Covered without a device: `npm run smoke` 6/6 live vs red-phone-6h786-dev; Expo web UI flow in headless Chrome.

## Gaps

None found; device items outstanding.
