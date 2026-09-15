import type { Scenario } from '../data/types';
import { SPEEDS } from '../engine/useSimulation';
import type { Speed } from '../engine/useSimulation';
import './TopBar.css';

interface Props {
  scenario: Scenario;
  scenarios: Scenario[];
  onSelectScenario: (id: string) => void;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  clock: string;
  tick: number;
  lastTick: number;
}

export function TopBar({
  scenario,
  scenarios,
  onSelectScenario,
  playing,
  onPlay,
  onPause,
  onReset,
  speed,
  onSpeed,
  clock,
  tick,
  lastTick,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__mark" aria-hidden="true" />
        <div>
          <div className="topbar__name">Trailguard</div>
          <div className="topbar__tagline">Privacy-first campus safety</div>
        </div>
      </div>

      <label className="topbar__field">
        <span className="topbar__label">Scenario</span>
        <select
          className="topbar__select"
          value={scenario.id}
          onChange={(e) => onSelectScenario(e.target.value)}
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="topbar__controls">
        <button className="topbar__btn" onClick={playing ? onPause : onPlay}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="topbar__btn" onClick={onReset}>
          Reset
        </button>
        <div className="topbar__speeds" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`topbar__speed${s === speed ? ' is-active' : ''}`}
              onClick={() => onSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="topbar__clock">
        <div className="topbar__time">{clock}</div>
        <div className="topbar__tick">
          tick {tick} / {lastTick}
        </div>
      </div>
    </header>
  );
}
