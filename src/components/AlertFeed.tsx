import { RESPOND_ACTIONS } from '../engine/useSimulation';
import type { Alert, RespondAction } from '../engine/useSimulation';
import './AlertFeed.css';

interface Props {
  alerts: Alert[];
  onAction: (alertId: string, action: RespondAction) => void;
}

export function AlertFeed({ alerts, onAction }: Props) {
  if (alerts.length === 0) {
    return <p className="alerts__empty">No alerts. All pairs scoring Normal.</p>;
  }

  return (
    <ul className="alerts">
      {alerts.map((a) => (
        <li key={a.id} className={`alerts__card is-${a.tier.toLowerCase()}`}>
          <div className="alerts__head">
            <span className={`alerts__tier is-${a.tier.toLowerCase()}`}>{a.tier}</span>
            <span className="alerts__score">{a.score}</span>
            <span className="alerts__clock">{a.clock}</span>
          </div>
          <div className="alerts__summary">{a.summary}</div>
          <div className="alerts__meta">{a.zone}</div>

          {a.tier === 'Respond' && (
            <div className="alerts__actions">
              {RESPOND_ACTIONS.map((action) => {
                const done = a.done.includes(action);
                return (
                  <button
                    key={action}
                    className={`alerts__action${done ? ' is-done' : ''}`}
                    disabled={done}
                    onClick={() => onAction(a.id, action)}
                  >
                    {done ? `✓ ${action}` : action}
                  </button>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
