import { useMemo, useState } from 'react';
import { formatLongDate } from '../../shared/dates.cjs';
import {
  INCOMING_KINDS,
  STATUS_LABELS,
  filterIncoming,
  summarizeIncoming,
  withIncomingView,
} from '../../shared/incoming.cjs';
import { formatMoney, minorToInput, parseMoney } from '../../shared/money.cjs';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { Dialog } from '../components/Dialog.jsx';
import { MoneyFigure } from '../components/MoneyBlock.jsx';

const STATUS_FILTERS = [
  ['open', 'Open'],
  ['overdue', 'Overdue'],
  ['received', 'Received'],
  ['cancelled', 'Cancelled'],
  ['all', 'All'],
];

export function Incoming({ state, commit, today }) {
  const [status, setStatus] = useState('open');
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [payment, setPayment] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const items = state.incoming || [];
  const views = useMemo(() => items.map((item) => withIncomingView(item, today)), [items, today]);
  const figures = summarizeIncoming(views);
  const rows = filterIncoming(items, { status, kind, query, today }).map((item) => withIncomingView(item, today));
  const details = views.find((item) => item.id === detailsId) || null;

  async function removePayment(id) {
    setConfirm(null);
    const result = await commit(await window.pesabuana.deleteIncomingPayment(id));
    if (result.error) setConfirm({ error: result.error });
  }

  async function setCancelled(item, cancelled) {
    setConfirm(null);
    const result = await commit(await window.pesabuana.setIncomingCancelled(item.id, cancelled));
    if (result.error) setConfirm({ error: result.error });
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Money coming in</h1>
          <p className="subtitle">Track money you expect or are owed. This list does not change sales or profit.</p>
        </div>
        <div className="actions">
          <button type="button" className="button primary" onClick={() => setEditing({ mode: 'add' })}>
            <span className="plus">+</span>Add incoming
          </button>
        </div>
      </div>
      <div className="entries-summary incoming-figures">
        <div>
          <div className="metric-label">Still to receive</div>
          <MoneyFigure minor={figures.overflow ? null : figures.stillToReceive} currency={state.currency} />
          <p className="subtitle">All open items</p>
        </div>
        <div>
          <div className="metric-label">Overdue</div>
          <MoneyFigure minor={figures.overflow ? null : figures.overdue} currency={state.currency} />
          <p className="subtitle">Included in still to receive</p>
        </div>
      </div>
      <div className="entries-toolbar">
        <div className="filter-tabs" role="group" aria-label="Incoming status">
          {STATUS_FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)}>{label}</button>
          ))}
        </div>
        <label className="field category-filter">
          Type
          <select aria-label="Type" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">All types</option>
            {Object.entries(INCOMING_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="field category-filter">
          Search
          <input aria-label="Search names and descriptions" value={query} placeholder="Name or description" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      {rows.length === 0 ? (
        <div className="table-surface">
          <p className="table-empty">
            {items.length === 0 && status === 'open' && kind === 'all' && !query.trim()
              ? 'No money coming in yet.'
              : 'No items match these filters.'}
          </p>
        </div>
      ) : (
        <div className="table-surface">
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>Description</th>
                <th className="num">Still to receive</th>
                <th>Expected date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="incoming-text" title={item.party}>{item.party}</td>
                  <td className="incoming-text" title={item.description}>{item.description}</td>
                  <td className="num">{formatMoney(item.remaining, state.currency)}</td>
                  <td>{item.expectedDate ? formatLongDate(item.expectedDate) : 'No date set'}</td>
                  <td>{STATUS_LABELS[item.status]}{item.overdue ? ' · Overdue' : ''}</td>
                  <td><button type="button" className="row-action" onClick={() => setDetailsId(item.id)}>Details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? (
        <ItemDialog
          item={editing.item}
          currency={state.currency}
          commit={commit}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {details ? (
        <DetailsDialog
          item={details}
          currency={state.currency}
          onClose={() => setDetailsId(null)}
          onEdit={() => setEditing({ mode: 'edit', item: details })}
          onPay={(prefill) => setPayment({ item: details, prefill })}
          onRemove={(paymentId) => setConfirm({ type: 'payment', id: paymentId })}
          onCancelItem={() => setConfirm({ type: 'cancel', item: details })}
          onReopen={() => setConfirm({ type: 'reopen', item: details })}
        />
      ) : null}
      {payment ? (
        <PaymentDialog
          item={payment.item}
          prefill={payment.prefill}
          currency={state.currency}
          today={today}
          commit={commit}
          onClose={() => setPayment(null)}
        />
      ) : null}
      {confirm && confirm.type === 'payment' ? (
        <ConfirmDialog
          title="Remove payment"
          message="Remove this payment? The remaining amount and status will be recalculated."
          confirmLabel="Remove"
          onConfirm={() => removePayment(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm && confirm.type === 'cancel' ? (
        <ConfirmDialog
          title="Cancel expected money"
          message="Stop expecting the unpaid remainder? It leaves the outstanding totals. This does not create a loss or an expense. Payments already recorded stay on this item."
          confirmLabel="Cancel item"
          onConfirm={() => setCancelled(confirm.item, true)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm && confirm.type === 'reopen' ? (
        <ConfirmDialog
          title="Reopen item"
          message="Reopen this item? The unpaid remainder returns to the outstanding totals."
          confirmLabel="Reopen"
          onConfirm={() => setCancelled(confirm.item, false)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm && confirm.error ? (
        <ConfirmDialog
          title="Could not update"
          message={confirm.error}
          confirmLabel="Close"
          onConfirm={() => setConfirm(null)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </>
  );
}

function ItemDialog({ item, currency, commit, onClose }) {
  const editing = Boolean(item);
  const [party, setParty] = useState(item ? item.party : '');
  const [description, setDescription] = useState(item ? item.description : '');
  const [kind, setKind] = useState(item ? item.kind : 'business');
  const [amount, setAmount] = useState(item ? minorToInput(item.expectedAmount, currency.exponent) : '');
  const [expectedDate, setExpectedDate] = useState(item && item.expectedDate ? item.expectedDate : '');
  const [notes, setNotes] = useState(item ? item.notes : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [token] = useState(newToken);

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const parsed = amount.trim() ? parseMoney(amount, currency.exponent) : null;
    if (!party.trim()) { setError('Enter who the money is from.'); return; }
    if (!description.trim()) { setError('Enter what the money is for.'); return; }
    if (!parsed || !parsed.ok) { setError(parsed ? parsed.error : 'Enter an amount above zero.'); return; }
    if (parsed.minor === 0) { setError('Enter an amount above zero.'); return; }
    setBusy(true);
    setError('');
    const payload = {
      party,
      description,
      kind,
      expectedAmount: parsed.minor,
      expectedDate: expectedDate || null,
      notes,
      clientToken: token,
    };
    const result = await commit(await (
      editing
        ? window.pesabuana.updateIncoming({ ...payload, id: item.id })
        : window.pesabuana.addIncoming(payload)
    ));
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Dialog titleId="incoming-form-heading" onDismiss={onClose}>
      <form onSubmit={onSubmit}>
        <div className="dialog-header">
          <h2 id="incoming-form-heading">{editing ? 'Edit incoming' : 'Add incoming'}</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="dialog-body form-stack">
          <label className="field">
            From
            <input value={party} maxLength={80} autoFocus onChange={(event) => setParty(event.target.value)} />
          </label>
          <label className="field">
            Description
            <input value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="field">
            Type
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              {Object.entries(INCOMING_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            Amount expected (RMB)
            <input inputMode="decimal" value={amount} placeholder="0.00" onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="field">
            Expected date
            <input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
          </label>
          <label className="field">
            Notes
            <textarea value={notes} maxLength={400} rows={3} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
        <div className="dialog-footer">
          <button type="button" className="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving' : 'Save'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function PaymentDialog({ item, prefill, currency, today, commit, onClose }) {
  const [amount, setAmount] = useState(prefill ? minorToInput(prefill, currency.exponent) : '');
  const [receivedDate, setReceivedDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [token] = useState(newToken);

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const parsed = amount.trim() ? parseMoney(amount, currency.exponent) : null;
    if (!parsed || !parsed.ok || parsed.minor === 0) {
      setError(parsed && !parsed.ok ? parsed.error : 'Enter a payment above zero.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await commit(await window.pesabuana.addIncomingPayment({
      itemId: item.id,
      amount: parsed.minor,
      receivedDate,
      note,
      today,
      clientToken: token,
    }));
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Dialog titleId="payment-heading" onDismiss={onClose}>
      <form onSubmit={onSubmit}>
        <div className="dialog-header">
          <h2 id="payment-heading">Record payment</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="dialog-body form-stack">
          <p className="form-section-note">Updates this tracker only. Record business sales separately in Entries.</p>
          <label className="field">
            Amount received (RMB)
            <input inputMode="decimal" value={amount} autoFocus placeholder="0.00" onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="field">
            Received date
            <input type="date" value={receivedDate} max={today} onChange={(event) => setReceivedDate(event.target.value)} />
          </label>
          <label className="field">
            Note
            <input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
        <div className="dialog-footer">
          <button type="button" className="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving' : 'Save payment'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function DetailsDialog({ item, currency, onClose, onEdit, onPay, onRemove, onCancelItem, onReopen }) {
  return (
    <Dialog titleId="incoming-details-heading" onDismiss={onClose} className="wide-dialog">
      <div className="dialog-header">
        <h2 id="incoming-details-heading">{item.party}</h2>
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="dialog-body form-stack">
        <p className="incoming-text">{item.description}</p>
        <p className="subtitle">{INCOMING_KINDS[item.kind]} · {STATUS_LABELS[item.status]}{item.overdue ? ' · Overdue' : ''}</p>
        <div className="incoming-amounts">
          <Amount label="Original amount" minor={item.expectedAmount} currency={currency} />
          <Amount label="Received" minor={item.received} currency={currency} />
          <Amount label="Still to receive" minor={item.remaining} currency={currency} />
        </div>
        <p>Expected date: {item.expectedDate ? formatLongDate(item.expectedDate) : 'No date set'}</p>
        {item.notes ? <p className="incoming-text">{item.notes}</p> : null}
        <h3 className="section-title">Payments</h3>
        {item.payments.length === 0 ? <p className="subtitle">No payments recorded.</p> : (
          <ul className="category-list">
            {item.payments.map((payment) => (
              <li key={payment.id}>
                <span>{formatLongDate(payment.receivedDate)} · {formatMoney(payment.amount, currency)}{payment.note ? ` · ${payment.note}` : ''}</span>
                <button type="button" className="row-action" onClick={() => onRemove(payment.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="dialog-footer">
        <button type="button" className="button" onClick={onEdit}>Edit</button>
        {item.cancelled ? (
          <button type="button" className="button" onClick={onReopen}>Reopen</button>
        ) : (
          <>
            {item.remaining > 0 ? (
              <>
                <button type="button" className="button" onClick={() => onPay(null)}>Record payment</button>
                <button type="button" className="button primary" onClick={() => onPay(item.remaining)}>Mark as received</button>
              </>
            ) : null}
            {item.status !== 'received' ? <button type="button" className="button" onClick={onCancelItem}>Cancel item</button> : null}
          </>
        )}
      </div>
    </Dialog>
  );
}

function Amount({ label, minor, currency }) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <strong>{formatMoney(minor, currency)}</strong>
    </div>
  );
}

function newToken() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
