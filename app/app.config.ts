import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    spacetime: {
      host: process.env.EXPO_PUBLIC_SPACETIME_HOST ?? 'wss://maincloud.spacetimedb.com',
      db: process.env.EXPO_PUBLIC_SPACETIME_DB ?? 'red-phone-6h786-dev',
    },
  },
});
