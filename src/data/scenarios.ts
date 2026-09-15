/**
 * Campus map + scripted scenarios.
 *
 * Ticks are generated deterministically (no randomness that isn't seeded) so the
 * demo behaves identically every run. One tick = one simulated second.
 */
import type {
  Door,
  MotionSensor,
  Scenario,
  SensorEvent,
  Tick,
  TrackState,
  Zone,
} from './types';

/* ------------------------------------------------------------------ */
/* Campus map                                                          */
/* ------------------------------------------------------------------ */

/** Coordinate space of the whole campus map. */
export const MAP_W = 100;
export const MAP_H = 60;

export const ZONES: Zone[] = [
  { id: 'library', name: 'Library Entrance', x: 4, y: 36, w: 18, h: 18, lowTraffic: false },
  { id: 'quad', name: 'Arts Quad', x: 28, y: 34, w: 22, h: 20, lowTraffic: false },
  { id: 'ring', name: 'Ring Road North', x: 26, y: 18, w: 50, h: 16, lowTraffic: true },
  { id: 'eng', name: 'Engineering Walkway', x: 56, y: 34, w: 20, h: 18, lowTraffic: true },
  { id: 'parking', name: 'Parking Lot N', x: 4, y: 4, w: 20, h: 14, lowTraffic: true },
  { id: 'residence', name: 'Residence Entrance', x: 80, y: 30, w: 16, h: 20, lowTraffic: false },
];

export const DOORS: Door[] = [
  { id: 'door-res-1', name: 'Residence Hall North Door', zoneId: 'residence', x: 88, y: 40 },
];

export const MOTION_SENSORS: MotionSensor[] = [
  { id: 'motion-ring-1', zoneId: 'ring', x: 53, y: 27 },
  { id: 'motion-eng-1', zoneId: 'eng', x: 66, y: 43 },
];

/** Which zone contains a point, or null if it is in the gaps between zones. */
export function zoneAt(x: number, y: number): Zone | null {
  for (const z of ZONES) {
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
  }
  return null;
}

export function zoneName(id: string | null): string {
  if (!id) return 'Between zones';
  return ZONES.find((z) => z.id === id)?.name ?? id;
}

/* ------------------------------------------------------------------ */
/* Path helpers                                                        */
/* ------------------------------------------------------------------ */

interface Pt {
  x: number;
  y: number;
}

/** The route the walker takes: Library -> Quad -> Ring Road -> Eng -> Residence. */
const ROUTE: Pt[] = [
  { x: 13, y: 45 }, // Library Entrance
  { x: 38, y: 44 }, // Arts Quad
  { x: 45, y: 27 }, // down onto Ring Road North
  { x: 62, y: 27 }, // along the ring road
  { x: 66, y: 43 }, // up the Engineering Walkway
  { x: 88, y: 40 }, // Residence Entrance door
];

const SEG_LEN = ROUTE.slice(1).map((p, i) => Math.hypot(p.x - ROUTE[i].x, p.y - ROUTE[i].y));
const ROUTE_LEN = SEG_LEN.reduce((a, b) => a + b, 0);

/** Position + heading at arc-length `s` along the route (clamped at both ends). */
function pointAt(s: number): { x: number; y: number; heading: number } {
  let rem = Math.max(0, Math.min(ROUTE_LEN, s));
  for (let i = 0; i < SEG_LEN.length; i++) {
    if (rem <= SEG_LEN[i] || i === SEG_LEN.length - 1) {
      const a = ROUTE[i];
      const b = ROUTE[i + 1];
      const f = Math.min(1, rem / SEG_LEN[i]);
      return {
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        heading: deg(Math.atan2(b.y - a.y, b.x - a.x)),
      };
    }
    rem -= SEG_LEN[i];
  }
  const last = ROUTE[ROUTE.length - 1];
  return { x: last.x, y: last.y, heading: 0 };
}

const deg = (rad: number) => (rad * 180) / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Deterministic PRNG so background wander is identical on every run. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Walker timing ---------------------------------------------------- */

const TICKS = 90;
const WALK_SPEED = 1.5; // units per tick
const PAUSE_START = 39; // she stops here (checking a message / looking back)
const PAUSE_LEN = 6;

