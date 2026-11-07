import * as SecureStore from 'expo-secure-store';
import { DbConnection } from '../module_bindings';

export const TOKEN_KEY = 'rp.spacetime_token';

export async function loadSavedToken(): Promise<string | undefined> {
  const t = await SecureStore.getItemAsync(TOKEN_KEY);
  return t ?? undefined;
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
      void SecureStore.setItemAsync(TOKEN_KEY, token, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
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
