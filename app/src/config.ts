import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra?.spacetime as { host?: string; db?: string } | undefined;

export const SPACETIME_HOST: string = extra?.host ?? 'wss://maincloud.spacetimedb.com';
export const SPACETIME_DB: string = extra?.db ?? 'red-phone-6h786-dev';

if (!SPACETIME_HOST.startsWith('wss://')) {
  throw new Error('SPACETIME_HOST must use wss:// (TLS only)');
}
