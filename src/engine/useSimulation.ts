/**
 * Drives a scenario tick by tick and derives everything the UI renders:
 * pair scores, alerts, the audit log and the walker's phone notification.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SCENARIOS, clockAt, zoneAt, zoneName } from '../data/scenarios';
import type { Scenario } from '../data/types';
import { featuredPair, scoreAllPairs } from './followScore';
import type { PairScore, Tier } from './followScore';

export const TICK_MS = 250;
export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

/** Operator actions offered on a Respond alert. */
export const RESPOND_ACTIONS = [
  'Dispatch nearest patrol',
  'Increase lighting in zone',
  'Notify walker (opt-in)',
] as const;
export type RespondAction = (typeof RESPOND_ACTIONS)[number];

export interface Alert {
  id: string;
  pairId: string;
  tier: Exclude<Tier, 'Normal'>;
  leader: string;
  follower: string;
  zone: string;
  clock: string;
  tick: number;
  score: number;
  summary: string;
  /** Actions the operator has already taken on this alert. */
  done: RespondAction[];
}

export interface AuditEntry {
  id: string;
  clock: string;
  kind: 'action' | 'break-glass' | 'system';
  text: string;
  reason?: string;
  token?: string;
}

export interface PhoneNotification {
  title: string;
  body: string;
}

let seq = 0;
const nextId = () => `e${++seq}`;

export function useSimulation() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [phone, setPhone] = useState<PhoneNotification | null>(null);

  const scenario: Scenario = useMemo(
    () => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0],
    [scenarioId],
  );

  const lastTick = scenario.ticks.length - 1;
  const clock = clockAt(scenario.startClock, tick);
  const hour = Number(scenario.startClock.split(':')[0]);

  /* --- playback ------------------------------------------------------ */

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTick((t) => {
        if (t >= lastTick) return t;
        return t + 1;
      });
    }, TICK_MS / speed);
    return () => clearInterval(id);
  }, [playing, speed, lastTick]);

  // Stop automatically at the end of the scenario.
  useEffect(() => {
    if (tick >= lastTick) setPlaying(false);
  }, [tick, lastTick]);

  /* --- scoring ------------------------------------------------------- */

  const pairs = useMemo(
    () => scoreAllPairs(scenario.ticks, tick, { hour }),
    [scenario, tick, hour],
  );
  const featured = useMemo(() => featuredPair(pairs), [pairs]);
  const currentTick = scenario.ticks[Math.min(tick, lastTick)];

  /* --- alert emission ------------------------------------------------ */

  // One alert per pair per tier. The check lives inside the state updater so a
  // double-invoked effect (React StrictMode) can never duplicate a card.
  useEffect(() => {
    const elevated = pairs.filter((p) => p.tier !== 'Normal');
    if (elevated.length === 0) return;

    setAlerts((prev) => {
      const next = [...prev];
      let added = false;
      for (const p of elevated) {
        const key = `${p.id}|${p.tier}`;
        if (next.some((a) => `${a.pairId}|${a.tier}` === key)) continue;
        added = true;
        const f = currentTick.tracks.find((t) => t.token === p.follower);
        const zone = f ? zoneName(zoneAt(f.x, f.y)?.id ?? null) : 'Unknown';
        next.unshift({
          id: nextId(),
          pairId: p.id,
          tier: p.tier as Exclude<Tier, 'Normal'>,
          leader: p.leader,
          follower: p.follower,
          zone,
          clock: clockAt(scenario.startClock, tick),
          tick,
          score: p.score,
          summary: `${p.follower} has followed ${p.leader} across ${p.sharedZones.length} zone${
            p.sharedZones.length === 1 ? '' : 's'
          }`,
          done: [],
        });
      }
      // Keep the same array when nothing fired, so React skips the re-render.
      return added ? next : prev;
    });
  }, [pairs, currentTick, scenario.startClock, tick]);

  /* --- operator actions ---------------------------------------------- */

  const log = useCallback(
    (entry: Omit<AuditEntry, 'id' | 'clock'>) => {
      setAudit((prev) => [
        { ...entry, id: nextId(), clock: clockAt(scenario.startClock, tick) },
        ...prev,
      ]);
    },
    [scenario.startClock, tick],
  );

  const takeAction = useCallback(
    (alertId: string, action: RespondAction) => {
      const target = alerts.find((a) => a.id === alertId);
      if (!target || target.done.includes(action)) return;
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, done: [...a.done, action] } : a)),
      );
      log({
        kind: 'action',
        text: `${action} — ${target.zone} (pair ${target.follower}/${target.leader})`,
        token: target.follower,
      });
      if (action === 'Notify walker (opt-in)') {
        setPhone({
          title: 'Campus Safety',
          body: 'Security has been alerted and is nearby. Residence Entrance is 1 minute ahead.',
        });
      }
    },
    [alerts, log],
  );

  const breakGlass = useCallback(
    (reason: string, zone: string, token: string) => {
      log({
        kind: 'break-glass',
        text: `Break-glass footage viewed — ${zone}`,
        reason,
        token,
      });
    },
    [log],
  );

  /* --- transport ------------------------------------------------------ */

  const reset = useCallback(() => {
    setPlaying(false);
    setTick(0);
    setAlerts([]);
    setAudit([]);
    setPhone(null);
  }, []);

  const selectScenario = useCallback(
    (id: string) => {
      setScenarioId(id);
      setPlaying(false);
      setTick(0);
      setAlerts([]);
      setAudit([]);
      setPhone(null);
    },
    [],
  );

  return {
    scenario,
    scenarios: SCENARIOS,
    tick,
    lastTick,
    clock,
    playing,
    speed,
    currentTick,
    pairs,
    featured: featured as PairScore | null,
    alerts,
    audit,
    phone,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    reset,
    setSpeed,
    selectScenario,
    takeAction,
    breakGlass,
    dismissPhone: () => setPhone(null),
  };
}
