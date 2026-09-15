# Trailguard

A privacy-first campus safety dashboard that detects when one person is
**persistently following** another across sensor zones — without ever knowing who
either of them is.

Built for the Verkada **Build for Safety** challenge: sensor fusion, actionable
alerts, privacy by construction.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

`npm run build` type-checks and produces a production bundle.

## The idea

Cameras never emit images to the system. They emit **derived data only**: an
anonymous track token (`T-4821`), an x/y position, a heading, a speed, and an
optional "phone raised" pose flag. Tokens rotate every 30 minutes, so a token
cannot be used to reconstruct someone's night, let alone their identity.

The engine fuses those thin signals across pairs of tracks into a **Follow
Score** (0–100):

| Signal | Weight | What it measures |
| --- | --- | --- |
| Zone continuity | 30 | Consecutive zones both tracks crossed, in the same order |
| Gap stability | 20 | A steady 5–20 unit gap (low standard deviation) |
| Mirroring | 20 | Stops and turns answered within 2 ticks, same rotational direction |
| Phone raised | 10 | Pose flag while oriented at the other track |
| Door tailgate | 15 | Door opened on the walker's badge with no second credential |
| Context | ×1.3 | After 10 PM, or in a low-traffic zone |

**Companion exclusion** runs first: if the pair stays within 3 units of each
other for most of the window they are walking together, and the pair is
suppressed with reason `companions` before any signal is weighed.

Tiers: **0–39 Normal · 40–69 Watch · 70+ Respond**.

## Privacy features to point at

- **What's stored** toggle (top of the Follow Score panel) — the full list of what
  is retained, what is never collected, and the retention clock (24 hours for
  non-alert data).
- **Break glass** on the camera tile — footage is blurred by default. A clear view
  requires a typed reason, and the request is written to the audit log with the
  time, the reason and the track token.
- **Walk Mode** phone — opt-in, shares *zone-level* location only, and the student
  gets a discreet notification rather than being surveilled silently.
- **Audit log** — every operator action and every break-glass request, in order.

## 60-second demo script

The app runs as two screens: the **Safety Alerts board** and the **live operations
dashboard**. The Trailguard wordmark in the dashboard top bar goes back to the
board, so you can re-run the demo without a reload.

**0:00 — Opening board.** The app starts on the Safety Alerts board. The filter
tabs work — tap `[HIGH PRIORITY]` to show just the following pattern. Click the
**FOLLOWING PATTERN** card (or `VIEW ALERT →`) to open the dashboard.

**0:06 — Set up.** Scenario `Following incident` (11:40 PM). Press **4x**, then
**Play**.

**0:10 — Watch fires (~tick 19).** T-2 turns yellow on the map and a dashed line
links the pair. Point at the breakdown: gap stability is already maxed — he is
holding a ~11 unit gap that barely varies.

**0:20 — Respond fires (~tick 36).** T-2 turns red and pulses. Read the alert
card: *"T-2 has followed T-1 across 3 zones."* Note this happens **while she is
still on the Ring Road**, long before she reaches her residence at tick 67.

**0:30 — Show the "why".** The breakdown is the pitch: zone continuity climbing
to 4 zones, mirroring showing she stopped at tick 40 and he stopped at 41, phone
raised 3 times, ×1.3 because it is after 10 PM.

**0:40 — Act.** On the Respond card click, in order:
1. **Dispatch nearest patrol**
2. **Increase lighting in zone**
3. **Notify walker (opt-in)** → the phone mockup shows *"Security has been alerted
   and is nearby."* with a **Call campus security** button.

Each click lands in the audit log on the left.

**0:48 — Break glass.** Click **Break glass: view footage**, type a reason (it is
required — try submitting empty first), submit. The silhouette sharpens and the
request appears in the audit log with the reason attached.

**0:52 — Privacy receipt.** Click **What's stored**. Read one line from each
column: anonymous tokens and derived events in, faces and names never collected,
24-hour auto-deletion for non-alert data.

**0:56 — Prove it does not cry wolf.** Switch the scenario to
`Friends walking together`, **Play** at 4x. Two tracks walk the identical route.
The score stays **0**, the panel reads **Excluded: companions**, and the alert
feed stays empty.

## Layout of the code

```
src/
  data/
    types.ts        Track, zone, door, sensor and event types
    scenarios.ts    Campus map + the two scripted scenarios (generated deterministically)
  engine/
    followScore.ts  Pure scoring functions — no React, no I/O
    useSimulation.ts Playback, alert emission, audit log, operator actions
  components/       One component + one CSS file each
                    LandingScreen.tsx  the opening Safety Alerts board
  styles/tokens.css All colors, spacing, radius and type tokens
```

Logic and UI are kept apart on purpose, and every component's styles live in its
own file, so the Figma design can be swapped in by editing `tokens.css` plus the
individual component stylesheets.

The palette is light by default and lives entirely in `tokens.css` — no component
hardcodes a colour, so re-theming (including back to dark) is a single-file edit.

## Notes on the model

- The two scenarios are generated, not hand-typed: the walker follows a route at
  a fixed pace with a scripted pause, and the follower runs a **pursuit curve** —
  he steers at where she was a moment ago and regulates his speed to hold a
  constant gap. That one rule reproduces the behaviour a tail actually shows.
- Zone continuity looks at the whole incident rather than the 30-tick window.
  Crossing a zone takes about 20 ticks, so a windowed view could never see more
  than two, and "followed me across four zones" is the fact an operator needs.
  The movement signals stay windowed.
