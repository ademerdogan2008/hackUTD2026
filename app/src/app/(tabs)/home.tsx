import { useState } from 'react';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { GlobalAlarm } from '../../features/incident/GlobalAlarm';
import { IdleView } from '../../features/incident/IdleView';
import { LiveView } from '../../features/incident/LiveView';
import { PossibleView } from '../../features/incident/PossibleView';
import { useCurrentIncident, useMe } from '../../state/hooks';
import { Banner, haptics, Screen } from '../../ui';

export default function HomeTab() {
  const { me, ready: meReady } = useMe();
  const { incident } = useCurrentIncident();
  const [error, setError] = useState<string | null>(null);

  const run = async (p: Promise<unknown>) => {
    setError(null);
    try {
      await p;
    } catch (e) {
      haptics.error();
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const myRole = me?.role;
  const myHex = me?.identity.toHexString();
  // Calm states are a single fixed screen with the action pinned low; live incidents scroll.
  const fixed = !incident || incident.status === 'possible';

  return (
    <Screen
      title="Red Phone"
      headerRight={<ConnectionBadge />}
      scroll={!fixed}
      banner={error ? <Banner variant="danger" text={error} actionLabel="Dismiss" onAction={() => setError(null)} /> : undefined}
    >
      <GlobalAlarm />
      {!meReady ? null : !incident ? (
        <IdleView run={run} />
      ) : incident.status === 'possible' ? (
        <PossibleView run={run} incident={incident} myRole={myRole} myHex={myHex} />
      ) : (
        <LiveView run={run} incident={incident} myRole={myRole} myHex={myHex} />
      )}
    </Screen>
  );
}
