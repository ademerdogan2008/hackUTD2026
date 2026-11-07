import { ConnectionBadge } from '../../components/ConnectionBadge';
import { EmptyState, Screen } from '../../ui';

export default function ChatTab() {
  return (
    <Screen title="Chat" headerRight={<ConnectionBadge />}>
      <EmptyState title="Chat" body="Placeholder. Screen agent fills this in." />
    </Screen>
  );
}
