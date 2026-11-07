---
phase: 2
slug: trust-core
status: draft
shadcn_initialized: false
preset: none
created: 2026-11-07
scope: app-wide design system (Phases 2-5 reuse these tokens/components)
---

# Phase 2 - UI Design Contract (Trust Core) + App-Wide Design System

> Mobile only (Expo Go, React Native `StyleSheet`). Units are density-independent points (pt). All tokens live in ONE file: `app/src/ui/theme.ts`. Components live in `app/src/ui/` and are the only place raw hex, font sizes, or spacing numbers may appear. Screens consume tokens/components only.

Upstream sources: CONTEXT.md D-21 (screen list), D-06 (PIN/biometric flow), D-10 (background wipe), D-12 (QR/10 min), D-14 (fingerprint format), D-17 (lockdown), D-22 (spike to `/dev/spike`). Product feel: plan.md "group text with big buttons", pilot checklist.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (React Native; shadcn not applicable) |
| Preset | not applicable |
| Component library | none; in-house primitives in `app/src/ui/` |
| Icon library | `expo-symbols` (already installed; SF Symbols on iOS). Android fallback: render text glyph/label only, never rely on icon alone. Icons are always paired with a text label except PIN backspace (has accessibilityLabel) |
| Font | System font (San Francisco / Roboto). Monospace for fingerprints, hashes, countdown: `Platform.select({ ios: 'Menlo', android: 'monospace' })` |
| New native modules | none beyond expo-camera, expo-local-authentication, expo-haptics, react-native-qrcode-svg + react-native-svg |
| Animation | none required. Do not add reanimated-dependent behavior. Respect Reduce Motion (no looping animations at all in this phase) |
| Theme | Dark only. `userInterfaceStyle: "dark"` in app.json; `<StatusBar style="light" />`; root background set via `expo-system-ui` to `color.bg` to avoid white flash |

---

## Spacing Scale

All multiples of 4. Use tokens, never literals.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4 | Icon-to-label gap, badge vertical padding |
| sm | 8 | Gap between related rows, chip padding |
| md | 16 | Default padding, screen horizontal gutter, gap between cards |
| lg | 24 | Card inner padding, gap between sections |
| xl | 32 | Gap above primary action block, hero spacing |
| 2xl | 48 | Welcome/Unlock vertical rhythm |
| 3xl | 64 | Top inset for hero (logo/title) screens |

Exceptions (explicit, touch-target driven):
- Minimum touch target 56 (primary/destructive Button height, ListRow min height 64, PIN key 72x72). Secondary/ghost Button min height 48 (never used as the only action on a screen).
- Pressable `hitSlop` of 8 on small controls (back, close).
- Screen gutter is `md` (16); content width is full-bleed minus gutter.

One-handed rule: the primary action sits in a bottom-anchored `ActionBar` (padding `md`, bottom safe-area inset added). Content scrolls above it. Destructive actions never sit in the bottom thumb zone adjacent to the primary action: they live inside a detail view or behind a confirm sheet, separated by at least `xl` from the primary.

---

## Typography

Exactly 4 sizes, 2 weights. Line height ratios: body 1.5, heading/display 1.2.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 18 | 400 | 27 | Paragraphs, ListRow subtitle, Banner text, form values |
| Label | 14 | 600 | 20 | Badges, field labels, captions, helper text, uppercase section headers (letterSpacing 0.5) |
| Heading | 24 | 600 | 29 | Screen titles, card titles, PIN digits, fingerprint |
| Display | 40 | 600 | 48 | Countdown, PIN dots title on Unlock, lockdown state, welcome title |

Rules:
- Weights allowed: 400 (regular), 600 (semibold). No other weights.
- Button label: Body size (18), weight 600.
- Mono variant (same sizes, family override): fingerprint (Heading size, groups separated by a non-breaking space), countdown (Display), audit hash prefix (Label).
- Support Dynamic Type: `allowFontScaling` stays true; cap with `maxFontSizeMultiplier={1.3}` on Display, `1.5` elsewhere. Layouts must wrap, not truncate, primary copy.
- Text color on `bg`/`surface` must be `text` or `textMuted` only.

