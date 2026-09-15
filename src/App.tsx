import { useState } from 'react';
import { zoneAt, zoneName } from './data/scenarios';
import { useSimulation } from './engine/useSimulation';
import { AlertFeed } from './components/AlertFeed';
import { AuditLog } from './components/AuditLog';
import { CameraTile } from './components/CameraTile';
import { CampusMap } from './components/CampusMap';
import { PhoneMock } from './components/PhoneMock';
import { ScorePanel } from './components/ScorePanel';
import { TopBar } from './components/TopBar';
import { WhatsStored } from './components/WhatsStored';
import './App.css';

export default function App() {
  const sim = useSimulation();
  const [showStored, setShowStored] = useState(false);

  // The camera tile watches wherever the pair of interest currently is.
  const watched = sim.featured?.follower ?? sim.currentTick.tracks[0]?.token ?? 'T-?';
  const watchedTrack = sim.currentTick.tracks.find((t) => t.token === watched);
  const watchedZone = watchedTrack
    ? zoneName(zoneAt(watchedTrack.x, watchedTrack.y)?.id ?? null)
    : 'Campus';

  return (
    <div className="app">
      <TopBar
        scenario={sim.scenario}
        scenarios={sim.scenarios}
        onSelectScenario={sim.selectScenario}
        playing={sim.playing}
        onPlay={sim.play}
        onPause={sim.pause}
        onReset={sim.reset}
        speed={sim.speed}
        onSpeed={sim.setSpeed}
        clock={sim.clock}
        tick={sim.tick}
        lastTick={sim.lastTick}
      />

      <main className="app__main">
        <section className="app__col app__col--map">
          <div className="panel app__panel--grow">
            <div className="panel__head">
              <h2 className="panel__title">Campus map</h2>
              <span className="app__blurb">{sim.scenario.blurb}</span>
            </div>
            <div className="panel__body app__map-body">
              <CampusMap scenario={sim.scenario} tick={sim.tick} featured={sim.featured} />
            </div>
          </div>

          <div className="app__row">
            <div className="panel app__panel--audit">
              <div className="panel__head">
                <h2 className="panel__title">Audit log</h2>
                <span className="app__count">{sim.audit.length}</span>
              </div>
              <div className="panel__body">
                <AuditLog entries={sim.audit} />
              </div>
            </div>

            <div className="panel app__panel--phone">
              <div className="panel__head">
                <h2 className="panel__title">Walk Mode</h2>
              </div>
              <div className="panel__body">
                <PhoneMock notification={sim.phone} clock={sim.clock} />
              </div>
            </div>
          </div>
        </section>

        <section className="app__col app__col--score">
          <div className="panel app__panel--grow">
            <div className="panel__head">
              <h2 className="panel__title">{showStored ? "What's stored" : 'Follow Score'}</h2>
              <button className="app__toggle" onClick={() => setShowStored((v) => !v)}>
                {showStored ? 'Show score' : "What's stored"}
              </button>
            </div>
            <div className="panel__body">
              {showStored ? <WhatsStored /> : <ScorePanel pair={sim.featured} />}
            </div>
          </div>
        </section>

        <section className="app__col app__col--right">
          <div className="panel app__panel--alerts">
            <div className="panel__head">
              <h2 className="panel__title">Alerts</h2>
              <span className="app__count">{sim.alerts.length}</span>
            </div>
            <div className="panel__body">
              <AlertFeed alerts={sim.alerts} onAction={sim.takeAction} />
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Camera &middot; {watchedZone}</h2>
            </div>
            <div className="panel__body">
              {/* Keyed by run so a break-glass unblur never survives a reset. */}
              <CameraTile
                key={sim.runId}
                zone={watchedZone}
                token={watched}
                onBreakGlass={sim.breakGlass}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
