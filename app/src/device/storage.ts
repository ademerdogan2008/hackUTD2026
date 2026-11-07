import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memory = new Map<string, string>();

/**
 * Web demo: each browser frame can act as a separate person via `?as=<slot>` (e.g. ?as=lead).
 * The slot is pinned in window.name so it survives in-app navigation and reloads, and namespaces
 * every stored key (device key, PIN, Spacetime token) so side-by-side frames are distinct identities.
 */
function webSlot(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('as');
    if (fromUrl && /^[a-z0-9_-]{1,32}$/i.test(fromUrl)) {
      window.name = 'rp:' + fromUrl;
      return fromUrl;
    }
    return window.name.startsWith('rp:') ? window.name.slice(3) : '';
  } catch {
    return '';
  }
}
const SLOT = webSlot();
const k = (key: string) => (SLOT ? `${key}.${SLOT}` : key);

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** SecureStore on native; any error (or web) falls back to localStorage, then memory. */
export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS !== 'web') {
    try {
      const v = await SecureStore.getItemAsync(key);
      if (v != null) return v;
    } catch {
      /* fall through */
    }
  }
  try {
    const v = ls()?.getItem(k(key));
    if (v != null) return v;
  } catch {
    /* fall through */
  }
  return memory.get(key) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  memory.set(key, value);
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    ls()?.setItem(k(key), value);
  } catch {
    /* memory only */
  }
}

export async function removeItem(key: string): Promise<void> {
  memory.delete(key);
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
  }
  try {
    ls()?.removeItem(k(key));
  } catch {
    /* ignore */
  }
}
