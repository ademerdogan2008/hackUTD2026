import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra?.spacetime as { host?: string; db?: string } | undefined;

/**
 * Web-only runtime override: `?db=red-phone-…` (e.g. on /demo.html) pins the database for this
 * browser tab (sessionStorage is shared with same-origin iframes), so one dev server can serve
 * both the demo and a scratch database without rebuilding.
 */
function webDbOverride(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  try {
    const valid = (s: string | null) => (s && /^red-phone-[a-z0-9-]{1,40}$/.test(s) ? s : undefined);
    const fromUrl = valid(new URLSearchParams(window.location.search).get('db'));
    if (fromUrl) window.sessionStorage.setItem('rp.db', fromUrl);
    return fromUrl ?? valid(window.sessionStorage.getItem('rp.db'));
  } catch {
    return undefined;
  }
}

export const SPACETIME_HOST: string = extra?.host ?? 'wss://maincloud.spacetimedb.com';
export const SPACETIME_DB: string = webDbOverride() ?? extra?.db ?? 'red-phone-6h786-dev';

if (!SPACETIME_HOST.startsWith('wss://')) {
  throw new Error('SPACETIME_HOST must use wss:// (TLS only)');
}