/** Distance the walker has travelled along the route by tick `t`. */
function leaderArc(t: number): number {
  if (t <= PAUSE_START) return WALK_SPEED * t;
  if (t <= PAUSE_START + PAUSE_LEN) return WALK_SPEED * PAUSE_START;
  return WALK_SPEED * (t - PAUSE_LEN);
}

const leaderPos = (t: number) => pointAt(leaderArc(t));
/** Speed *into* tick t. Zero while she is paused. */
const leaderSpeed = (t: number) => (t <= 0 ? WALK_SPEED : leaderArc(t) - leaderArc(t - 1));

/* Background tracks ------------------------------------------------- */

/** A track that wanders inside a box. Deterministic, unrelated to the pair. */
function wander(token: string, seed: number, box: { x: number; y: number; w: number; h: number }) {
  const rnd = mulberry32(seed);
  let x = box.x + box.w * rnd();
  let y = box.y + box.h * rnd();
  let dir = rnd() * 360;
  const out: TrackState[] = [];
  for (let t = 0; t < TICKS; t++) {
    dir += (rnd() - 0.5) * 22;
    const speed = 0.5 + rnd() * 0.5;
    let nx = x + Math.cos((dir * Math.PI) / 180) * speed;
    let ny = y + Math.sin((dir * Math.PI) / 180) * speed;
    // Bounce off the edges of the wander box.
    if (nx < box.x || nx > box.x + box.w) {
      dir = 180 - dir;
      nx = clamp(nx, box.x, box.x + box.w);
    }
    if (ny < box.y || ny > box.y + box.h) {
      dir = -dir;
      ny = clamp(ny, box.y, box.y + box.h);
    }
    x = nx;
    y = ny;
    out.push({ token, x, y, heading: ((dir % 360) + 360) % 360, speed, phoneRaised: false });
  }
  return out;
}

/** Motion events for any track standing close to a sensor. */
function motionEvents(tracks: TrackState[]): SensorEvent[] {
  const events: SensorEvent[] = [];
  for (const s of MOTION_SENSORS) {
    if (tracks.some((tr) => Math.hypot(tr.x - s.x, tr.y - s.y) < 6)) {
      events.push({ type: 'motion', sensorId: s.id, zoneId: s.zoneId });
    }
  }
  return events;
}

/* ------------------------------------------------------------------ */
/* Scenario 1 -- following incident, 11:40 PM                          */
/* ------------------------------------------------------------------ */

/** Ticks on which T-2 raises a phone toward T-1 (flag stays up for 2 ticks). */
const PHONE_TICKS = [20, 36, 52];
const BADGE_TICK = 74; // T-1 badges into the residence
const TAILGATE_TICK = 82; // T-2 slips through the same door, no badge

