<!-- GSD:project-start source:PROJECT.md -->
## Project

**Red Phone**

Red Phone is a sealed, out-of-band emergency channel for cyber incident response, built for the Winstead PC challenge at HackUTD 2026. It runs on responders' personal phones over cellular data and is hosted on SpacetimeDB (Spacetime) Maincloud, so it keeps working even when an attacker controls every internal company system. During an attack it gives each responder a secure group-text-style space to coordinate and a pushed, role-specific checklist of what to do next.

**Core Value:** When an attack is confirmed, every enrolled responder gets an alert on their personal phone and immediately sees the next pre-approved task for their role, with no dependency on any company system.

### Constraints

- **Timeline**: Demo-ready by Sunday 2026-11-08 — hackathon deadline
- **Tech stack**: Expo (React Native) client, SpacetimeDB TypeScript module, Maincloud hosting (HACKUTD2026 credit) — chosen stack from plan.md; TypeScript on both sides for shared types
- **Security**: SpacetimeDB 2.11+ (identity-impersonation fix); scheduled reducers reject any caller except the module; push payloads carry no incident details
- **Secrets**: Spacetime token lives only in a gitignored `.env`; never committed or copied into agent config
- **Devices**: Personal iOS/Android phones running Expo; `expo-secure-store` for keys, `expo-local-authentication` for biometrics, Expo push for notifications
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## TL;DR (prescriptive)
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| SpacetimeDB CLI (`spacetime`) | **2.14.1** (`spacetime version use 2.14.1`) | init / build / publish / generate / logs | Matches the npm lib. Has views with arguments (2.13+) and the impersonation fix (2.11+). The installed 2.12.0 lags the lib by two minor versions. | HIGH (npm + `spacetime version list`) |
| `spacetimedb` (module) | **2.14.1** | Server module SDK: `spacetimedb/server` (`schema`, `table`, `t`, `SenderError`), plus `ScheduleAt`, `Timestamp` from `spacetimedb` | Official TS module SDK. Modules run on V8, and npm deps are bundled at publish. | HIGH |
| `spacetimedb` (client) | **2.14.1** | Client SDK plus `spacetimedb/react` hooks (`SpacetimeDBProvider`, `useSpacetimeDB`, `useTable`, `useReducer`, `useProcedure`) | Same package as the module. The React hooks use only `react` (`useSyncExternalStore`) and have no DOM dependency. | HIGH (exports read from package) / MEDIUM (RN runtime untested by us) |
| SpacetimeDB Maincloud | managed | Hosting at `wss://maincloud.spacetimedb.com` | Required by the project. Off the company network, so it fits the out-of-band threat model. | HIGH |
| Expo SDK | **58** (`expo@58.0.23`) | App runtime and native modules | Latest SDK (58.0.0 shipped 2026-09-29). Its runtime installs spec-compliant `URL`, `URLSearchParams`, `structuredClone`, `fetch`, and `TextDecoderStream`. | HIGH |
| React Native | **0.88.1** (pinned by Expo 58) | Native runtime, Hermes JS engine | Hermes in RN >= 0.86 has `Promise.withResolvers`. SDK issue #5342 is fixed in the SDK anyway. RN WebSocket supports subprotocols and `binaryType='arraybuffer'`. | HIGH |
| React | **19.3.0** (pinned by Expo 58) | UI | Satisfies the `spacetimedb` peer range `^19.0.0`. | HIGH |
| TypeScript | **~5.9.3** (both projects) | Types shared by both sides | `spacetimedb` itself builds against `^5.9.3`. Do **not** use TS 7.0.2 (latest; the Go-native compiler), because Expo/Metro/SpacetimeDB tooling has not been checked against it. | MEDIUM |
| Node.js | **>= 24.22.1** | CLI tooling, module bundling, Vitest | Engines floor of `spacetimedb@2.14.1`. `@expo/cli@58` needs `^24.3.0`. | HIGH |
### Supporting Libraries — Client (Expo app)
| Library | Version | Purpose | When to Use | Expo Go? | Confidence |
|---------|---------|---------|-------------|----------|------------|
| `expo-router` | ~58.0.30 | File-based navigation (enroll / unlock / incident / chat tabs) | Always; the Expo default | Yes | HIGH |
| `expo-secure-store` | ~58.0.2 | Ed25519 secret key, SpacetimeDB auth token, PIN hash + salt | Always. Use `keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY` so keys never reach iCloud backups or other devices. Add `requireAuthentication: true` only in dev builds. | Yes (basic). `requireAuthentication` **not supported in Expo Go** | HIGH |
| `expo-local-authentication` | ~58.0.2 | Biometric gate: `hasHardwareAsync`, `isEnrolledAsync`, `authenticateAsync({ promptMessage, disableDeviceFallback, biometricsSecurityLevel: 'strong' })` | Unlock screen, before the PIN | Partly. **Face ID is not supported in Expo Go** (falls back to device passcode). Android fingerprint should work. | HIGH (docs) |
| `expo-camera` | ~58.0.14 | QR scanning: `<CameraView barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={...} />`, `useCameraPermissions()` | Invite redeem screen | Yes | HIGH |
| `react-native-qrcode-svg` | 6.3.54 | Shows the invite QR on the inviter's screen | Invite create screen. Pure JS over `react-native-svg`. | Yes | HIGH |
| `react-native-svg` | **15.16.0** (Expo-pinned; npm latest is 15.16.1, so do not take latest) | Peer of qrcode-svg | Install with `npx expo install` | Yes | HIGH |
| `expo-notifications` | ~58.1.8 | Expo push token, local notifications, Android channel | Alert delivery | Partly. **Android remote push throws in Expo Go (SDK 53+).** iOS Expo Go only logs a warning. Local notifications work everywhere. | HIGH (source of `warnOfExpoGoPushUsage.ts`) |
| `expo-device` | ~58.0.5 | `Device.isDevice` check before requesting a push token | Push registration | Yes | HIGH |
| `expo-constants` | ~58.0.15 | Read `expoConfig.extra.eas.projectId` for `getExpoPushTokenAsync({ projectId })` | Push registration | Yes | HIGH |
| `expo-crypto` | ~58.0.7 | CSPRNG: `getRandomBytes(32)` for invite secrets and Ed25519 seeds; `getRandomValues` to polyfill `globalThis.crypto` | Always. Has SHA digests but **no Ed25519**. | Yes | HIGH |
| `@noble/curves` | **2.4.0** | `ed25519.getPublicKey / sign` on the phone | Device key generation and challenge signing. ESM-only; import `@noble/curves/ed25519.js` (with `.js`). | Yes (pure JS) | HIGH (lib) / MEDIUM (Hermes speed untested) |
| `@noble/hashes` | **2.4.0** | `sha256` (`@noble/hashes/sha2.js`), `bytesToHex`, `utf8ToBytes` | Invite secret hash, key fingerprint, canonical signing payload. Use the same bytes as the module. | Yes | HIGH |
| `expo-haptics` | ~58.0.7 | Strong vibration on alert/task arrival | Alert UX | Yes | HIGH |
| `expo-clipboard` | ~58.0.4 | Copy fingerprint / report text | Optional | Yes | HIGH |
| `expo-print` + `expo-sharing` | ~58.0.8 / ~58.0.22 | Export incident report as a PDF and share it | Stretch (report export) | Yes | HIGH |
| `expo-dev-client` | ~58.0.18 | Dev build: real Face ID, Android remote push, `requireAuthentication` | Only if a dev build is made (see Variants) | n/a | HIGH |
### Supporting Libraries — Module (SpacetimeDB)
| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `@spacetimedb/crypto` | **0.1.0** | `sha256`, `hmacSha256`, `timingSafeEqual`, `bytesToHex`, `hexToBytes`, `base64ToBytes` | Hash-chained audit log, invite-secret hash comparison (`timingSafeEqual`), fingerprint. Official Clockwork package with a pure-JS `@noble/hashes` dependency, so it is known to run in the module runtime. | HIGH (package README + manifest) |
| `@noble/curves` | **2.4.0** | `ed25519.verify(sig, msg, pubKey)` | Every sensitive reducer verifies the signed challenge. Pure JS, needs only `TextEncoder` and BigInt, both present. The module runtime itself uses `TextEncoder`/`TextDecoder`, and no `crypto.subtle` is referenced. | MEDIUM (pure-JS reasoning + `@spacetimedb/crypto` precedent. Run a publish smoke test early.) |
| `vitest` | `^3.2.4` (as the official skill says, not latest 5.1.0) | Module unit tests via `spacetimedb/server/test-utils/vitest` plugin | Test reducer authorization, invite redemption, and the audit chain without publishing | HIGH (skill) |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| `spacetime` 2.14.1 | `spacetime build`, `spacetime publish redphone --yes` (Maincloud default), `spacetime generate`, `spacetime logs redphone -f`, `spacetime sql` | Do not commit tokens. `spacetime login` once, interactively. Project rules say agents must not run publish/login. |
| `spacetime.json` | Project config: `{"database":"<name>","module-path":"./spacetimedb","server":"maincloud","generate":[{"language":"typescript","out-dir":"./app/src/module_bindings"}]}` | `spacetime.local.json` (gitignored) holds personal overrides. `spacetime dev` implicitly uses `--env dev`. |
| `eas-cli` | 27.5.0 | `eas init` (creates the EAS `projectId`, which push tokens need even in Expo Go), `eas build -p android --profile preview` (APK), `eas credentials` |
| `create-expo-app` | 5.0.0 | `npx create-expo-app@latest app --template default@sdk-58` |
| Expo Go (store app) | SDK 58 | Zero-install path for judges, with the limitations listed below |
## Installation
# 0. Toolchain (user runs these; agents must not change global config without consent)
#    Node >= 24.22.1 (nvm install 24 / brew upgrade node)
# 1. Module (no React Native template exists; scaffold server-only)
# 2. App
# stretch: npx expo install expo-print expo-sharing
# dev build only: npx expo install expo-dev-client
# 3. Bindings (re-run after every schema/reducer change)
## Key Integration Snippets (load-bearing details)
### A. App entry: polyfills, before any `spacetimedb` or noble import
### B. Connection to Maincloud from React Native
- The SpacetimeDB token is an anonymous identity issued by the server on first connect. It is a bearer credential, so keep it in SecureStore, never AsyncStorage. A stolen token gives the attacker this identity, which is why sensitive reducers also require the Ed25519 signature.
- The SDK fetches `POST /v1/identity/websocket-token` before opening the socket. Expo's `fetch` handles this.
- `useTable` rows are `readonly`. `u64` values are `bigint`, so wrap them in `Number()`/`String()` before rendering in JSX.
- `UnknownCallResultError` on disconnect means the reducer **may have run**. Never auto-retry non-idempotent calls such as `redeem_invite` or `raise_alert`.
### C. Module: tables, view visibility, scheduled push procedure
### D. Module: signature verification and the hash chain
### E. Visibility with views (indexed lookups only)
- `view` (per-sender, has `ctx.sender`) vs `anonymousView` (shared, cheaper). Per-sender cost scales with subscriber count, which is fine at about 20 responders.
- **Not allowed in views:** `.iter()` full scans. Allowed: `.find()` / `.filter()` on indexed columns, and `count()`.
- Consequences for the plan.md schema:
- Do **not** use `clientVisibilityFilter.sql` (RLS). The docs say: "Row Level Security is an experimental, unstable feature… The API may change or be removed." They also say to prefer views.
- Do **not** mark sensitive tables `public: true`. Keep base tables private and expose only through views.
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@noble/curves` ed25519 (pure JS, both sides) | `@noble/ed25519@3.2.0` (smaller, but needs `ed.hashes.sha512 = sha512` wiring on both sides) | If module bundle size matters. Equally valid, with one extra setup line. |
| `@noble/curves` on the phone | `react-native-quick-crypto@1.1.9` (native, fast, Node-crypto API) | Only if you commit to dev builds. It does **not** run in Expo Go. |
| Ed25519 private key in `expo-secure-store` | Hardware-bound P-256 key in Secure Enclave / StrongBox (e.g. a custom Expo module) | Only after the hackathon. Expo has no first-party Secure Enclave signing API, and it would need a dev build and P-256 verification in the module. State the limitation to judges honestly: the key is stored in hardware-backed Keychain/Keystore storage, but signing happens in JS memory. |
| `@spacetimedb/crypto` sha256 in the module | `@noble/hashes/sha2.js` directly | Equivalent, since `@spacetimedb/crypto` wraps noble. Use noble directly if you want one import style. |
| Views for visibility | RLS `clientVisibilityFilter.sql` | Only when a view cannot express the rule. Experimental. |
| Scheduled procedure for push | Client calls a `notify` procedure after `confirm_alert` | Never. Any client could then trigger pushes. Keep it server-internal. |
| Expo Go for judges | EAS dev/preview build (APK for Android; iOS needs device UDID registration or TestFlight) | Android judges: a preview APK gives real background push. iOS: TestFlight external review needs lead time that the weekend does not allow. |
| SpacetimeDB anonymous identity + device key | SpacetimeAuth / OIDC (Google, etc.) | No. Third-party/company SSO conflicts with the out-of-band threat model, and invite-based enrollment replaces it. |
| `react-native-qrcode-svg` | `react-native-qrcode-styled`, `expo-barcode-generator` | No benefit for a plain QR. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Default `gzip` compression on the RN client | `DecompressionStream` does not exist in Hermes/Expo, so the SDK closes the socket when a compressed frame arrives (`[SpacetimeDB] WebSocket decompress failed, closing socket`) | `.withCompression('none')` |
| `ctx.random` / `ctx.newUuidV4()` for invite secrets, nonces, or session tokens | Seeded from `ctx.timestamp`, so deterministic and predictable | Secrets from `expo-crypto.getRandomBytes(32)` on the device. The server stores only `sha256`. Make challenges single-use and short-expiry, and bind them to action and arguments. |
| `crypto.subtle` / WebCrypto in the module | Not provided by the module V8 runtime (no reference in the server bundle) | `@spacetimedb/crypto` / `@noble/*` |
| `async`/`await` in reducers, procedures, or HTTP handlers | Callbacks must be synchronous; `ctx.http.fetch` is sync | Return values directly |
| `.iter()` inside views | Views only allow indexed lookups | Add `.index('btree')` columns and use `.filter()` |
| `JSON.stringify` of rows for hashing | Throws on `bigint`, and key order is not guaranteed canonical | Explicit pipe-delimited string or length-prefixed bytes |
| Old `@clockworklabs/spacetimedb-sdk` package and 1.x tutorials | Deprecated since 1.4; the 1.x API differs substantially | `spacetimedb@2.14.1` |
| Constructing `Identity` from hex strings in the module | Serialization fails and kills the module (per skill) | Identities come from `ctx.sender` / `t.identity()` columns |
| `AsyncStorage` for the token or keys | Plaintext on disk | `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| `react-native-get-random-values` | Not in Expo 58's bundled native module list, so its presence in Expo Go is not guaranteed | `expo-crypto.getRandomValues` polyfill (snippet A) |
| TypeScript 7.x | Brand-new Go compiler; ecosystem not verified | `typescript@~5.9.3` |
| Incident details in the push payload | Breaks the content-free push requirement (Apple/Google see the payload) | `title: 'Red Phone', body: 'Open app'`, with no `data` |
| `shouldShowAlert` in `setNotificationHandler` | Deprecated | `shouldShowBanner: true, shouldShowList: true` |
## Stack Patterns by Variant
| Capability | Expo Go iOS | Expo Go Android | Dev build |
|------------|-------------|-----------------|-----------|
| SpacetimeDB WebSocket + hooks | Yes | Yes | Yes |
| noble Ed25519 / SHA-256 | Yes | Yes | Yes |
| SecureStore get/set | Yes | Yes | Yes |
| SecureStore `requireAuthentication` | **No** | **No** (docs: unsupported in Expo Go) | Yes |
| Face ID / biometrics | **Face ID no** (device passcode fallback) | Fingerprint expected to work (MEDIUM) | Yes (needs `faceIDPermission` / `NSFaceIDUsageDescription`) |
| QR scan / QR display | Yes | Yes | Yes |
| Remote push (Expo push API) | Works, with a dev warning (MEDIUM; source only warns) | **Throws** (removed in SDK 53) | Yes (Android: FCM V1 creds; iOS: APNs key, **paid Apple account**) |
| Local notifications | Yes | Yes | Yes |
- **If Expo Go:** describe unlock as "device authentication (biometric or passcode) + app PIN + signed challenge". Wrap `getExpoPushTokenAsync` in try/catch. Always run the **in-app alert path** too: a subscription `onInsert` on the incident fires `scheduleNotificationAsync` (local), haptics, and a full-screen alert. This works on every variant while the app is open, which matches the demo.
- **If a dev/preview build (Android APK via `eas build -p android --profile preview`):** you get real background push. It needs a Firebase project plus FCM V1 service-account key uploaded through `eas credentials`. Add `expo-dev-client` only for dev builds.
- **Push tokens always need an EAS `projectId`** (`eas init`). `getExpoPushTokenAsync` rejects with `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID` without one. Create the Android channel (`setNotificationChannelAsync('alerts', { importance: MAX })`) **before** requesting permission, because the Android 13+ prompt does not appear until a channel exists.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `spacetimedb@2.14.1` (npm) | `spacetime` CLI 2.14.1 | Keep them identical. CLI 2.12.0 is currently active; switch it. |
| `spacetimedb@2.14.1` | Node `^22.23.4 \|\| ^24.22.1 \|\| >=26.12.1` | Local 24.18.0 is too old; npm will warn (EBADENGINE) and module tests may misbehave |
| `spacetimedb@2.14.1` client | React `^18 \|\| ^19` peer | Expo 58 pins 19.3.0, which is fine |
| `spacetimedb` client | Hermes (RN 0.88) | Needs `withCompression('none')`. `Promise.withResolvers` usage removed (issue #5342, fixed 2026-06). RN WebSocket populates `.protocol` on open, so v3/v2 subprotocol negotiation works. |
| `expo@58.0.23` | `react-native@0.88.1`, `react@19.3.0`, `react-native-svg@15.16.0` | Use `npx expo install`; do not hand-pin |
| `@noble/curves@2.4.0` / `@noble/hashes@2.4.0` | Metro (package `exports` on by default since RN 0.79), module bundler | ESM-only; subpath imports need the `.js` suffix (`@noble/curves/ed25519.js`) |
| `@spacetimedb/crypto@0.1.0` | `@noble/hashes ^2.2.0` | Dedupes with app/module `@noble/hashes@2.4.0` |
| `react-native-qrcode-svg@6.3.54` | `react-native-svg >=14` | Pulls `text-encoding@0.7.0` (old but harmless) |
| Expo Push API | Batch <= 100 messages/request, <= 600/s/project, ~4 KiB payload | One request with mixed Expo Go and dev-build tokens can return `PUSH_TOO_MANY_EXPERIENCE_IDS`. Group tokens per experience, or retry the failed group separately. |
## Open Risks to Validate in the First Phase (spike)
## Sources
- npm registry (queried 2026-11-07): `spacetimedb` 2.14.1, `@spacetimedb/crypto` 0.1.0, `expo` 58.0.23 (dist-tag latest; 58.0.0 shipped 2026-09-29), Expo `bundledNativeModules.json` (RN 0.88.1, React 19.3.0, module pins), `@noble/curves` 2.4.0, `@noble/hashes` 2.4.0, `@noble/ed25519` 3.2.0, `react-native-qrcode-svg` 6.3.54, `eas-cli` 27.5.0. HIGH
- `spacetimedb@2.14.1` tarball source/types: `dist/sdk/index.mjs` (gzip default, DecompressionStream, `withCompression`, WS protocol negotiation, websocket-token fetch), `dist/react/index.d.ts` (hooks), `dist/server/http_internal.d.ts` (sync `fetch`, `RequestOptions.timeout`), `dist/lib/reducers.d.ts` (`senderAuth.isInternal`, `databaseIdentity`, `env`), `makeRandom(this.timestamp)`. HIGH
- `@spacetimedb/crypto@0.1.0` README + package.json (API, `@noble/hashes` dep). HIGH
- `expo@58.0.23` `src/winter/runtime.native.ts` (installed globals); `expo-notifications@58.1.8` `src/warnOfExpoGoPushUsage.ts`; `expo-secure-store@58.0.2` / `expo-crypto@58.0.7` / `expo-camera@58.0.14` type definitions. HIGH
- Official SpacetimeDB 2.x agent skills (concepts, typescript-server, typescript-client, cli) at `/Users/adem/.agents/skills/`. HIGH
- https://spacetimedb.com/docs/functions/procedures/ (sync `ctx.http.fetch`, 30 s default / 180 s max timeout, `withTx`). HIGH
- https://spacetimedb.com/docs/functions/views/ (indexed lookups only, no `.iter()`, view vs anonymousView, args). HIGH
- https://spacetimedb.com/docs/tables/access-permissions/ and https://spacetimedb.com/docs/how-to/rls/ (RLS experimental; prefer views). HIGH
- https://spacetimedb.com/docs/functions/reducers/reducer-context/ (`ctx.random` deterministic). HIGH
- https://spacetimedb.com/docs/quickstarts/react/ and https://github.com/clockworklabs/SpacetimeDB/tree/master/templates (no RN/Expo template exists). HIGH
- https://spacetimedb.com/docs/cli-reference/spacetime-json (config fields). MEDIUM
- https://github.com/clockworklabs/SpacetimeDB/issues/5342 (Hermes `Promise.withResolvers`; users running SpacetimeDB on Expo SDK 56) and https://github.com/clockworklabs/SpacetimeDB/issues/3026 (RN connection errors surfaced in 2.12). MEDIUM
- https://raw.githubusercontent.com/facebook/react-native/main/packages/react-native/Libraries/WebSocket/WebSocket.js (protocol on open, arraybuffer). HIGH
- https://docs.expo.dev/versions/latest/sdk/notifications/ (SDK 58; Android Expo Go push removed; `shouldShowBanner`; channels). HIGH
- https://docs.expo.dev/versions/latest/sdk/local-authentication/ (Face ID unsupported in Expo Go; `faceIDPermission`). HIGH
- https://docs.expo.dev/versions/latest/sdk/securestore/ (`requireAuthentication` not in Expo Go; key charset; biometric change invalidates). HIGH
- https://docs.expo.dev/push-notifications/sending-notifications/ (endpoint, headers, 100/batch, 600/s, error codes). HIGH
- https://docs.expo.dev/push-notifications/push-notifications-setup/ (paid Apple account needed for own APNs creds). HIGH
- noble READMEs (`@noble/curves`, `@noble/ed25519`): React Native needs a `getRandomValues` polyfill. HIGH
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