---

## Color

Dark, high contrast. Red is an alarm color and is NOT the brand/primary color. Primary actions are near-white.

| Role | Token | Hex | Contrast note |
|------|-------|-----|---------------|
| Dominant (60%) | `bg` | `#0B0D10` | App background |
| Secondary (30%) | `surface` | `#161A20` | Cards, rows, action bar, sheets |
| Secondary raised | `surfaceRaised` | `#1F252D` | Pressed state, input background, PIN key |
| Border | `border` | `#2B323C` | 1pt dividers, card outline |
| Text | `text` | `#F5F7FA` | 17:1 on bg |
| Text muted | `textMuted` | `#A3ADBA` | 7.6:1 on surface (AA+) |
| Primary action | `primary` | `#F5F7FA` | Button fill; label `#0B0D10` (17:1) |
| Accent / Destructive (10%) | `danger` | `#D92D20` | Fill with white text 4.9:1 |
| Danger text on dark | `dangerText` | `#FF6B5E` | 6.4:1 on bg; text/borders only |
| Success | `success` | `#3DD68C` | Status dot/text on dark (11:1) |
| Warning | `warning` | `#FFB020` | Countdown <2 min, offline, cooldown (11:1) |
| Info | `info` | `#6CB6FF` | Neutral informational Banner/focus ring (9:1) |
| Scrim | `scrim` | `rgba(0,0,0,0.7)` | Behind confirm sheet |
| QR light | `qrLight` | `#FFFFFF` | QR background, always white with quiet zone `md`; QR dark `#000000` |

Accent (danger red) reserved for ONLY:
1. Lockdown ON state (banner, status panel, toggle track when on) and the "Lock down" activation button.
2. Destructive buttons: Revoke member, Demote/Revoke admin proposal, Wipe/forget this device.
3. Security-failure rows in the Audit feed (`security.*` actions) - text `dangerText`, left bar `danger`.
4. Phase 3+: alert/incident-active surfaces (reserved now; unused in Phase 2).
5. Error text in forms (PIN wrong, invite invalid) uses `dangerText`.

Red is NEVER used for: primary buttons, links, selected tabs, role badges, focus, the logo.
Role badges use neutral outline (`border` + `text`); admin badge uses `info`. Never color-only: every status has a text label or glyph.
Focus/selected state (role picker, tabs): 2pt `text` border plus filled check glyph; not red.

---

## Radii and Elevation

| Token | Value | Usage |
|-------|-------|-------|
| radius.sm | 8 | Badge, input |
| radius.md | 16 | Card, ListRow group, Banner |
| radius.lg | 24 | Button, bottom sheet top corners, QRPanel |
| radius.pill | 999 | Status chip, PIN dots, PIN keys (circle) |

No shadows (dark UI; separation via `surface` vs `bg` + `border`). Border width 1 (2 for focus/selected).

---

## Haptics (expo-haptics, wrap in `app/src/ui/haptics.ts`, no-op on failure)

| Event | Haptic |
|-------|--------|
| PIN digit press | `selectionAsync` |
| PIN wrong / invite rejected | `notificationAsync(Error)` |
| Unlock success, enrollment success, invite scanned | `notificationAsync(Success)` |
| Lockdown toggled | `notificationAsync(Warning)` |
| Confirm of destructive action | `impactAsync(Heavy)` |

---

## Components (build once in `app/src/ui/`)

Every interactive component: `accessibilityRole`, `accessibilityLabel` (text the screen reader says, include state), `accessibilityState` (disabled/selected/busy), pressed style via `surfaceRaised`/opacity 0.85, `disabled` style opacity 0.4 (text stays readable).

