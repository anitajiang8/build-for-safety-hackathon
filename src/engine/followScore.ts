/**
 * Follow Score -- fuses anonymous track signals into a 0..100 risk score for a
 * *pair* of tracks. Pure functions only: no React, no I/O, no identity data.
 *
 * The design goal is explainability. Every point in the final score comes from
 * one named signal, so an operator can always answer "why did this fire?".
 */
import { MOTION_SENSORS, ZONES, zoneAt } from '../data/scenarios';
import type { SensorEvent, Tick, TrackState } from '../data/types';

/** Rolling window, in ticks (= seconds), for the movement signals. */
export const WINDOW = 30;
/** Below this many ticks of shared history we refuse to score at all. */
const MIN_HISTORY = 12;

export const WEIGHTS = {
  zoneContinuity: 30,
  gapStability: 20,
  mirroring: 20,
  phoneRaised: 10,
  tailgate: 15,
} as const;

export type Tier = 'Normal' | 'Watch' | 'Respond';

export interface SignalRow {
  signal: keyof typeof WEIGHTS | 'context';
  label: string;
  /** Human-readable measurement, e.g. "4 zones in order". */
  detail: string;
  points: number;
  max: number;
}

export interface PairScore {
  /** Stable id for the pair, order-independent. */
  id: string;
  leader: string;
  follower: string;
  score: number;
  tier: Tier;
  breakdown: SignalRow[];
  reason: string;
  /** Zones both tracks passed through, in order. Drives the alert summary. */
  sharedZones: string[];
  /** Current separation in map units. */
  gap: number;
}

/* ------------------------------------------------------------------ */
/* Small maths helpers                                                 */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Signed difference between two headings, normalised to (-180, 180]. */
function angleDelta(a: number, b: number): number {
  let d = ((a - b + 180) % 360) - 180;
  if (d <= -180) d += 360;
  return d;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/* ------------------------------------------------------------------ */
/* History extraction                                                  */
/* ------------------------------------------------------------------ */

/** Everything the engine knows about one track, up to and including `now`. */
export interface TrackHistory {
  token: string;
  states: TrackState[];
  /** Compressed zone sequence, e.g. ["slc", "quad", "ring"]. */
  zoneSeq: string[];
  /** Tick on which each zone in `zoneSeq` was first entered. */
  zoneEntry: number[];
}

export function buildHistory(ticks: Tick[], now: number, token: string): TrackHistory {
  const states: TrackState[] = [];
  const zoneSeq: string[] = [];
  const zoneEntry: number[] = [];
  for (let t = 0; t <= now && t < ticks.length; t++) {
    const s = ticks[t].tracks.find((tr) => tr.token === token);
    if (!s) continue;
    states.push(s);
    const z = zoneAt(s.x, s.y);
    // Collapse runs: only record a zone when the track *enters* it.
    if (z && zoneSeq[zoneSeq.length - 1] !== z.id) {
      zoneSeq.push(z.id);
      zoneEntry.push(t);
    }
  }
  return { token, states, zoneSeq, zoneEntry };
}

/** All sensor events from tick 0 through `now`, tagged with their tick. */
function eventsUpTo(ticks: Tick[], now: number): Array<{ t: number; e: SensorEvent }> {
  const out: Array<{ t: number; e: SensorEvent }> = [];
  for (let t = 0; t <= now && t < ticks.length; t++) {
    for (const e of ticks[t].events) out.push({ t, e });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Signal 1 -- zone continuity                                         */
/* ------------------------------------------------------------------ */

/**
 * Longest run of zones both tracks passed through in the same order.
 *
 * This one signal deliberately looks at the whole session rather than the
 * 30-tick window: crossing a zone takes ~20 ticks, so a windowed view could
 * never see more than two, and "followed me across four zones" is exactly the
 * fact an operator needs. The movement signals below stay windowed.
 */
export function zoneContinuity(a: string[], b: string[]): string[] {
  let best: string[] = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best.length) best = a.slice(i, i + k);
    }
  }
  return best;
}

/** 1 zone in common is meaningless, 4+ is a strong trail. */
function zoneContinuityValue(n: number): number {
  return clamp((n - 1) / 3, 0, 1);
}

/* ------------------------------------------------------------------ */
/* Signal 2 -- gap stability                                           */
/* ------------------------------------------------------------------ */

/**
 * A follower holds station: not so close that they are walking together, not
 * so far that the correlation is coincidence, and -- the tell -- at a gap that
 * barely varies, because they are actively matching pace.
 */
