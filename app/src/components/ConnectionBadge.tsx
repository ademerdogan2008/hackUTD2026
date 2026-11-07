import { useSpacetimeDB } from 'spacetimedb/react';
import { useConnectionStatus } from '../spacetime/SpacetimeRoot';
import { StatusPill } from '../ui';

export function ConnectionBadge({ ready = true }: { ready?: boolean }) {
  const { isActive } = useSpacetimeDB();
  const { phase } = useConnectionStatus();
  return <StatusPill live={isActive && phase === 'connected' && ready} />;
}
