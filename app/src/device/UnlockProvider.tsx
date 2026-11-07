import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { verifyPin } from './pin';

const LOCK_AFTER_MS = 60_000;

interface UnlockState {
  unlocked: boolean;
  locked: boolean;
  /** Verify PIN; unlocks on success. */
  unlock: (pin: string) => Promise<boolean>;
  /** Mark unlocked without verifying (right after the PIN was just set). */
  markUnlocked: () => void;
  lock: () => void;
}

const Ctx = createContext<UnlockState>({ unlocked: false, locked: true, unlock: async () => false, markUnlocked: () => {}, lock: () => {} });

export function UnlockProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        if (backgroundedAt.current && Date.now() - backgroundedAt.current >= LOCK_AFTER_MS) setUnlocked(false);
        backgroundedAt.current = null;
      } else if (backgroundedAt.current == null) {
        backgroundedAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async (pin: string) => {
    const ok = await verifyPin(pin);
    if (ok) setUnlocked(true);
    return ok;
  }, []);
  const markUnlocked = useCallback(() => setUnlocked(true), []);
  const lock = useCallback(() => setUnlocked(false), []);

  const value = useMemo(() => ({ unlocked, locked: !unlocked, unlock, markUnlocked, lock }), [unlocked, unlock, markUnlocked, lock]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUnlock(): UnlockState {
  return useContext(Ctx);
}
