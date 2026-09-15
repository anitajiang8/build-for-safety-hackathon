import type { AuditEntry } from '../engine/useSimulation';
import './AuditLog.css';

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="audit__empty">Nothing logged yet. Every operator action lands here.</p>;
  }

  return (
    <ol className="audit">
      {entries.map((e) => (
        <li key={e.id} className={`audit__row is-${e.kind}`}>
          <span className="audit__clock">{e.clock}</span>
          <div className="audit__body">
            <div className="audit__text">{e.text}</div>
            {e.reason && <div className="audit__reason">Reason: &ldquo;{e.reason}&rdquo;</div>}
            {e.token && <span className="audit__token">{e.token}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