### Button
Props: `label`, `onPress`, `variant: 'primary' | 'secondary' | 'danger' | 'ghost'`, `loading`, `disabled`, `icon?`, `fullWidth` (default true), `testID`.

| Variant | Fill | Label | Height | Use |
|---------|------|-------|--------|-----|
| primary | `primary` | `bg` | 56 min | The single main action per screen |
| secondary | transparent, 2pt `border` outline | `text` | 56 min | Alternate path (e.g. "Set up first admin") |
| danger | `danger` | `#FFFFFF` | 56 min | Destructive/alarm confirm only |
| ghost | none | `text` underline-free | 48 min | Tertiary (Cancel, Back) |

Radius `lg`. Loading: ActivityIndicator replaces icon, label stays, `accessibilityState.busy`, presses ignored (double-submit guard; important because reducers are non-idempotent, never auto-retry). Only ONE `primary`/`danger` per screen.

### Badge
Inline pill: `radius.pill`, padding `xs`/`sm`, Label type. Variants: `neutral` (border outline, text), `info`, `success`, `warning`, `danger`. Props: `label`, `variant`, optional leading dot. Role badge shows human label: Admin, Lead, IT, Counsel, Comms, Executive, Finance, HR, Guest, Observer.

### Card
`surface` fill, `radius.md`, 1pt `border`, padding `lg`. Optional `title` (Heading), optional `footer`. Non-pressable by default; pressable variant is ListRow.

### ListRow
Min height 64, padding `md` horizontal / `sm` vertical, `surface`, divider 1pt `border` inset `md`. Slots: leading (avatar circle 40 with initials, `surfaceRaised`, Label type), title (Body 600 -> use weight 600), subtitle (Label muted), trailing (Badge / chevron). Pressable rows get `accessibilityRole="button"`; label composed: "{name}, {role}, {status}". Avatar initials are decorative (`accessibilityElementsHidden`).

### PinPad
3x4 grid of 72x72 circular keys (`surfaceRaised`, digit in Heading type), gap `md`; last row: [blank][0][backspace]. Above grid: 6 PIN dots (16pt circles, gap `md`; filled = `text`, empty = 2pt `border`), centered. Props: `length=6`, `value`, `onChange`, `onComplete`, `disabled`, `error`. Error: dots turn `dangerText` outline, message below in Label `dangerText`, dots clear after 600 ms. `disabled` (cooldown) shows keys at 0.4 opacity. Accessible: each key `accessibilityLabel="{digit}"`, backspace "Delete last digit", dots container `accessibilityLabel="{n} of 6 digits entered"` with `accessibilityLiveRegion="polite"` (never read digits). Keys use `hitSlop` 0 (already 72). Bottom-aligned within thumb reach.

### QRPanel
White rounded (`radius.lg`) square, padding `md` quiet zone, size = `min(screenWidth - 2*md, 340)`, `react-native-qrcode-svg` with error correction `M`. Props: `value`, `expired`. Expired: QR replaced by blurred-free placeholder panel `surface` with text "Invite expired" (never leave a scannable QR after expiry). Accessibility: `accessibilityLabel="Invite QR code for {name}, role {role}. Show it to the person joining."`. Keep screen awake not available without new module: instruct text "Keep this screen open". Set screen brightness not available - do not add module.

### Countdown
Display mono `m:ss`, `textMuted` label "Expires in" above (Label). Color: `text` until 120 s, `warning` below 120 s, `dangerText` NOT used (expiry is not an alarm); at 0 shows "Expired". Driven by `expiresAt - now`, 1 s interval, cleared on unmount. Accessibility: `accessibilityRole="timer"`, label "Expires in {m} minutes {s} seconds" updated only every 30 s (and at 60/10 s) to avoid screen-reader spam.

### Banner
Full-width within gutter, `radius.md`, padding `md`, left 4pt bar in variant color, background `surface`. Variants: `info`, `success`, `warning`, `danger`. Content: Body text + optional single inline action (ghost). `accessibilityRole="alert"` for danger/warning (live region assertive for danger). Dismissible only for info/success. Used for: connection status, lockdown, errors, wrong-PIN cooldown.

