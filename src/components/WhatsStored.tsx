import './WhatsStored.css';

const RETAINED = [
  ['Anonymous track tokens', 'e.g. T-4821. Rotated every 30 minutes.'],
  ['Coordinates & heading', 'x/y on the campus grid, direction and speed.'],
  ['Derived pose flags', 'A boolean for "phone raised". Never the image it came from.'],
  ['Zone transitions', 'Which labelled zone a token entered, and when.'],
  ['Access-control events', 'Badge presented / door opened without badge.'],
  ['Follow Scores & alerts', 'The score, its breakdown, and any operator action taken.'],
];

const NEVER = [
  ['Faces or biometrics', 'No face templates, no gait signatures, no re-identification.'],
  ['Names or student IDs', 'The system has no roster and cannot look one up.'],
  ['Raw video by default', 'Footage stays blurred until a break-glass request is logged.'],
  ['Phone identifiers', 'No MAC, IMSI or Bluetooth capture.'],
  ['Audio', 'No microphones in the sensor set.'],
  ['Cross-night linking', 'Rotating tokens make a track unusable as a history.'],
];

const RETENTION = [
  ['Non-alert track data', '24 hours, then auto-deleted.'],
  ['Alerted incidents', '30 days, then reviewed and purged.'],
  ['Break-glass requests', 'Retained with reason and operator, permanently auditable.'],
];

/** The privacy receipt: exactly what Trailguard keeps and what it cannot know. */
export function WhatsStored() {
  return (
    <div className="stored">
      <section className="stored__section">
        <h3 className="stored__heading is-keep">What we store</h3>
        <ul className="stored__list">
          {RETAINED.map(([title, sub]) => (
            <li key={title}>
              <span className="stored__item">{title}</span>
              <span className="stored__sub">{sub}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="stored__section">
        <h3 className="stored__heading is-never">What we never collect</h3>
        <ul className="stored__list">
          {NEVER.map(([title, sub]) => (
            <li key={title}>
              <span className="stored__item">{title}</span>
              <span className="stored__sub">{sub}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="stored__section">
        <h3 className="stored__heading is-retention">Retention</h3>
        <ul className="stored__list">
          {RETENTION.map(([title, sub]) => (
            <li key={title}>
              <span className="stored__item">{title}</span>
              <span className="stored__sub">{sub}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
