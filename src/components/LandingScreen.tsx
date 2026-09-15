import { useState } from 'react';
import './LandingScreen.css';

type Severity = 'high' | 'watch' | 'ok';
type Filter = 'ALL' | 'HIGH PRIORITY' | 'MONITORING';

interface LandingAlert {
  severity: Severity;
  title: string;
  time: string;
  /** Tier word shown above the description on the primary alert. */
  status?: string;
  description: string;
  location: string;
  window?: string;
  signals?: string;
  cta?: string;
}

/** The alerts on the opening board, exactly as designed. */
const ALERTS: LandingAlert[] = [
  {
    severity: 'high',
    title: 'Following pattern',
    time: '8:51 PM',
    status: 'Elevated',
    description: 'Persistent following detected across 3 zones',
    location: 'SLC → Davis Centre',
    window: '8:42 PM — 8:51 PM',
    signals: '4 corroborating signals',
    cta: 'View alert',
  },
  {
    severity: 'watch',
    title: 'After-hours motion',
    time: '8:47 PM',
    description: 'Unusual movement detected',
    location: 'Engineering 5',
  },
  {
    severity: 'ok',
    title: 'Door left open',
    time: '8:39 PM',
    description: 'No access credential detected',
    location: 'MC Building',
  },
];

const FILTERS: Filter[] = ['ALL', 'HIGH PRIORITY', 'MONITORING'];

/** High priority is the red tier; everything else is being monitored. */
function matches(alert: LandingAlert, filter: Filter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'HIGH PRIORITY') return alert.severity === 'high';
  return alert.severity !== 'high';
}

function Pin() {
  return (
    <svg className="landing__pin" viewBox="0 0 12 16" aria-hidden="true">
      <path
        d="M6 0C2.7 0 0 2.7 0 6c0 4.2 5.4 9.6 5.6 9.8a.6.6 0 0 0 .8 0C6.6 15.6 12 10.2 12 6c0-3.3-2.7-6-6-6Zm0 8.4A2.4 2.4 0 1 1 6 3.6a2.4 2.4 0 0 1 0 4.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LandingScreen({ onEnter }: { onEnter: () => void }) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const visible = ALERTS.filter((a) => matches(a, filter));

  return (
    <div className="landing">
      <div className="landing__frame">
        <header className="landing__bar">
          <span className="landing__brand">Trailguard</span>
          <span className="landing__live">
            <i className="landing__live-dot" aria-hidden="true" />
            Live
          </span>
          <span className="landing__stamp">Sep 15, 8:51 PM</span>
        </header>

        <div className="landing__section">
          <h1 className="landing__heading">Safety alerts</h1>
          <span className="landing__count">{ALERTS.length} active</span>
        </div>

        <nav className="landing__filters" aria-label="Filter alerts">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`landing__filter${f === filter ? ' is-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              [{f}]
            </button>
          ))}
        </nav>

        <ul className="landing__list">
          {visible.map((a) => (
            <li key={a.title}>
              {a.cta ? (
                <button className={`landing__card is-${a.severity} is-primary`} onClick={onEnter}>
                  <AlertBody alert={a} />
                </button>
              ) : (
                <div className={`landing__card is-${a.severity}`}>
                  <AlertBody alert={a} />
                </div>
              )}
            </li>
          ))}
        </ul>

        {visible.length === 0 && <p className="landing__empty">No alerts in this view.</p>}
      </div>
    </div>
  );
}

function AlertBody({ alert }: { alert: LandingAlert }) {
  return (
    <>
      <div className="landing__card-head">
        <i className={`landing__dot is-${alert.severity}`} aria-hidden="true" />
        <span className="landing__card-title">{alert.title}</span>
        <span className="landing__card-time">{alert.time}</span>
      </div>

      <div className="landing__card-body">
        {alert.status && <div className="landing__status">{alert.status}</div>}
        <p className="landing__desc">{alert.description}</p>

        <div className="landing__where">
          <Pin />
          <span>{alert.location}</span>
        </div>
        {alert.window && <div className="landing__window">{alert.window}</div>}

        {(alert.signals || alert.cta) && (
          <div className="landing__card-foot">
            <span className="landing__signals">{alert.signals}</span>
            {alert.cta && <span className="landing__cta">{alert.cta} &rarr;</span>}
          </div>
        )}
      </div>
    </>
  );
}
