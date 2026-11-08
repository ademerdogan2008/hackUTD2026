# Tripwire demo

A fake intranet for the victim firm **Halvorsen & Pike LLP** plus a small Node relay.
IT plants three decoy files. When an attacker opens or uses one, the relay reports
the hit to Red Phone (SpacetimeDB), and responders' phones show "Attacker active".

No npm dependencies and no build step. Needs Node 18+ (tested on Node 24).

| Tripwire | Shown as | Where | Fires when | hitKind |
|---|---|---|---|---|
| `tw_partner_comp` | `Partner_Compensation_2026.xlsx` | Shared drives | the file is opened (beacon `/t/:token`) | `document_opened` |
| `tw_backup_admin` | `service_accounts_README.txt` | Email and calendar | someone submits the "Backup Console" login (`POST /login/:token`) | `login_attempt` |
| `tw_billing_keys` | `billing_api_keys.txt` | Billing and trust accounting | someone calls the fake billing API (`/k/:token/...`) | `key_used` |

## Run

```sh
cd tripwire-demo && node relay.mjs
# open http://localhost:8787/?key=<DEMO_KEY>
node test.mjs               # automated checks (mock mode + a fake SpacetimeDB server)
```

The relay reads the repo root `.env` (the same file `scripts/rp-spacetime.sh` uses):

- `SPACETIME_TOKEN` is the one token for every reducer call. `STDB_TOKEN` overrides it.
  `STDB_ADMIN_TOKEN` optionally overrides it for `plant_tripwire` and `reset_tripwire_demo` only.
- `RP_DB_DEV` is the database (`STDB_DB` overrides; fallback `red-phone-6h786-dev`).
- `MODE` defaults to `spacetime` when a token is found, else `mock`.

Other settings (`PORT`, `DEMO_KEY`, `RELAY_PUBLIC_URL`, `DEMO_SOURCE_IP`, ...) can go in
`tripwire-demo/.env` (see `.env.example`) or the environment. If `DEMO_KEY` is unset, the
relay generates one and prints it at startup. Tokens are never printed or logged.

In spacetime mode the relay calls `POST {STDB_HOST}/v1/database/{STDB_DB}/call/{reducer}`
with `Authorization: Bearer <token>` and a JSON array of arguments:

- Startup: `register_relay []`. The first caller becomes the relay; later runs are a no-op.
- Arming: `plant_tripwire [id, label, kind, assetId, fileName, tokenHash]`, once per decoy.
- Each hit: `record_hit [tokenHash, hitKind, sourceIp, userAgent]`.
- Reset: `reset_tripwire_demo []`.

Every call is logged as `[stdb] OK ...` or `[stdb] FAIL ... <status> <response>`.
If plant fails, the arming step shows a warning instead of "registered in Red Phone".
Mock mode makes no calls and prints each hit:

```
🚨 TRIPWIRE HIT tw_partner_comp document_opened from 10.20.4.17 (actual ::ffff:127.0.0.1) at ... ua="..."
```

Source IP: a hit from loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) is reported as
`DEMO_SOURCE_IP` (default `10.20.4.17`) so the stage demo looks like a workstation on the
firm network. Set `DEMO_SOURCE_IP=` (empty) to report the real address. The log shows both.

For a remote attacker device, expose the relay (for example with a tunnel) and set
`RELAY_PUBLIC_URL` to that address before arming. It is written into the decoy files.
Set `TRUST_PROXY=1` only behind a trusted proxy, so the source IP comes from `X-Forwarded-For`.

## Stage steps

1. Run `cd tripwire-demo && node relay.mjs`. Check the log for `[stdb] OK register_relay`.
2. Open `http://localhost:8787/?key=<DEMO_KEY>` in **IT view**.
3. Click **Plant tripwires**. The steps stream in, and each decoy appears in its folder with a "Tripwire" badge.
4. Switch to **Attacker view** (badges, counts, the IT panel and the Simulate buttons disappear;
   the decoys look like normal files).
5. Open **Shared drives** and click `Partner_Compensation_2026.xlsx`. The spreadsheet loads its beacon.
6. Phones alert: Jev opens the incident (high tier) with its evidence ("Decoy file
   Partner_Compensation_2026.xlsx in Shared drives was opened.", "Source 10.20.4.17 · ...").
   The intranet itself never shows that a tripwire fired.
7. To show the other tiers, go back to **IT view**. Under **Simulate** in the Tripwires panel
   (all fire `tw_partner_comp`):
   - **Attacker opens decoy (high)**: source `10.20.4.17`, Windows Chrome. Jev auto-opens.
   - **IT staff opens decoy (mid)**: source `10.10.2.5` (IT admin subnet). Jev asks one lead to confirm.
   - **Indexer touches decoy (low)**: source `10.0.0.40`, `HP-IndexBot/2.1`. Jev logs a false positive.
   - **Reset demo**: disarms the decoys and calls `reset_tripwire_demo`.

   The panel shows "Sent to Red Phone ✓" or the error.

Optional: open `service_accounts_README.txt` and submit the console login, or click the
curl URL in `billing_api_keys.txt`.

Backup from a terminal:

```sh
curl -X POST "http://localhost:8787/api/fire?key=$DEMO_KEY" -d '{"id":"tw_partner_comp","profile":"attacker"}'
```

## API

Public (attacker-facing): `GET /`, `GET /api/decoys`, `GET /d/:token/:name` (decoy content, records no hit),
`GET /t/:token`, `GET|POST /login/:token`, `ANY /k/:token/...`. Unknown tokens return a plain 404 and record nothing.

DEMO_KEY required (`?key=` or `X-Demo-Key` header, timing-safe compare, else 401):
`POST /api/arm`, `POST /api/fire {id, profile}` (`attacker` default, `it_staff`, `indexer`; unknown profile 400),
`POST /api/reset` (also calls `reset_tripwire_demo`), `GET /api/events` (SSE), `GET /api/files`, `GET /api/hits`.

## Guardrails

- Detect only. The relay never acts on the attacker's machine.
- Collect the minimum: tripwire id, hit kind, time, source IP, user agent (200 chars max).
- Login bodies are drained unread. Passwords and usernames are never stored or logged.
- Raw tokens exist only inside the in-memory decoy content. Lookups use `sha256(token)`.
  Re-arming issues fresh tokens, and old ones return 404.
- Repeat hits on the same tripwire within 5 seconds are ignored.
- Attacker-facing responses are plain: no tripwire text, no tell-tale headers.
