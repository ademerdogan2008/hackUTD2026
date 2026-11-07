import { ConnectionBadge } from '../../components/ConnectionBadge';
import { EmptyState, Screen } from '../../ui';

export default function HomeTab() {
  return (
    <Screen title="Home" headerRight={<ConnectionBadge />}>
      <EmptyState title="Home" body="Placeholder. Screen agent fills this in." />
    </Screen>
  );
}
