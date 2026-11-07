import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memory = new Map<string, string>();

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
    const v = ls()?.getItem(key);
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
    ls()?.setItem(key, value);
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
    ls()?.removeItem(key);
  } catch {
    /* ignore */
  }
}