export function gapStability(distances: number[]): { value: number; meanGap: number; sd: number } {
  const meanGap = mean(distances);
  const sd = stdDev(distances);
  if (distances.length < MIN_HISTORY) return { value: 0, meanGap, sd };
  // Outside the 5..20 unit band this is either a companion or an unrelated track.
  if (meanGap < 5 || meanGap > 20) return { value: 0, meanGap, sd };
  return { value: clamp(1 - sd / 5, 0, 1), meanGap, sd };
}

/* ------------------------------------------------------------------ */
/* Signal 3 -- mirroring                                               */
/* ------------------------------------------------------------------ */

const MOVING = 0.15; // speed above which a track counts as moving
const TURN = 25; // degrees in one tick that counts as the leader turning
const RESPONSE_TURN = 8; // degrees the follower must swing to count as answering
const RESPONSE_TICKS = 2;
const RECENT_MANOEUVRES = 6; // how many of the leader's last manoeuvres we judge

/**
 * Does the second track answer the first one's manoeuvres?
 *
 * We take every point where the leader starts, stops or turns, then ask whether
 * the other track did the same thing within two ticks. Turns must be in the
 * same rotational direction, which is what separates a real tail from a track
 * that happens to jitter at the right moment.
 */
export function mirroring(
  lead: TrackState[],
  follow: TrackState[],
): { value: number; hits: number; total: number } {
  // Manoeuvres are sparse -- a walker may not turn or stop for 30 seconds. So
  // rather than hard-windowing (which would read "0/0" and wrongly score zero
  // on a straight stretch) we judge the most recent RECENT_MANOEUVRES of them.
  const answered: boolean[] = [];
  const n = Math.min(lead.length, follow.length);

  for (let k = 1; k < n; k++) {
    const startedOrStopped =
      lead[k - 1].speed > MOVING !== lead[k].speed > MOVING;
    const turn = angleDelta(lead[k].heading, lead[k - 1].heading);

    if (startedOrStopped) {
      const nowMoving = lead[k].speed > MOVING;
      // Did the follower cross the same threshold in the same direction?
      let hit = false;
      for (let d = 0; d <= RESPONSE_TICKS && k + d < n; d++) {
        if (follow[k + d].speed > MOVING === nowMoving && follow[k + d - 1].speed > MOVING !== nowMoving) {
          hit = true;
          break;
        }
      }
      answered.push(hit);
    }

    if (Math.abs(turn) > TURN) {
      const end = Math.min(n - 1, k + RESPONSE_TICKS);
      const swing = angleDelta(follow[end].heading, follow[k - 1].heading);
      answered.push(Math.abs(swing) >= RESPONSE_TURN && Math.sign(swing) === Math.sign(turn));
    }
  }

  const recent = answered.slice(-RECENT_MANOEUVRES);
  const hits = recent.filter(Boolean).length;
  const total = recent.length;
  return { value: total === 0 ? 0 : hits / total, hits, total };
}

/* ------------------------------------------------------------------ */
/* Signal 4 -- phone raised toward the leader                          */
/* ------------------------------------------------------------------ */

/**
 * Pose-only signal: an arm raised holding a phone-shaped object, while the
 * track is oriented at the other one. We never see what is on the screen, and
 * no image leaves the camera -- only this boolean.
 */
