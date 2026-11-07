import { Redirect } from 'expo-router';

// Stub: the join/unlock agent replaces this with state-based routing
// (no key -> /join, key but locked -> /unlock, unlocked -> /(tabs)/home).
export default function Index() {
  return <Redirect href={"/join" as never} />;
}