### StatusPill (extends ConnectionBadge)
Replace hard-coded greens/oranges in `ConnectionBadge.tsx` with `success`/`warning` tokens. Labels: "Live" / "Reconnecting". Dot + text, never color-only.

### Field (text input)
Height 56, `surfaceRaised` fill, `radius.sm`, 1pt `border`, focus 2pt `info`, Body text, label above (Label). Error: border `dangerText` + helper text. `autoCorrect=false`. Used for display name on first-admin setup and invite name.

### OptionTile (role picker)
Selectable tile in 2-column grid, min height 72, `surface`, 1pt `border`; selected: 2pt `text` border + check glyph + `accessibilityState.selected`. Shows role label (Body 600) + one-line capability (Label muted). Only roles from `canInvite(myRole, ·)` render; others are not shown (not disabled).

### ConfirmSheet
Bottom sheet over `scrim` (RN `Modal`, `animationType="fade"` to avoid motion dependency), `surface`, top radius `lg`, padding `lg`. Title (Heading), body (Body), a full-width `danger` (or primary) confirm Button, and ghost Cancel below. Cancel receives initial accessibility focus. Used for every destructive/high-risk action.

### Screen scaffold (`<Screen>`)
`SafeAreaView` (react-native-safe-area-context) on `bg`; optional `title` (Heading, left aligned, gutter `md`, top padding `md`); `StatusPill` slot top-right; scrollable content (`ScrollView`, gap `lg`, `keyboardShouldPersistTaps="handled"`); optional `footer` renders `ActionBar` (surface + top border, padding `md`, includes bottom inset) holding the one primary Button (and optional ghost below it). Props: `title`, `scroll` (default true), `footer`, `banner`. Native stack header hidden (`headerShown:false`); scaffold draws title so back is a ghost "Back" in ActionBar or top-left 48x48 target.

### EmptyState
Centered: glyph 48 (`textMuted`), Heading, Body muted (max 2 lines), optional ghost action. Used by Members/Audit/Roster.

### Skeleton/Loading
Static placeholder rows (`surface`, 64 high, no shimmer animation). Plus centered `ActivityIndicator` + Body muted text for blocking states.

---

## Navigation Structure (D-21)

```
app/src/app/
  _layout.tsx          Root: SpacetimeRoot + Stack, headerShown:false, dark contentStyle
  (gate)/welcome.tsx   Welcome
  (gate)/scan.tsx      Scan Invite
  (gate)/setup.tsx     First-admin setup (setup code + name)
  enroll/pin.tsx       Set PIN (+ confirm step)
  unlock.tsx           Unlock
  (app)/_layout.tsx    Tabs (bottom): Home, Members, Audit(admin only), plus Invite as a stack route
  (app)/index.tsx      Home
  (app)/members.tsx    Members
  (app)/audit.tsx      Audit feed (tab hidden for non-admins)
  (app)/invite.tsx     Invite (pushed, not a tab)
  (app)/lockdown.tsx   Lockdown (pushed from Home admin card)
  dev/spike.tsx        D-22 (dev only, not linked)
```

Tab bar: `surface`, top border, height 64 + inset, 3 tabs max (Home, Members, Audit), each tab target >= 56 high, icon + text label always shown (Label type), selected = `text` and 2pt top indicator, unselected `textMuted`. Not red. Non-admins see 2 tabs (Home, Members).

Gate rules: no key -> Welcome. Key present but locked (cold start, or background > 60 s per D-10) -> Unlock (back-swipe disabled, `gestureEnabled:false`). After Unlock success -> Home. A global `LockdownBanner` renders atop `(app)` when `app_config.lockdown` is true.

---

## Screen Specifications

Convention: each screen has one primary action in the ActionBar. States: Default / Loading / Empty / Error listed where relevant.

