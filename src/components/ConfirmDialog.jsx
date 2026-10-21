import { useEffect } from 'react';

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="dialog-title">{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel} autoFocus>Cancel</button>
          <button type="button" className="danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
