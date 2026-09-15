import type { PairScore } from '../engine/followScore';
import { zoneName } from '../data/scenarios';
import './ScorePanel.css';

interface Props {
  pair: PairScore | null;
}

/** Follow Score for the pair the operator should be looking at, with the
 *  full signal breakdown so the "why" is always on screen. */
export function ScorePanel({ pair }: Props) {
  if (!pair) {
    return <p className="score__empty">Waiting for tracks&hellip;</p>;
  }

  const tierClass = `is-${pair.tier.toLowerCase()}`;
  const isCompanion = pair.reason === 'companions';

  return (
    <div className="score">
      <div className="score__pair">
        <span className="score__token">{pair.follower}</span>
        <span className="score__arrow">follows</span>
        <span className="score__token">{pair.leader}</span>
        <span className={`score__tier ${tierClass}`}>{pair.tier}</span>
      </div>

      <div className="score__gauge">
        <div className="score__value">{pair.score}</div>
        <div className="score__bar">
          <div className={`score__fill ${tierClass}`} style={{ width: `${pair.score}%` }} />
          <span className="score__threshold" style={{ left: '40%' }} title="Watch at 40" />
          <span className="score__threshold" style={{ left: '70%' }} title="Respond at 70" />
        </div>
        <div className="score__scale">
          <span>0 Normal</span>
          <span>40 Watch</span>
          <span>70 Respond</span>
        </div>
      </div>

      {isCompanion ? (
        <p className="score__companion">
          <strong>Excluded: companions.</strong> These two have stayed within 3 units of each
          other for most of the window, so the pair is suppressed before any signal is weighed.
        </p>
      ) : (
        <p className="score__reason">{pair.reason}</p>
      )}

      <ul className="score__rows">
        {pair.breakdown.map((row) => (
          <li className="score__row" key={row.label}>
            <div className="score__row-head">
              <span className="score__row-label">{row.label}</span>
              <span className="score__row-points">
                {row.max > 0 ? `${row.points.toFixed(1)} / ${row.max}` : signed(row.points)}
              </span>
            </div>
            {row.max > 0 && (
              <div className="score__row-bar">
                <div
                  className="score__row-fill"
                  style={{ width: `${(row.points / row.max) * 100}%` }}
                />
              </div>
            )}
            <div className="score__row-detail">{row.detail}</div>
          </li>
        ))}
      </ul>

      {pair.sharedZones.length > 0 && (
        <div className="score__zones">
          <span className="score__zones-label">Shared path</span>
          <div className="score__zones-list">
            {pair.sharedZones.map((z, i) => (
              <span key={`${z}-${i}`} className="score__zone-chip">
                {zoneName(z)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function signed(n: number): string {
  if (Math.abs(n) < 0.05) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
}