### 1. Welcome (`(gate)/welcome`)
Layout (top to bottom, `3xl` top inset): wordmark text "RED PHONE" (Display, weight 600, `text`; no red), tagline Body muted "Secure incident channel. Works when company systems don't." Card "How it works" three numbered lines (Body): 1 Get invited in person. 2 Scan the code. 3 Set a PIN. ActionBar: primary **Scan invite code**; secondary below (separated `md`): **Set up first admin**.
States: Loading (connecting) - StatusPill "Reconnecting", both buttons still enabled for scan (scan works offline until redeem); First-admin button disabled with helper "Connecting..." until live. Error: Banner danger "Can't reach Red Phone. Check your cellular data." with ghost "Try again".

### 2. Scan Invite (`(gate)/scan`)
Full-bleed `CameraView` (qr only). Overlay: dim scrim outside a 280x280 rounded square viewfinder (corner brackets `text`, 4pt). Top: Heading "Scan invite code". Bottom ActionBar: ghost **Cancel**. Scan lock via `useRef` (D-21) - first valid scan locks, shows Success state.
States: Permission undetermined -> centered EmptyState "Camera access needed" + primary **Allow camera**. Permission denied -> EmptyState "Camera is off" body "Turn on camera access for Red Phone in Settings, then come back." primary **Open Settings** (`Linking.openSettings`). Scanning (default): helper Body "Point at the QR on the inviter's phone." Parsing/redeeming: overlay Card with spinner "Checking invite...". Invalid QR (not `redphone://invite`): Banner danger "That isn't a Red Phone invite." scan lock releases after 2 s. Invite expired/used/rejected (server returns nothing, detect via no member row after 8 s timeout): Banner danger "Invite didn't work. It may be expired or already used. Ask for a new code." Success -> haptic -> Set PIN with name prefilled.

### 3. Set PIN (`enroll/pin`)
Two steps in one screen. Title Heading "Create your PIN" (step 2: "Confirm your PIN"). Body muted "6 digits. You'll enter it every time you open Red Phone. It never leaves this phone." Greeting Card: "Welcome, {displayName}" + role Badge (from invite). PinPad fills lower half. No ActionBar button (auto-advances on 6th digit); a ghost **Start over** appears on step 2. Primary action here is the PIN entry itself.
States: Mismatch: PinPad error "PINs didn't match. Try again." returns to step 1. Weak PIN (all same digit or 123456/654321): inline error "Pick a PIN that's harder to guess." Saving/deriving key (PBKDF2 ~200 ms+, up to a few sec on slow phone): replace PinPad with spinner "Securing your key..." Enrolling (redeem call): spinner "Joining..." Failure: Banner danger "Couldn't finish joining. Your invite may have expired. Ask for a new code." + secondary **Back to start**; local key discarded. Success: haptic, brief Success card "You're in" -> Home (auto after 800 ms; also tappable primary **Continue**).

### 4. Unlock (`unlock`)
Layout: Heading "Enter PIN"; Body muted "Hi {displayName}" (cached name). Order per D-06: device authentication first (auto prompt on mount via `authenticateAsync`, promptMessage "Unlock Red Phone"), then PinPad. If device auth is cancelled/unavailable: show PinPad anyway with ghost **Use device unlock again** above the keys (only if the biometric step is required to proceed; otherwise skip). Footer text Label muted "Key {first group of fingerprint}..." omitted (keep minimal).
States: Authenticating: PinPad disabled, spinner row "Waiting for device unlock...". Wrong PIN: error "Wrong PIN. {n} tries left." (n from 5) + haptic. 5 failures: PinPad disabled, Banner warning "Too many tries. Try again in {ss} seconds." (live countdown, mono). Deriving key: spinner. Session challenge in progress (post-unlock request/sign/verify): "Securing session..." (<1 s typical). Session verify failed / offline: Banner warning "Unlocked, but can't reach Red Phone yet. Retrying." with Home still reachable read-only is NOT allowed (all data is behind the session), so show on Unlock with primary **Try again**. Revoked/lockdown (rejected non-admin): Banner danger "Access is paused. Contact an admin." with no further action. Background >60 s returns here (D-10).