function phoneRaisedCount(
  events: Array<{ t: number; e: SensorEvent }>,
  follower: string,
  leader: string,
  followerStates: TrackState[],
  leaderStates: TrackState[],
): number {
  // Counted over the whole incident: a phone raised at someone three times in
  // ninety seconds does not stop mattering because it happened 31 ticks ago.
  let count = 0;
  for (const { t, e } of events) {
    if (e.type !== 'phone_raised') continue;
    if (e.token !== follower || e.towardToken !== leader) continue;
    // Confirm the pose was actually oriented at the other track.
    const f = followerStates[t];
    const l = leaderStates[t];
    if (!f || !l) continue;
    const bearing = (Math.atan2(l.y - f.y, l.x - f.x) * 180) / Math.PI;
    if (Math.abs(angleDelta(bearing, f.heading)) <= 45) count++;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* Signal 5 -- tailgate                                                */
/* ------------------------------------------------------------------ */

const TAILGATE_WINDOW = 20; // ticks after the leader's badge

/** Door opened behind the leader's badge with no second credential presented. */
export function tailgate(
  events: Array<{ t: number; e: SensorEvent }>,
  leader: string,
  follower: string,
): { hit: boolean; doorId?: string; t?: number } {
  for (const { t, e } of events) {
    if (e.type !== 'badge' || e.token !== leader) continue;
    for (const { t: t2, e: e2 } of events) {
      if (e2.type !== 'door_open_no_badge') continue;
      if (e2.doorId !== e.doorId || e2.token !== follower) continue;
      if (t2 >= t && t2 - t <= TAILGATE_WINDOW) return { hit: true, doorId: e.doorId, t: t2 };
    }
  }
  return { hit: false };
}

/* ------------------------------------------------------------------ */
/* Context multiplier                                                  */
/* ------------------------------------------------------------------ */

/** Late at night, or in a zone people rarely use, the same behaviour matters more. */
export function contextMultiplier(hour: number, aZone: string | null, bZone: string | null): { m: number; why: string } {
  const late = hour >= 22 || hour < 5;
  const lowTraffic = [aZone, bZone].every(
    (z) => z && ZONES.find((zz) => zz.id === z)?.lowTraffic,
  );
  if (late) return { m: 1.3, why: 'After 10 PM' };
  if (lowTraffic) return { m: 1.3, why: 'Low-traffic zone' };
  return { m: 1.0, why: 'Normal hours' };
}

/* ------------------------------------------------------------------ */
/* Companion exclusion                                                 */
/* ------------------------------------------------------------------ */

const COMPANION_DIST = 3;
const COMPANION_FRACTION = 0.6;

/** People walking together are not a threat -- suppress the pair entirely. */
export function areCompanions(distances: number[]): boolean {
  if (distances.length < MIN_HISTORY) return false;
  const close = distances.filter((d) => d <= COMPANION_DIST).length;
  return close / distances.length >= COMPANION_FRACTION;
}

/* ------------------------------------------------------------------ */
/* Tiers                                                               */
/* ------------------------------------------------------------------ */

export function tierFor(score: number): Tier {
  if (score >= 70) return 'Respond';
  if (score >= 40) return 'Watch';
  return 'Normal';
}

/* ------------------------------------------------------------------ */
/* The scorer                                                          */
/* ------------------------------------------------------------------ */

export interface ScoreContext {
  /** Simulated hour of day, 0..23. */
  hour: number;
}

export function scorePair(
  ticks: Tick[],
  now: number,
  tokenA: string,
  tokenB: string,
  ctx: ScoreContext,
): PairScore {
  const ha = buildHistory(ticks, now, tokenA);
  const hb = buildHistory(ticks, now, tokenB);
  const id = [tokenA, tokenB].sort().join('|');

  const n = Math.min(ha.states.length, hb.states.length);
  const from = Math.max(0, n - WINDOW);
  const aw = ha.states.slice(from);
  const bw = hb.states.slice(from);
  const distances = aw.map((s, i) => Math.hypot(s.x - bw[i].x, s.y - bw[i].y));
  const gap = distances.length ? distances[distances.length - 1] : 0;

  const empty = (reason: string, breakdown: SignalRow[] = []): PairScore => ({
    id,
    leader: tokenA,
    follower: tokenB,
    score: 0,
    tier: 'Normal',
    breakdown,
    reason,
    sharedZones: [],
    gap,
  });

  if (n < MIN_HISTORY) return empty('Not enough history yet');
  if (areCompanions(distances)) {
    // Suppressed before any signal is even weighed, so two friends walking
    // home together can never generate an alert.
    return empty('companions', [
      {
        signal: 'context',
        label: 'Companion exclusion',
        detail: `within ${COMPANION_DIST}u for most of the window — scoring suppressed`,
        points: 0,
        max: 0,
      },
    ]);
  }

  // --- who is following whom? The track that enters the shared zones later. ---
  const shared = zoneContinuity(ha.zoneSeq, hb.zoneSeq);
  let leaderH = ha;
  let followerH = hb;
  if (shared.length > 0) {
    const entry = (h: TrackHistory) => h.zoneEntry[h.zoneSeq.indexOf(shared[0])] ?? 0;
    if (entry(hb) < entry(ha)) {
      leaderH = hb;
      followerH = ha;
    }
  }
  const events = eventsUpTo(ticks, now);

  // --- signals ---
  const zcValue = zoneContinuityValue(shared.length);
  const gs = gapStability(distances);
  const mir = mirroring(leaderH.states, followerH.states);
  const phone = phoneRaisedCount(
    events,
    followerH.token,
    leaderH.token,
    followerH.states,
    leaderH.states,
  );
  const tg = tailgate(events, leaderH.token, followerH.token);

  const lastA = aw[aw.length - 1];
  const lastB = bw[bw.length - 1];
  const zoneA = zoneAt(lastA.x, lastA.y)?.id ?? null;
  const zoneB = zoneAt(lastB.x, lastB.y)?.id ?? null;
  const ctxm = contextMultiplier(ctx.hour, zoneA, zoneB);

  const rows: SignalRow[] = [
    {
      signal: 'zoneContinuity',
      label: 'Zone continuity',
      detail: `${shared.length} zone${shared.length === 1 ? '' : 's'} in the same order`,
      points: WEIGHTS.zoneContinuity * zcValue,
      max: WEIGHTS.zoneContinuity,
    },
    {
      signal: 'gapStability',
      label: 'Gap stability',
      detail:
        gs.value > 0
          ? `holds ${gs.meanGap.toFixed(1)}u, sd ${gs.sd.toFixed(1)}`
          : `mean ${gs.meanGap.toFixed(1)}u (outside 5-20u band)`,
      points: WEIGHTS.gapStability * gs.value,
      max: WEIGHTS.gapStability,
    },
    {
      signal: 'mirroring',
      label: 'Mirrors stops & turns',
      detail: mir.total ? `${mir.hits}/${mir.total} recent manoeuvres matched` : 'no manoeuvres yet',
      points: WEIGHTS.mirroring * mir.value,
      max: WEIGHTS.mirroring,
    },
    {
      signal: 'phoneRaised',
      label: 'Phone raised toward walker',
      detail: `${phone} time${phone === 1 ? '' : 's'} this incident`,
      points: WEIGHTS.phoneRaised * clamp(phone / 3, 0, 1),
      max: WEIGHTS.phoneRaised,
    },
    {
      signal: 'tailgate',
      label: 'Door tailgate',
      detail: tg.hit ? 'entered on the walker’s badge' : 'none',
      points: tg.hit ? WEIGHTS.tailgate : 0,
      max: WEIGHTS.tailgate,
    },
  ];

  const base = rows.reduce((sum, r) => sum + r.points, 0);
  const score = Math.min(100, Math.round(base * ctxm.m));

  rows.push({
    signal: 'context',
    label: 'Context multiplier',
    detail: `${ctxm.why} ×${ctxm.m.toFixed(1)}`,
    points: base * (ctxm.m - 1),
    max: 0,
  });

  return {
    id,
    leader: leaderH.token,
    follower: followerH.token,
    score,
    tier: tierFor(score),
    breakdown: rows,
    reason: reasonFor(score, shared.length, gs.meanGap, tg.hit),
    sharedZones: shared,
    gap,
  };
}

function reasonFor(score: number, zones: number, meanGap: number, tailgated: boolean): string {
  if (score < 40) return 'No persistent pattern';
  if (tailgated) return 'Trailed through multiple zones and entered on the walker’s badge';
  if (zones >= 3) return `Held a ${meanGap.toFixed(0)}u gap across ${zones} zones and matched stops`;
  return 'Correlated movement over a sustained period';
}

/** Score every unordered pair present at `now`, highest first. */
export function scoreAllPairs(ticks: Tick[], now: number, ctx: ScoreContext): PairScore[] {
  const tokens = ticks[Math.min(now, ticks.length - 1)].tracks.map((t) => t.token);
  const out: PairScore[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      out.push(scorePair(ticks, now, tokens[i], tokens[j], ctx));
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Motion sensors currently reporting, for the map overlay. */
export function activeSensors(tick: Tick): string[] {
  return tick.events
    .filter((e): e is Extract<SensorEvent, { type: 'motion' }> => e.type === 'motion')
    .map((e) => e.sensorId)
    .filter((id) => MOTION_SENSORS.some((s) => s.id === id));
}

/**
 * Which pair the operator should be looking at.
 *
 * Normally that is simply the highest score. But when nothing is elevated we
 * surface a companion pair instead, so the panel can show *why* the two tracks
 * moving together were ruled out rather than leaving the operator to wonder.
 */
export function featuredPair(pairs: PairScore[]): PairScore | null {
  if (pairs.length === 0) return null;
  const top = pairs[0];
  if (top.tier !== 'Normal') return top;
  const companion = pairs.find((p) => p.reason === 'companions');
  return companion ?? top;
}
