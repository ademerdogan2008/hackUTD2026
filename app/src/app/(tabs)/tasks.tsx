import { ConnectionBadge } from '../../components/ConnectionBadge';
import { EmptyState, Screen } from '../../ui';

export default function TasksTab() {
  return (
    <Screen title="Tasks" headerRight={<ConnectionBadge />}>
      <EmptyState title="Tasks" body="Placeholder. Screen agent fills this in." />
    </Screen>
  );
}
