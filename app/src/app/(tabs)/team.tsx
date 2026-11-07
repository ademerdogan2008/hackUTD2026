import { ConnectionBadge } from '../../components/ConnectionBadge';
import { EmptyState, Screen } from '../../ui';

export default function TeamTab() {
  return (
    <Screen title="Team" headerRight={<ConnectionBadge />}>
      <EmptyState title="Team" body="Placeholder. Screen agent fills this in." />
    </Screen>
  );
}
