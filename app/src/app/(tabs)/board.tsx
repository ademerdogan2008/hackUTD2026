import { ConnectionBadge } from '../../components/ConnectionBadge';
import { EmptyState, Screen } from '../../ui';

export default function BoardTab() {
  return (
    <Screen title="Board" headerRight={<ConnectionBadge />}>
      <EmptyState title="Board" body="Placeholder. Screen agent fills this in." />
    </Screen>
  );
}
