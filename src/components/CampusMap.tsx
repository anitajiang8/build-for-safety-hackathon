import { DOORS, MAP_H, MAP_W, MOTION_SENSORS, ZONES } from '../data/scenarios';
import type { Scenario, TrackState } from '../data/types';
import type { PairScore } from '../engine/followScore';
import { activeSensors } from '../engine/followScore';
import './CampusMap.css';

const TRAIL_LEN = 14;

interface Props {
  scenario: Scenario;
  tick: number;
  featured: PairScore | null;
}

/** Positions this track occupied over the last TRAIL_LEN ticks, newest first. */
function trailFor(scenario: Scenario, tick: number, token: string) {
  const pts: Array<{ x: number; y: number }> = [];
  for (let t = tick; t > tick - TRAIL_LEN && t >= 0; t--) {
    const s = scenario.ticks[t]?.tracks.find((tr) => tr.token === token);
    if (s) pts.push({ x: s.x, y: s.y });
  }
  return pts;
}

export function CampusMap({ scenario, tick, featured }: Props) {
  const current = scenario.ticks[Math.min(tick, scenario.ticks.length - 1)];
  const tracks = current.tracks;
  const lit = activeSensors(current);

  const elevated = featured && featured.tier !== 'Normal' ? featured : null;
  const leader = elevated ? tracks.find((t) => t.token === elevated.leader) : undefined;
  const follower = elevated ? tracks.find((t) => t.token === elevated.follower) : undefined;

  const roleOf = (t: TrackState) => {
    if (!elevated) return 'plain';
    if (t.token === elevated.follower) return elevated.tier === 'Respond' ? 'respond' : 'watch';
    if (t.token === elevated.leader) return 'leader';
    return 'plain';
  };

  return (
    <div className="map">
      <svg
        className="map__svg"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Campus map with anonymous tracks"
      >
        {/* Zones */}
        {ZONES.map((z) => (
          <g key={z.id}>
            <rect
              className={`map__zone${z.lowTraffic ? ' is-low-traffic' : ''}`}
              x={z.x}
              y={z.y}
              width={z.w}
              height={z.h}
              rx={1.2}
            />
            <text className="map__zone-label" x={z.x + 1.2} y={z.y + 3}>
              {z.name}
            </text>
          </g>
        ))}

        {/* Motion sensors */}
        {MOTION_SENSORS.map((s) => (
          <g key={s.id}>
            <circle
              className={`map__sensor${lit.includes(s.id) ? ' is-active' : ''}`}
              cx={s.x}
              cy={s.y}
              r={1.1}
            />
            <text className="map__marker-label" x={s.x + 1.8} y={s.y + 0.6}>
              motion
            </text>
          </g>
        ))}

        {/* Access-control doors */}
        {DOORS.map((d) => (
          <g key={d.id}>
            <rect className="map__door" x={d.x - 1} y={d.y - 1} width={2} height={2} rx={0.4} />
            <text className="map__marker-label" x={d.x + 2} y={d.y + 0.6}>
              door
            </text>
          </g>
        ))}

        {/* Link between an elevated pair */}
        {elevated && leader && follower && (
          <line
            className={`map__link is-${elevated.tier.toLowerCase()}`}
            x1={leader.x}
            y1={leader.y}
            x2={follower.x}
            y2={follower.y}
          />
        )}

        {/* Fading trails */}
        {tracks.map((t) => {
          const pts = trailFor(scenario, tick, t.token);
          return pts.slice(1).map((p, i) => (
            <line
              key={`${t.token}-trail-${i}`}
              className={`map__trail is-${roleOf(t)}`}
              x1={pts[i].x}
              y1={pts[i].y}
              x2={p.x}
              y2={p.y}
              opacity={1 - i / TRAIL_LEN}
            />
          ));
        })}

        {/* Tracks */}
        {tracks.map((t) => {
          const role = roleOf(t);
          return (
            <g key={t.token}>
              {role === 'respond' && <circle className="map__pulse" cx={t.x} cy={t.y} r={1.6} />}
              <circle className={`map__dot is-${role}`} cx={t.x} cy={t.y} r={1.3} />
              <text className={`map__token is-${role}`} x={t.x + 2} y={t.y - 1.4}>
                {t.token}
              </text>
              {t.phoneRaised && (
                <text className="map__phone" x={t.x - 3.4} y={t.y - 1.4}>
                  {'■'}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="map__legend">
        <span className="map__legend-item">
          <i className="map__swatch is-leader" /> walker
        </span>
        <span className="map__legend-item">
          <i className="map__swatch is-watch" /> watch
        </span>
        <span className="map__legend-item">
          <i className="map__swatch is-respond" /> respond
        </span>
        <span className="map__legend-item">
          <i className="map__swatch is-plain" /> other track
        </span>
        <span className="map__legend-note">
          Anonymous tokens only &mdash; no faces, no names. Tokens rotate every 30 min.
        </span>
      </div>
    </div>
  );
}
