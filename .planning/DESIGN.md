# Red Phone — UI direction (v2)

Calm, modern, native-feeling emergency tool. Think iOS Settings / Linear mobile, dark. One thing per screen. Red only means danger.

## Tokens
- Background `#0A0A0B`; surface `#141416`; surface-raised `#1C1C1F`; hairline `rgba(255,255,255,0.08)`.
- Text `#F2F2F3`; secondary `#9A9AA1`; tertiary `#5E5E66`.
- Accent / danger red `#FF453A` — ONLY: alarm, active incident, destructive, "Possible attack" button.
- Success `#30D158`, warning `#FFB340`, info `#64A8FF` — used as small dots/text, never big fills (except check-in selected state).
- Primary button: white `#F2F2F3` fill, black text. Secondary: surface-raised fill, white text. No outlined buttons.
- Type (system font): large title 32/700 (tracking -0.5), title 20/600, body 17/400, callout 15/400 secondary, caption 13/500 secondary, mono for fingerprints/codes. Max 2 weights per screen.
- Spacing 4-pt grid; screen padding 20; section gap 28; radius: cards 16, buttons 14, pills 999.
- No shadows, no gradients, no emoji, no borders around everything. Prefer inset grouped lists (rows separated by hairlines inside one rounded surface) over card-in-card.
- Icons: Ionicons from `@expo/vector-icons` (outline style, 22px tabs, 18px inline).

## Patterns
- Screen = large title header (left), optional small right action, then content. No duplicate titles.
- Status = 8px dot + label text, not outlined pills. Pills only for role tags (subtle surface-raised fill, caption text).
- One primary action per screen, pinned at the bottom when it's the main thing to do.
- Empty states: one line + muted subline, centered, no illustrations.
- Copy: short, plain, sentence case. No ALL CAPS except the alarm title.