### 5. Home (`(app)/index`)
Top: StatusPill right of title Heading "Home". Identity Card: row 1 name (Heading) + role Badge; row 2 label "Your key fingerprint" (Label muted); row 3 fingerprint in mono Heading, 4 groups of 4 (`ABCD EF01 2345 6789`), copy affordance via ghost "Copy" only if expo-clipboard present (optional; skip otherwise). Helper Label muted: "Read this out loud to confirm it's really you."
Roster section: header Label uppercase "TEAM ({n})"; ListRows (initials avatar, name, role Badge trailing; own row labeled "You"). Sorted: admins first, then name.
Admin extras (admin only): Card row "Lockdown" with status Badge ("Off" neutral / "ON" danger) pressable -> Lockdown screen.
ActionBar primary (only when `canInvite` yields at least one role): **Invite someone**. Roles that cannot invite (it, comms, executive, finance, hr, guest, observer) see no primary button; Home instead shows a Body muted note "You're enrolled. You'll get alerts and tasks here." (no dead button).
States: Loading (subscribing): skeleton 4 rows + StatusPill "Reconnecting". Empty roster (only you): EmptyState "Just you so far" / "Invite your response team in person." Error/offline: Banner warning "Offline. Showing last known team." (cached roster allowed? NO cache in this phase - show Banner and skeleton instead). Lockdown active: Banner danger (see 8), roster hidden for non-admins ("Access paused").

