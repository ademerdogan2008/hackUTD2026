# Red Phone — UI direction (v3: ops console)

An operations console that fits in a pocket. Like a NOC wall or an air-traffic strip: dark, dense but calm, readable under stress. Built with impeccable (Operate mode) and the owl-listener designer-skills (visual hierarchy, platform conventions, dark-mode design).

The world adds only four things: type, palette, density, and one signature move. Layout, navigation and controls stay standard mobile.

## Signature move
**The incident strip.** Every tab starts with a full-width strip showing the incident state lamp and label (ALL CLEAR / POSSIBLE ATTACK / ATTACK ACTIVE / CONTAINED / RECOVERED), a DRILL plate when relevant, a mono `T+hh:mm:ss` clock since the alert, and the link lamp. It is the same line on every responder's phone. The strip turns red-tinted while an attack is active. Source: `app/src/components/StatusStrip.tsx`.

## Tokens (`app/src/ui/theme.ts`)
- Ground `#0A0D10` (cool slate); surface `#11161B`; raised `#1A2128`; control `#26303A`; hairline `rgba(150,170,190,0.14)`.
- Text `#E6EBF0`; secondary `#97A3AF`; tertiary `#75818D`.
- Signal red `#EC3B30` (text `#FF7B70`). Use it only for danger, an active attack, destructive actions, and the Possible attack key. Alarm field `#C8170E`.
- State colors: green `#34C27A` (clear/contained/done), amber `#F2A93B` (possible/degraded), cyan `#4FB3E8` (info, PII, own chat bubbles).
- Radius: tags 4, controls 6, buttons 10, panels 12, sheets 14. Panels use a 1px hairline edge and no shadows.

## Type
- **Barlow Condensed** 600/700: screen titles (caps), panel labels (13px caps, tracked +1.2), buttons (caps), status words, tab labels.
- **Barlow** 400/500/600: body and UI text.
- **JetBrains Mono** 500: data only (clocks, counts `03/09`, IPs, fingerprints, PII regions, timestamps). Never used as decoration.

## Patterns
- Status = **lamp** (solid core in a tinted bezel, `ui/Lamp.tsx`) + condensed caps label in the lamp's hue. Do not use pills.
- Tags are small rectangular plates with a hairline edge (DRILL, roles, CURRENT).
- Lists are console panels: one surface with hairline rules between rows. Board systems put the lamp on the left, the name and a mono PII line in the middle, and the caps state on the right. Rows with an active attacker get a red tint.
- Next-step card: a panel header row ("YOUR NEXT STEP" plus a severity lamp) above a 28px condensed task title.
- Alarm: a dramatic full-field red takeover. A mono clock meta row and a white rule sit above a 76px condensed caps headline, with a white key carrying the red label. The field pulses and the phone vibrates.
- Do not use side-stripe accent bars, emoji or Unicode glyph icons, gradients or glow. Icons are Ionicons.
- Copy: short and plain. Caps only come from the condensed label style, never typed in source.
