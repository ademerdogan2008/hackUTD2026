// Chat unread tracking + in-app message toast. Mounted once in the tabs layout.
// In-memory only: "seen" = highest message id observed while the Chat tab was focused.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../../module_bindings';
import { canSeeCounsel, useMe } from '../../state/hooks';
import { MessageToast, type ToastMsg } from './MessageToast';

interface ChatUnreadCtx {
  unread: number;
  setChatFocused: (focused: boolean) => void;
}

const Ctx = createContext<ChatUnreadCtx>({ unread: 0, setChatFocused: () => {} });

export function useChatUnread() {
  return useContext(Ctx);
}

const TOAST_MS = 4000;

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { me, identityHex } = useMe();
  const showCounsel = canSeeCounsel(me?.role);
  const [allRows, allReady] = useTable(tables.allMessages);
  const [counselRows] = useTable(tables.counselMessages);

  const [focused, setFocused] = useState(false);
  const [lastSeen, setLastSeen] = useState<bigint | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const toastedMax = useRef<bigint | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Visible messages, newest last, deduped by id.
  const msgs = useMemo(() => {
    const byId = new Map<string, (typeof allRows)[number]>();
    for (const r of allRows) byId.set(r.id.toString(), r);
    if (showCounsel) for (const r of counselRows) byId.set(r.id.toString(), r);
    return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }, [allRows, counselRows, showCounsel]);

  const maxId = msgs.length ? msgs[msgs.length - 1].id : 0n;

  // Baseline: history already present on first load counts as seen (no toast storm).
  useEffect(() => {
    if (!allReady || lastSeen !== null) return;
    setLastSeen(maxId);
    toastedMax.current = maxId;
  }, [allReady, lastSeen, maxId]);

  // While Chat is focused, everything that arrives is seen.
  useEffect(() => {
    if (focused && lastSeen !== null && maxId > lastSeen) setLastSeen(maxId);
  }, [focused, maxId, lastSeen]);

  // Toast the newest message from someone else when Chat is not focused.
  useEffect(() => {
    const prev = toastedMax.current;
    if (prev === null || maxId <= prev) return;
    toastedMax.current = maxId;
    if (focused) return;
    const fresh = msgs.filter((m) => m.id > prev && m.author.toHexString() !== identityHex);
    const latest = fresh[fresh.length - 1];
    if (!latest) return;
    setToast({
      key: latest.id.toString(),
      authorHex: latest.author.toHexString(),
      authorName: latest.authorName,
      body: latest.body,
      counsel: latest.channel === 'counsel',
    });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, [maxId, msgs, focused, identityHex]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const setChatFocused = useCallback((f: boolean) => {
    setFocused(f);
    if (f) setToast(null);
  }, []);

  const unread = useMemo(() => {
    if (lastSeen === null || focused) return 0;
    return msgs.filter((m) => m.id > lastSeen && m.author.toHexString() !== identityHex).length;
  }, [msgs, lastSeen, focused, identityHex]);

  const value = useMemo(() => ({ unread, setChatFocused }), [unread, setChatFocused]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <MessageToast msg={toast} onDismiss={() => setToast(null)} />
    </Ctx.Provider>
  );
}
