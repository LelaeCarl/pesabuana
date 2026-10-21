import { Dialog } from './Dialog.jsx';

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <Dialog titleId="dialog-title" onDismiss={onCancel}>
      <div className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="close" onClick={onCancel} aria-label="Close">×</button>
      </div>
      <div className="dialog-body">
        <p>{message}</p>
      </div>
      <div className="dialog-footer">
        <button type="button" className="button" onClick={onCancel} autoFocus>Cancel</button>
        <button type="button" className="button danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Dialog>
  );
}
