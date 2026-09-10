import { useState } from "react";
import { PEOPLE, type Person } from "./people";
import DateField from "./DateField";
import ExpenseTable from "./ExpenseTable";
import { expensesFor, type ExpenseStore } from "./expenses";
import type { Receipt } from "./receipts";
import { formatMoney } from "./totals";
import { computeTotals } from "./totals";

/**
 * Writing a receipt down is a different job from reading one back, so it gets
 * its own view: every field open, the scanner first, and one way out.
 */
export default function NewReceipt({
  receipt,
  store,
  onChange,
  onDone,
  onDiscard,
}: {
  receipt: Receipt;
  store: ExpenseStore;
  onChange: (receipt: Receipt) => void;
  onDone: () => void;
  onDiscard: () => void;
}) {
  const [draft, setDraft] = useState<Receipt>(receipt);
  const items = expensesFor(store.expenses, receipt.id);
  const { grandTotal } = computeTotals(items);

  function update(next: Receipt) {
    setDraft(next);
    onChange(next);
  }

  return (
    <section className="composer" aria-labelledby="composer-heading">
      <div className="composer-top">
        <h2 className="composer-heading" id="composer-heading">
          new receipt
        </h2>
        <div className="row-end">
          <button type="button" className="action" onClick={onDiscard}>
            discard
          </button>
          <button
            type="button"
            className="action save"
            onClick={() => {
              store.discardBlankRows(receipt.id);
              onDone();
            }}
          >
            done
          </button>
        </div>
      </div>

      <div className="composer-fields">
        <label className="field">
          <span className="field-label">what was it</span>
          <input
            className="field-input"
            value={draft.name}
            placeholder="trader joe's"
            onChange={(event) => update({ ...draft, name: event.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">when</span>
          <DateField
            className="field-input"
            value={draft.purchasedOn}
            onChange={(purchasedOn) => update({ ...draft, purchasedOn })}
          />
        </label>
        <label className="field">
          <span className="field-label">who paid</span>
          <select
            className="field-input"
            value={draft.payer ?? ""}
            onChange={(event) =>
              update({ ...draft, payer: (event.target.value || null) as Person | null })
            }
          >
            <option value="">nobody yet</option>
            {PEOPLE.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ExpenseTable receiptId={receipt.id} store={store} editing composing />

      <p className="composer-total">
        {items.length === 0
          ? "nothing on it yet."
          : `${items.length} item${items.length === 1 ? "" : "s"}, ${formatMoney(grandTotal)}`}
      </p>
    </section>
  );
}
