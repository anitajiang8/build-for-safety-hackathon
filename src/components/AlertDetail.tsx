import './AlertDetail.css';

type Strength = 'HIGH' | 'MED' | 'LOW';

interface Signal {
  label: string;
  strength: Strength;
  /** The engine function this maps to, shown as a hint under the label. */
  engine: string;
}

/**
 * The four signals as triaged for this incident. They carry the same names as
 * the scoring engine's terms, so the detail view and the live Follow Score
 * breakdown read as one system.
 */
const SIGNALS: Signal[] = [
  { label: 'Cross-zone continuity', strength: 'HIGH', engine: 'zoneContinuity' },
  { label: 'Direction matching', strength: 'HIGH', engine: 'mirroring' },
  { label: 'Persistent proximity', strength: 'MED', engine: 'gapStability' },
  { label: 'Phone/pose cue', strength: 'LOW', engine: 'phoneRaised' },
];

interface Props {
  onBack: () => void;
  onOpenDashboard: () => void;
  /** Held by App so the dispatch survives navigating away and back. */
  dispatched: boolean;
  onDispatch: () => void;
}

/** Track positions in the mini map, drawn in a 0..120 square. */
function MiniMap() {
  return (
    <svg className="detail__map" viewBox="0 0 120 124" role="img" aria-label="Two tracks crossing a zone boundary">
      <defs>
        <marker id="detail-arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="currentColor" />
        </marker>
      </defs>

      {/* Following track, behind */}
      <g className="detail__track is-follower">
        <circle cx="46" cy="26" r="4" />
        <text className="detail__track-label" x="56" y="30">
          B
        </text>
        <line x1="46" y1="34" x2="46" y2="48" markerEnd="url(#detail-arrow)" />
      </g>

      {/* Zone boundary */}
      <line className="detail__boundary" x1="18" y1="62" x2="102" y2="62" />
      <text className="detail__boundary-label" x="102" y="58" textAnchor="end">
        zone boundary
      </text>

      {/* Walker, ahead */}
      <g className="detail__track is-walker">
        <circle cx="54" cy="76" r="4" />
        <text className="detail__track-label" x="64" y="80">
          A
        </text>
        <line x1="54" y1="84" x2="54" y2="98" markerEnd="url(#detail-arrow)" />
      </g>

      {/* Camera marker */}
      <g className="detail__camera-marker">
        <text x="20" y="116">[</text>
        <path
          transform="translate(28 106) scale(0.6)"
          d="M6 0C2.7 0 0 2.7 0 6c0 4.2 5.4 9.6 5.6 9.8a.6.6 0 0 0 .8 0C6.6 15.6 12 10.2 12 6c0-3.3-2.7-6-6-6Zm0 8.4A2.4 2.4 0 1 1 6 3.6a2.4 2.4 0 0 1 0 4.8Z"
        />
        <text x="40" y="116">Camera 18]</text>
      </g>
    </svg>
  );
}

export function AlertDetail({ onBack, onOpenDashboard, dispatched, onDispatch }: Props) {
  return (
    <div className="detail">
      <div className="detail__frame">
        <header className="detail__bar">
          <button className="detail__back" onClick={onBack}>
            &larr; Safety Alerts
          </button>
          <span className="detail__bar-title">Following pattern</span>
          <span className="detail__status">
            <i className="detail__status-dot" aria-hidden="true" />
            Elevated
          </span>
        </header>

        <div className="detail__lead">
          <h1 className="detail__headline">Following pattern detected</h1>
          <p className="detail__sub">SLC &rarr; Davis Centre &middot; 8:42&ndash;8:51 PM</p>
        </div>

        <div className="detail__grid">
          <section className="detail__box">
            <h2 className="detail__box-title">Campus map</h2>
            <MiniMap />
          </section>

          <section className="detail__box">
            <h2 className="detail__box-title">Signal breakdown</h2>
            <ul className="detail__signals">
              {SIGNALS.map((s) => (
                <li className="detail__signal" key={s.label}>
                  <i className="detail__bullet" aria-hidden="true" />
                  <div className="detail__signal-text">
                    <span className="detail__signal-label">{s.label}</span>
                    <span className="detail__signal-engine">{s.engine}</span>
                  </div>
                  <span className={`detail__strength is-${s.strength.toLowerCase()}`}>
                    {s.strength}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="detail__section">
          <h2 className="detail__section-title">Sensor evidence</h2>
          <div className="detail__evidence">
            <div className="detail__evidence-main">
              <div className="detail__evidence-head">Camera 18 &middot; 8:47 PM</div>
              <div className="detail__evidence-line">2 anonymous tracks detected</div>
              <div className="detail__frame-strip" aria-hidden="true">
                <svg className="detail__silhouette" viewBox="0 0 100 26">
                  <rect className="detail__sil-bg" x="0" y="0" width="100" height="26" />
                  <circle className="detail__sil-near" cx="38" cy="12" r="5" />
                  <path className="detail__sil-near" d="M28 26 q0 -11 10 -11 q10 0 10 11 z" />
                  <circle className="detail__sil-far" cx="64" cy="13" r="4" />
                  <path className="detail__sil-far" d="M55 26 q0 -9 9 -9 q9 0 9 9 z" />
                </svg>
                <span className="detail__frame-label">[ blurred camera frame ]</span>
              </div>
            </div>
            <button className="detail__view" onClick={onOpenDashboard}>
              View &rarr;
            </button>
          </div>
        </section>

        <section className="detail__section">
          <h2 className="detail__section-title">Next action</h2>
          <div className="detail__next">
            <div className="detail__location">
              Current location: <strong>Davis Centre West Entrance</strong>
            </div>
            <div className="detail__actions">
              <button
                className={`detail__action${dispatched ? ' is-done' : ''}`}
                disabled={dispatched}
                onClick={onDispatch}
              >
                [ {dispatched ? '✓ Patrol dispatched' : 'Dispatch nearest patrol'} ]
              </button>
              <button className="detail__action" onClick={onOpenDashboard}>
                [ Continue monitoring ]
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