function buildFollowingScenario(): Scenario {
  const leader: TrackState[] = [];
  const follower: TrackState[] = [];

  // T-2 runs a pursuit curve: he steers at where T-1 was one tick ago and
  // regulates his own speed to hold a constant gap. That single rule produces
  // the behaviour a tail actually shows -- he stops when she stops (one tick
  // later, a human reaction) and swings onto her new bearing when she turns.
  const DESIRED_GAP = 11;
  const CLOSE_GAP = 4; // how near he gets at the door
  let fx = ROUTE[0].x - DESIRED_GAP;
  let fy = ROUTE[0].y;
  let fHeading = 0;

  for (let t = 0; t < TICKS; t++) {
    const lp = leaderPos(t);
    leader.push({
      token: 'T-1',
      x: lp.x,
      y: lp.y,
      heading: lp.heading,
      speed: leaderSpeed(t),
      phoneRaised: false,
    });

    if (t > 0) {
      const aim = leaderPos(t - 1);
      const dx = aim.x - fx;
      const dy = aim.y - fy;
      const gap = Math.max(0.001, Math.hypot(dx, dy));
      // Match her pace, plus a correction that pulls the gap back to target.
      let sp = leaderSpeed(t - 1) + 0.5 * (gap - DESIRED_GAP);
      // On the final approach he closes up to slip through the door behind her,
      // but never gets closer than CLOSE_GAP -- he is not walking with her.
      if (t >= BADGE_TICK - 10) sp = Math.max(sp, 1.7);
      sp = clamp(sp, 0, Math.max(0, gap - CLOSE_GAP));
      sp = clamp(sp, 0, 2.2);
      if (sp < 0.08) sp = 0; // snap to a true stop so the mirroring read is crisp
      fx += (dx / gap) * sp;
      fy += (dy / gap) * sp;
      fHeading = deg(Math.atan2(dy, dx));
      follower.push({
        token: 'T-2',
        x: fx,
        y: fy,
        heading: fHeading,
        speed: sp,
        phoneRaised: PHONE_TICKS.some((p) => t >= p && t < p + 2),
      });
    } else {
      follower.push({ token: 'T-2', x: fx, y: fy, heading: 0, speed: WALK_SPEED, phoneRaised: false });
    }
  }

  const bg1 = wander('T-77', 9137, { x: 6, y: 6, w: 16, h: 10 }); // Parking Lot N
  const bg2 = wander('T-93', 4421, { x: 30, y: 36, w: 18, h: 16 }); // Arts Quad

  const ticks: Tick[] = [];
  for (let t = 0; t < TICKS; t++) {
    const tracks = [leader[t], follower[t], bg1[t], bg2[t]];
    const events: SensorEvent[] = motionEvents(tracks);
    if (PHONE_TICKS.includes(t)) {
      events.push({ type: 'phone_raised', token: 'T-2', towardToken: 'T-1' });
    }
    if (t === BADGE_TICK) {
      events.push({ type: 'badge', doorId: 'door-res-1', token: 'T-1' });
    }
    if (t === TAILGATE_TICK) {
      events.push({ type: 'door_open_no_badge', doorId: 'door-res-1', token: 'T-2' });
    }
    ticks.push({ t, tracks, events });
  }

  return {
    id: 'following',
    name: 'Following incident',
    blurb: '11:40 PM, low foot traffic. T-1 walks home from the library.',
    startClock: '23:40:00',
    ticks,
  };
}

/* ------------------------------------------------------------------ */
/* Scenario 2 -- friends walking together, 7:30 PM                     */
/* ------------------------------------------------------------------ */

function buildFriendsScenario(): Scenario {
  const a: TrackState[] = [];
  const b: TrackState[] = [];

  for (let t = 0; t < TICKS; t++) {
    const p = leaderPos(t);
    const sp = leaderSpeed(t);
    const rad = (p.heading * Math.PI) / 180;
    // T-4 walks abreast: offset perpendicular to the direction of travel, with
    // a gentle sway so the gap breathes between roughly 1 and 2 units.
    const off = 1.5 + 0.4 * Math.sin(t / 5);
    a.push({ token: 'T-3', x: p.x, y: p.y, heading: p.heading, speed: sp, phoneRaised: false });
    b.push({
      token: 'T-4',
      x: p.x - Math.sin(rad) * off,
      y: p.y + Math.cos(rad) * off,
      heading: p.heading,
      speed: sp,
      phoneRaised: false,
    });
  }

  const bg1 = wander('T-51', 2211, { x: 6, y: 6, w: 16, h: 10 });
  const bg2 = wander('T-62', 8802, { x: 58, y: 36, w: 16, h: 14 });

  const ticks: Tick[] = [];
  for (let t = 0; t < TICKS; t++) {
    const tracks = [a[t], b[t], bg1[t], bg2[t]];
    const events: SensorEvent[] = motionEvents(tracks);
    // Both friends badge in -- no tailgate.
    if (t === BADGE_TICK) events.push({ type: 'badge', doorId: 'door-res-1', token: 'T-3' });
    if (t === BADGE_TICK + 2) events.push({ type: 'badge', doorId: 'door-res-1', token: 'T-4' });
    ticks.push({ t, tracks, events });
  }

  return {
    id: 'friends',
    name: 'Friends walking together',
    blurb: '7:30 PM. T-3 and T-4 walk the same route side by side.',
    startClock: '19:30:00',
    ticks,
  };
}

export const SCENARIOS: Scenario[] = [buildFollowingScenario(), buildFriendsScenario()];

/** "23:40:00" + t seconds, formatted for the simulated clock. */
export function clockAt(startClock: string, t: number): string {
  const [h, m, s] = startClock.split(':').map(Number);
  const total = h * 3600 + m * 60 + s + t;
  const hh = Math.floor(total / 3600) % 24;
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}
