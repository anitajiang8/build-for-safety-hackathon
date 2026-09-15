/**
 * Trailguard core types.
 *
 * PRIVACY NOTE: nothing in this file can identify a person. Cameras emit only
 * derived data -- an anonymous track token, a position, a heading, a speed and
 * optional pose flags. No images, no biometrics, no names. Tokens rotate every
 * 30 minutes so a token cannot be used to re-identify someone across a night.
 */

/** A labelled rectangle on the campus map (coordinate space is 0..100 x 0..60). */
export interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Historically low foot traffic -> raises the context multiplier. */
  lowTraffic: boolean;
}

/** An access-control door. Badge swipes and door-open events are reported here. */
export interface Door {
  id: string;
  name: string;
  zoneId: string;
  x: number;
  y: number;
}

/** A passive motion sensor. Presence only -- it cannot tell who tripped it. */
export interface MotionSensor {
  id: string;
  zoneId: string;
  x: number;
  y: number;
}

/** One anonymous track as seen by the sensor fusion layer at a single tick. */
export interface TrackState {
  /** Rotating anonymous token, e.g. "T-1". Never a name or an identity. */
  token: string;
  x: number;
  y: number;
  /** Degrees, 0 = +x (east), counter-clockwise positive. */
  heading: number;
  /** Units per tick. */
  speed: number;
  /** Pose classifier flag: an arm is raised holding a phone-shaped object. */
  phoneRaised: boolean;
}

export type SensorEvent =
  | { type: 'badge'; doorId: string; token: string }
  | { type: 'door_open_no_badge'; doorId: string; token: string }
  | { type: 'motion'; sensorId: string; zoneId: string }
  | { type: 'phone_raised'; token: string; towardToken: string };

/** One simulated second. */
export interface Tick {
  t: number;
  tracks: TrackState[];
  events: SensorEvent[];
}

export interface Scenario {
  id: string;
  name: string;
  /** One-line description shown in the UI. */
  blurb: string;
  /** Wall-clock time of tick 0, "HH:MM:SS" on a 24h clock. */
  startClock: string;
  ticks: Tick[];
}
