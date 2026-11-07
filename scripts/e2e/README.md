# Demo-flow e2e (two browser identities)

Runs the full tabletop against the dev DB through Expo web in two headless Chrome profiles
(separate profiles = separate Spacetime identities). Requires an EMPTY dev DB (first-admin flow).

1. `npm run publish:dev` (or reset via the app's Team → Reset demo; full wipe needs `--delete-data`)
2. `npm run web` (Metro on :8081)
3. Start two headless Chromes:
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9401 --user-data-dir=/tmp/rpA about:blank &`
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9402 --user-data-dir=/tmp/rpB about:blank &`
4. `node scripts/e2e/demo-flow.mjs /tmp` — screenshots land in /tmp.
