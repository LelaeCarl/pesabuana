import { useState } from 'react';
import { parseMoney, formatMoney } from '../../shared/money.cjs';
import { CategoryField, CategoryNameDialog } from './CategoryField.jsx';
import { Dialog } from './Dialog.jsx';

export function EntryDialog({ kind, record, currency, categories = [], today, commit, onClose, onSaved }) {
  const editing = Boolean(record);
  const initialCategory = record && kind === 'expense' ? (record.categoryId ?? null) : '';
  const [entryDate, setEntryDate] = useState(record ? record.entryDate : today);
  const [description, setDescription] = useState(record ? record.description : '');
  const [saleAmount, setSaleAmount] = useState(record && kind === 'sale' ? moneyText(record.saleAmount, currency) : '');
  const [directCost, setDirectCost] = useState(record && kind === 'sale' ? moneyText(record.directCost, currency) : '');
  const [amount, setAmount] = useState(record && kind === 'expense' ? moneyText(record.amount, currency) : '');
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameError, setNameError] = useState('');
  const [restoreOffer, setRestoreOffer] = useState(null);
  const initial = {
    entryDate: record ? record.entryDate : today,
    description: record ? record.description : '',
    saleAmount: record && kind === 'sale' ? moneyText(record.saleAmount, currency) : '',
    directCost: record && kind === 'sale' ? moneyText(record.directCost, currency) : '',
    amount: record && kind === 'expense' ? moneyText(record.amount, currency) : '',
  };
  const dirty = entryDate !== initial.entryDate
    || description !== initial.description
    || saleAmount !== initial.saleAmount
    || directCost !== initial.directCost
    || amount !== initial.amount
    || categoryId !== initialCategory;

  function requestClose() {
    if (dirty) setDiscarding(true);
    else onClose();
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const next = {};
    if (kind === 'sale') {
      if (!saleAmount.trim()) next.saleAmount = 'Enter a sale amount. Use 0 if there was no sale.';
      if (!directCost.trim()) next.directCost = 'Enter a direct cost. Use 0 if there was no direct cost.';
      const sale = saleAmount.trim() ? parseMoney(saleAmount, currency.exponent) : null;
      const cost = directCost.trim() ? parseMoney(directCost, currency.exponent) : null;
      if (sale && !sale.ok) next.saleAmount = sale.error;
      if (cost && !cost.ok) next.directCost = cost.error;
      if (Object.keys(next).length) {
        setErrors(next);
        return;
      }
      setBusy(true);
      setErrors({});
      const payload = { entryDate, description, saleAmount: sale.minor, directCost: cost.minor };
      try {
        const result = await commit(await (
          editing
            ? window.pesabuana.updateSale({ ...payload, id: record.id })
            : window.pesabuana.addSale(payload)
        ));
        setBusy(false);
        if (result.error) {
          setErrors({ form: result.error });
          return;
        }
        onSaved(editing ? 'Sale updated' : 'Sale saved');
        onClose();
      } catch {
        setBusy(false);
        setErrors({ form: 'The sale could not be saved. Check the amounts and try again.' });
      }
      return;
    }
    if (!amount.trim()) next.amount = 'Enter an expense amount.';
    const parsed = amount.trim() ? parseMoney(amount, currency.exponent) : null;
    if (parsed && !parsed.ok) next.amount = parsed.error;
    if (parsed && parsed.ok && parsed.minor === 0) next.amount = 'Enter an expense amount above zero.';
    if (categoryId === '') next.category = 'Choose a category.';
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(true);
    setErrors({});
    const payload = { entryDate, description, amount: parsed.minor, categoryId };
    try {
      const result = await commit(await (
        editing
          ? window.pesabuana.updateExpense({ ...payload, id: record.id })
          : window.pesabuana.addExpense(payload)
      ));
      setBusy(false);
      if (result.error) {
        setErrors({ form: result.error });
        return;
      }
      onSaved(editing ? 'Expense updated' : 'Expense saved');
      onClose();
    } catch {
      setBusy(false);
      setErrors({ form: 'The expense could not be saved. Check the amount and try again.' });
    }
  }

  const preview = grossPreview(saleAmount, directCost, currency);

  return (
    <>
    <Dialog titleId="entry-heading" onDismiss={requestClose}>
      <form onSubmit={onSubmit}>
        <div className="dialog-header">
          <h2 id="entry-heading">{editing ? `Edit ${kind}` : kind === 'sale' ? 'Add sale' : 'Add expense'}</h2>
          <button type="button" className="close" onClick={requestClose} aria-label="Close">×</button>
        </div>
        <div className="dialog-body form-stack">
          <label className="field">
            Date
            <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} required autoFocus />
          </label>
          <label className="field">
            Description
            <input
              value={description}
              maxLength={200}
              placeholder={kind === 'sale' ? 'Order or daily sales total' : 'What the expense was for'}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {kind === 'sale' ? (
            <div className="form-row">
              <label className="field">
                Sale amount (RMB)
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={errors.saleAmount ? 'true' : undefined}
                  aria-describedby={errors.saleAmount ? 'sale-amount-error' : undefined}
                  value={saleAmount}
                  placeholder="0.00"
                  onChange={(event) => setSaleAmount(event.target.value)}
                />
                {errors.saleAmount ? <span id="sale-amount-error" className="form-error" role="alert">{errors.saleAmount}</span> : null}
              </label>
              <label className="field">
                Direct cost (RMB)
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={errors.directCost ? 'true' : undefined}
                  aria-describedby={errors.directCost ? 'direct-cost-error' : undefined}
                  value={directCost}
                  placeholder="0.00"
                  onChange={(event) => setDirectCost(event.target.value)}
                />
                {errors.directCost ? <span id="direct-cost-error" className="form-error" role="alert">{errors.directCost}</span> : null}
              </label>
            </div>
          ) : (
            <>
              <label className="field">
                Amount (RMB)
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={errors.amount ? 'true' : undefined}
                  aria-describedby={errors.amount ? 'expense-amount-error' : undefined}
                  value={amount}
                  placeholder="0.00"
                  onChange={(event) => setAmount(event.target.value)}
                />
                {errors.amount ? <span id="expense-amount-error" className="form-error" role="alert">{errors.amount}</span> : null}
              </label>
              <CategoryField
                categories={categories}
                value={categoryId}
                allowUncategorised={editing && record.categoryId == null}
                error={errors.category}
                onChange={setCategoryId}
                onCreate={() => { setNameError(''); setRestoreOffer(null); setNaming(true); }}
              />
            </>
          )}
          {kind === 'sale' ? (
            <div className="form-section-note">
              Gross profit preview
              <strong>{preview === null ? 'Enter both amounts' : formatMoney(preview, currency)}</strong>
            </div>
          ) : (
            <p className="form-section-note">Other expenses are subtracted only from net profit. If shipping, packaging, or another cost is already included in a sale's direct cost, do not enter it again.</p>
          )}
          {errors.form ? <p className="form-error" role="alert">{errors.form}</p> : null}
          {discarding ? (
            <div className="form-section-note">
              Discard unsaved changes?
              <span className="actions">
                <button type="button" className="button" onClick={() => setDiscarding(false)}>Keep editing</button>
                <button type="button" className="button primary" onClick={onClose}>Discard</button>
              </span>
            </div>
          ) : null}
        </div>
        <div className="dialog-footer">
          <button type="button" className="button" onClick={requestClose} disabled={busy}>Cancel</button>
          <button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving' : kind === 'sale' ? 'Save sale' : 'Save expense'}</button>
        </div>
      </form>
    </Dialog>
    {naming ? (
      <CategoryNameDialog
        title="Add category"
        submitLabel="Save category"
        error={nameError}
        restoreName={restoreOffer ? restoreOffer.name : ''}
        onCancel={() => { setNaming(false); setRestoreOffer(null); setNameError(''); }}
        onRestore={async () => {
          const result = await commit(await window.pesabuana.restoreCategory(restoreOffer.categoryId));
          if (result.error) {
            setNameError(result.error);
            return;
          }
          setCategoryId(restoreOffer.categoryId);
          setNaming(false);
          setRestoreOffer(null);
        }}
        onSubmit={async (name) => {
          const result = await window.pesabuana.addCategory(name);
          if (result.needsRestore) {
            setRestoreOffer(result);
            setNameError('');
            return;
          }
          if (result.error) {
            setNameError(result.error);
            return;
          }
          commit(result);
          setCategoryId(result.categoryId);
          setNaming(false);
          setRestoreOffer(null);
          setNameError('');
        }}
      />
    ) : null}
    </>
  );
}

function moneyText(minor, currency) {
  const scale = 10 ** currency.exponent;
  const whole = Math.floor(minor / scale);
  const frac = minor % scale;
  return `${whole}.${String(frac).padStart(currency.exponent, '0')}`;
}

function grossPreview(saleAmount, directCost, currency) {
  if (!saleAmount.trim() || !directCost.trim()) return saleAmount.trim() || directCost.trim() ? null : 0;
  const sale = parseMoney(saleAmount, currency.exponent);
  const cost = parseMoney(directCost, currency.exponent);
  if (!sale.ok || !cost.ok) return null;
  return sale.minor - cost.minor;
}
