import { getItem, setItem } from '../device/storage';
import { DbConnection } from '../module_bindings';

export const TOKEN_KEY = 'rp.spacetime_token';

export async function loadSavedToken(): Promise<string | undefined> {
  try {
    const t = await getItem(TOKEN_KEY);
    return t ?? undefined;
  } catch {
    // SecureStore is native-only (e.g. unavailable on web); fall back to a fresh identity.
    return undefined;
  }
}

export interface ConnectionHandlers {
  onConnected: (identityHex: string) => void;
  onDisconnected: (willReconnect: boolean) => void;
  onError: (message: string) => void;
}

export function makeBuilder(
  host: string,
  db: string,
  savedToken: string | undefined,
  handlers: ConnectionHandlers,
) {
  return DbConnection.builder()
    .withUri(host)
    .withDatabaseName(db)
    .withToken(savedToken)
    .withCompression('none')
    .withAutomaticReconnect()
    .onConnect((_conn, identity, token) => {
      setItem(TOKEN_KEY, token).catch(() => {
        // Token persistence is best-effort; never let storage errors break the connection.
      });
      handlers.onConnected(identity.toHexString());
    })
    .onDisconnect((_ctx, _err, nextAttempt) => {
      handlers.onDisconnected(nextAttempt !== undefined);
    })
    .onConnectError((_ctx, err) => {
      handlers.onError(err?.message ?? String(err));
    });
}
