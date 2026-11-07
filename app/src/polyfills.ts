import { getRandomValues } from 'expo-crypto';
import { AppState } from 'react-native';

/* eslint-disable @typescript-eslint/no-explicit-any */
const g = globalThis as any;

g.crypto ??= {};
g.crypto.getRandomValues ??= getRandomValues;

if (typeof g.TextEncoder === 'undefined' || typeof g.TextDecoder === 'undefined') {
  console.error('[polyfills] TextEncoder/TextDecoder missing; spacetimedb and noble need them');
}

type Listener = (e: any) => void;
const registry = new Map<string, Set<Listener>>();
const record = (type: string, fn: Listener) => {
  if (!registry.has(type)) registry.set(type, new Set());
  registry.get(type)!.add(fn);
};

const w = (g.window ??= g);
const native = typeof w.addEventListener === 'function';

if (native) {
  const origAdd = w.addEventListener.bind(w);
  const origRemove = typeof w.removeEventListener === 'function' ? w.removeEventListener.bind(w) : undefined;
  w.addEventListener = (type: string, fn: Listener, ...rest: unknown[]) => {
    record(type, fn);
    return origAdd(type, fn, ...rest);
  };
  w.removeEventListener = (type: string, fn: Listener, ...rest: unknown[]) => {
    registry.get(type)?.delete(fn);
    return origRemove?.(type, fn, ...rest);
  };
} else {
  w.addEventListener = (type: string, fn: Listener) => record(type, fn);
  w.removeEventListener = (type: string, fn: Listener) => {
    registry.get(type)?.delete(fn);
  };
}
console.log(`[polyfills] window.addEventListener native=${native}`);

AppState.addEventListener('change', (s) => {
  if (s === 'active') {
    registry.get('focus')?.forEach((fn) => fn({ type: 'focus' }));
  }
});