### 6. Invite (`(app)/invite`)
Step A - Role picker: Heading "Who are you inviting?"; OptionTile grid of allowed roles (from `canInvite`); Field "Their name" (required, 1-40 chars, prefilled into invite per D-13). ActionBar primary **Show invite code** (disabled until role + name). High-risk (fresh session, D-09): if session older than 5 min, button shows loading "Verifying you..." while client re-challenges transparently.
Step B - Full-screen QR: Heading "Invite {name}" + role Badge; QRPanel (max width); Countdown directly under QR (Display mono); Body muted "Have them open Red Phone and tap Scan invite code. Works once." ActionBar: primary **Done** (enabled always; ends flow, discards secret from memory); ghost **Close** (does not revoke the server row; it expires on its own; label avoids a false promise). Beyond screen: leaving the screen wipes the secret from state.
States: Creating (reducer in flight): spinner "Creating invite..." (QR not shown until `my_invites` row matches secretHash). Joined detected (new member with `invitedBy` me and matching name appears in roster): Banner success "{name} joined as {role}." and QR replaced by success glyph; primary **Done**. Expired (countdown 0): QRPanel expired placeholder, primary becomes **New code** (restarts step A with same selections), Banner info "That code expired after 10 minutes." Error (create failed / not authorized): Banner danger "Couldn't create the invite. Try again." primary **Try again**. Not permitted (no allowed roles): EmptyState "You can't invite people" (shouldn't be reachable).

### 7. Members (`(app)/members`)
Title Heading "Members". Sections (Label uppercase headers): "PENDING APPROVALS" (admin only, if any), "ADMINS", "TEAM". ListRow per member: avatar, name, role Badge, subtitle fingerprint short (first group, mono Label). Tap -> detail sheet (`ConfirmSheet`-style bottom sheet "MemberSheet"): name, role, full fingerprint, "Invited by {name}". Admin-only actions in sheet, ordered: for admin target: secondary **Propose removing admin** / **Propose demoting admin**; for non-admin target: secondary **Propose as admin** (only if target level>=1) ... then (separated `xl`) danger **Revoke access**. Non-admin users: rows read-only (no sheet actions).
Pending approval card (D-15): Card with Body "{proposer} proposed: {kind text}. {target}". Footer row shows "1 of 2 approvals" (Label) and primary **Approve** (only if you are admin, not proposer, not target) else Label muted "Waiting for another admin". Exactly one primary per screen - Approve cards count as the only primary; if multiple pending, only the first is primary, rest are secondary.
Confirm copy:
- Revoke: title "Revoke {name}?", body "{name} and everyone they invited ({n} people) will lose access immediately. This can't be undone.", confirm danger **Revoke access**, cancel **Keep access**.
- Propose admin: title "Propose {name} as admin?", body "A second admin must approve before it takes effect.", confirm primary **Send proposal**.
- Approve: title "Approve this change?", body "{kind text}. It takes effect right away.", confirm primary **Approve**; for revoke-admin/demote the confirm is danger.
States: Loading: skeleton rows. Empty (only you): EmptyState "No one else yet" / "Invite your first teammate from Home." Error: Banner danger "Couldn't {action}. Nothing changed. Try again." (reducers return silently on failure; detect by state not changing within 6 s). Revoked-by-cascade preview in confirm sheet shows count. Fresh-session loading inside confirm button ("Verifying you...").

### 8. Lockdown (`(app)/lockdown`, admin only)
Heading "Lockdown". Large status Card (full width, min height 160): OFF: neutral, glyph open lock, Display "Off", Body muted "Everyone enrolled can sign in." ON: `danger` 2pt border + `dangerText` Display "ON", Body "Only admins can sign in. All other sessions ended." ActionBar single control: when OFF primary-sized **danger** button **Lock down now**; when ON primary button (white) **End lockdown**. Both open ConfirmSheet.
Confirm: Lock down - title "Lock down Red Phone?", body "Everyone except admins is signed out now and can't get back in until you end lockdown.", confirm danger **Lock down**, cancel **Cancel**. End - title "End lockdown?", body "Members can sign in again.", confirm primary **End lockdown**.
States: Applying: Button loading, label "Applying..."; Error: Banner danger "Lockdown didn't change. Try again."; Success haptic Warning. A persistent `LockdownBanner` (danger, text "LOCKDOWN ACTIVE") shows on all `(app)` screens while on.
Non-admin affected view: full-screen blocking state on Unlock/Home: Heading "Access paused", Body "An admin has paused Red Phone. Wait for instructions from your admin."; no buttons (no dead ends: ghost **Check again**).

### 9. Audit feed (`(app)/audit`, admin only)
Title Heading "Audit log". Raw list (FlatList), newest first, each row (ListRow-like, min 64): left bar 4pt (neutral, `dangerText` for `security.*`), title action in mono Label-sized text? use Body 600 mono-free: action string (e.g. `member.revoked`), subtitle Label muted "#{seq} - {time} - {actor name or short key}", trailing Label mono hash prefix (first 8 of `hash`). Tap does nothing in this phase (verifier UI is Phase 5). Header Banner info: "Raw chain. Verification arrives later." (once, dismissible).
States: Loading skeleton; Empty: EmptyState "No entries yet" / "Actions you take will appear here."; Error: Banner warning "Can't load the log right now."; pagination: load older on end reached with footer spinner.

---

## Copywriting Contract

Tone: calm, plain, short, second person, no jargon, no exclamation marks, no blame. Say what happened + what to do.

| Element | Copy |
|---------|------|
| Primary CTA (Welcome) | Scan invite code |
| Primary CTA (Home) | Invite someone |
| Primary CTA (Invite step A) | Show invite code |
| Primary CTA (Invite step B) | Done |
| Primary CTA (Members approval) | Approve |
| Lockdown CTAs | Lock down now / End lockdown |
| First-admin entry | Set up first admin |
| Setup code field label | Setup code (printed by your operator) |
| Display name field label | Your name |
| Empty state - roster | Just you so far / Invite your response team in person. |
| Empty state - members | No one else yet / Invite your first teammate from Home. |
| Empty state - audit | No entries yet / Actions you take will appear here. |
| Error - offline | Can't reach Red Phone. Check your cellular data. |
| Error - invite invalid | Invite didn't work. It may be expired or already used. Ask for a new code. |
| Error - wrong PIN | Wrong PIN. {n} tries left. |
| Error - PIN cooldown | Too many tries. Try again in {ss} seconds. |
| Error - generic action | Couldn't {action}. Nothing changed. Try again. |
| Error - session | Couldn't verify this phone. Try again. |
| Access paused | Access paused. An admin has paused Red Phone. Wait for instructions from your admin. |
| Fingerprint helper | Read this out loud to confirm it's really you. |
| PIN helper | 6 digits. You'll enter it every time you open Red Phone. It never leaves this phone. |
| Biometric prompt | Unlock Red Phone |
| Destructive: Revoke | Revoke access: "{name} and everyone they invited ({n} people) will lose access immediately. This can't be undone." Confirm **Revoke access**, cancel **Keep access** |
| Destructive: Lockdown | Lock down: "Everyone except admins is signed out now and can't get back in until you end lockdown." Confirm **Lock down**, cancel **Cancel** |
| Destructive: Remove/demote admin proposal | Propose removing admin: "A second admin must approve. {name} loses admin access when they do." Confirm **Send proposal** (danger), cancel **Cancel** |
| Privacy note (Welcome footer) | Only people invited in person can join. |

Role display labels: Admin, Lead, IT, Counsel, Comms, Executive, Finance, HR, Guest, Observer. Role one-liners for OptionTile: Admin - manages the team (not invitable); Lead - runs the response; IT - technical response; Counsel - legal; Comms - messaging; Executive - decisions; Finance - payments and insurance; HR - people issues; Guest - temporary access; Observer - read only.

---

## Accessibility Contract

- Contrast: all text >= 4.5:1, UI components >= 3:1 (values above verified).
- Touch targets >= 56 for primary/danger actions and PIN keys 72; >= 48 for secondary; all others >= 44.
- Every Pressable has role + label + state. Decorative icons hidden. Status never color-only (text or glyph with it).
- Screen-reader order follows visual order; on screen mount, focus moves to the screen title (`AccessibilityInfo.setAccessibilityFocus`).
- Errors announced via `accessibilityLiveRegion` / `accessibilityRole="alert"`.
- PIN digits never in accessibility labels or logs; paste disabled; `FLAG_SECURE`/screenshot blocking is not available without a new module - accepted limitation (note to executor: do not add `expo-screen-capture`).
- Respect Dynamic Type (caps above) and Reduce Motion (no animations implemented).
- QR screen: always provide the adjacent text instruction so the flow is understandable without seeing the QR.

---

## Interaction and State Rules (global)

1. One primary action per screen, in bottom ActionBar, reachable one-handed.
2. Never auto-retry non-idempotent reducers (`redeem_invite`, `create_invite`, `revoke_member`, proposals, lockdown). On failure show Banner + explicit retry Button.
3. Every async button shows `loading` and ignores presses while busy.
4. Reducers return silently on failure (D-19): the UI must confirm outcomes from view data, with a 6-8 s timeout that falls back to the error Banner.
5. Leaving Invite step B or backgrounding > 60 s clears secrets/keys from memory.
6. All lists use `FlatList` with stable `keyExtractor` (String of bigint ids).
7. No raw hex, font size, or spacing numbers outside `app/src/ui/theme.ts`. Existing `ConnectionBadge.tsx` and `index.tsx` spike styles migrate or move to `/dev/spike` untouched.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (not applicable, React Native) | not required |
| third-party | none | not applicable |

New npm dependencies implied by this contract: none beyond those already approved (expo-camera, expo-local-authentication, expo-haptics, react-native-qrcode-svg, react-native-svg) plus already-installed `expo-symbols`, `expo-system-ui`, `react-native-safe-area-context`. Optional `expo-clipboard` for fingerprint copy is allowed but may be skipped.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
