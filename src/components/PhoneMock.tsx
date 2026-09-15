import type { PhoneNotification } from '../engine/useSimulation';
import './PhoneMock.css';

interface Props {
  notification: PhoneNotification | null;
  clock: string;
}

/** The walker's own phone. Opt-in "Walk Mode" shares zone-level location only --
 *  never coordinates, and only while the student has it switched on. */
export function PhoneMock({ notification, clock }: Props) {
  return (
    <div className="phone">
      <div className="phone__screen">
        <div className="phone__status">
          <span>{clock.slice(0, 5)}</span>
          <span className="phone__walkmode">Walk Mode on</span>
        </div>

        {notification ? (
          <div className="phone__notification">
            <div className="phone__notification-head">
              <span className="phone__app">{notification.title}</span>
              <span className="phone__now">now</span>
            </div>
            <p className="phone__notification-body">{notification.body}</p>
            <button className="phone__call">Call campus security</button>
          </div>
        ) : (
          <div className="phone__idle">
            <div className="phone__idle-title">Walk Mode</div>
            <p className="phone__idle-body">
              Sharing <strong>zone only</strong> &mdash; not your exact location. You can turn this
              off any time.
            </p>
          </div>
        )}
      </div>
      <div className="phone__caption">Student phone &middot; opt-in</div>
    </div>
  );
}
