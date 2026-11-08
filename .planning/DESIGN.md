# Red Phone — UI direction (v2)

Calm, modern, native-feeling emergency tool. Think iOS Settings / Linear mobile, dark. One thing per screen. Red only means danger.

## Tokens
- Palette is muted, not neon. Background `#16181C`; surface `#1F2227` (cards, grouped lists, tab bar); surface-raised `#2A2E35`; control `#343842`; hairline `rgba(255,255,255,0.10)`.
- Text `#F3F4F6`; secondary `#A8AEB8`; tertiary `#6E747E`.
- Accent / danger red `#E5484D` (danger text `#F2777B`) — ONLY: alarm, active incident, destructive, "Possible attack" button. Alarm overlay background `#C8363B`.
- Success `#3DAA6F`, warning `#D4A13A`, info `#5B8DEF` — used as small dots/text, never big fills (except check-in selected state).
- Buttons (54px, Space Grotesk 700 label): primary = solid `#F3F4F6` fill, `#111316` text; danger = solid `#E5484D`, white text; secondary = surface-raised fill, white text; ghost = secondary text. No outlined buttons. "Possible attack" is the boldest element: solid danger, 64px, 18px Space Grotesk 700.
- Type: Space Grotesk (titles, display, buttons, tab labels; 700, titles tracking -0.5) + Inter (body 17/400, body strong 17/600, callout 15/400 secondary, caption 13/500 secondary). Custom fonts set via `fontFamily` (`font` tokens in `ui/theme.ts`), never `fontWeight`. Mono for fingerprints/codes.
- Spacing 4-pt grid; screen padding 20; section gap 28; radius: cards 16, buttons 14, pills 999.
- No shadows, no gradients, no emoji, no borders around everything. Prefer inset grouped lists (rows separated by hairlines inside one rounded surface) over card-in-card.
- Icons: Ionicons from `@expo/vector-icons` (outline style, 22px tabs, 18px inline).

## Patterns
- Screen = large title header (left), optional small right action, then content. No duplicate titles.
- Status = 8px dot + label text, not outlined pills. Pills only for role tags (subtle surface-raised fill, caption text).
- One primary action per screen, pinned at the bottom when it's the main thing to do.
- Empty states: one line + muted subline, centered, no illustrations.
- Copy: short, plain, sentence case. No ALL CAPS except the alarm title.
