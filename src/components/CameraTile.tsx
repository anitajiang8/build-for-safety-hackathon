import { useState } from 'react';
import './CameraTile.css';

interface Props {
  zone: string;
  token: string;
  onBreakGlass: (reason: string, zone: string, token: string) => void;
}

/** A silhouette stand-in for a camera frame. Blurred is the default state --
 *  the clear view only exists after a logged, reasoned request. */
function Silhouette({ clear }: { clear: boolean }) {
  return (
    <svg className={`camera__frame${clear ? ' is-clear' : ''}`} viewBox="0 0 100 60" aria-hidden="true">
      <rect x="0" y="0" width="100" height="60" fill="#11161d" />
      <rect x="0" y="44" width="100" height="16" fill="#151d26" />
      <circle cx="44" cy="24" r="7" fill="#39434f" />
      <path d="M31 60 q0 -22 13 -22 q13 0 13 22 z" fill="#39434f" />
      <circle cx="70" cy="26" r="6" fill="#2c343e" />
      <path d="M59 60 q0 -19 11 -19 q11 0 11 19 z" fill="#2c343e" />
    </svg>
  );
}

export function CameraTile({ zone, token, onBreakGlass }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [clear, setClear] = useState(false);
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length === 0) {
      setError(true);
      return;
    }
    onBreakGlass(reason.trim(), zone, token);
    setClear(true);
    setOpen(false);
    setReason('');
    setError(false);
  };

  return (
    <div className="camera">
      <div className="camera__stage">
        <Silhouette clear={clear} />
        <div className="camera__zone">{zone}</div>
        <div className={`camera__state${clear ? ' is-clear' : ''}`}>
          {clear ? 'Unblurred · logged' : 'Blurred by default'}
        </div>
      </div>

      {clear ? (
        <button className="camera__btn" onClick={() => setClear(false)}>
          Re-blur footage
        </button>
      ) : (
        <button className="camera__btn is-primary" onClick={() => setOpen(true)}>
          Break glass: view footage
        </button>
      )}

      {open && (
        <div className="camera__overlay" role="dialog" aria-modal="true" aria-label="Break glass request">
          <form className="camera__modal" onSubmit={submit}>
            <h3 className="camera__modal-title">Break glass: view footage</h3>
            <p className="camera__modal-body">
              Viewing identifiable footage requires a reason. This request is written to the
              audit log with the time, your reason and the track token &mdash; it cannot be
              deleted.
            </p>
            <dl className="camera__modal-facts">
              <div>
                <dt>Zone</dt>
                <dd>{zone}</dd>
              </div>
              <div>
                <dt>Track</dt>
                <dd>{token}</dd>
              </div>
            </dl>
            <label className="camera__modal-label" htmlFor="break-glass-reason">
              Reason (required)
            </label>
            <textarea
              id="break-glass-reason"
              className={`camera__modal-input${error ? ' is-error' : ''}`}
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(false);
              }}
              placeholder="e.g. Respond-tier follow alert, confirming description for responding patrol"
            />
            {error && <div className="camera__modal-error">A reason is required.</div>}
            <div className="camera__modal-actions">
              <button
                type="button"
                className="camera__btn"
                onClick={() => {
                  setOpen(false);
                  setError(false);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="camera__btn is-danger">
                Log request &amp; view
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
