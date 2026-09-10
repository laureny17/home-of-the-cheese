import { useState } from "react";
import { PEOPLE, type Person } from "./people";
import ExpenseTable from "./ExpenseTable";
import ReceiptHeader from "./ReceiptHeader";
import Modal from "./Modal";
import { CheckIcon, PencilIcon, TrashIcon } from "./icons";
import { expensesFor, type ExpenseStore } from "./expenses";
import { settledKey, type Receipt, type SettledSet } from "./receipts";
import { computeSplit } from "./split";
import { formatMoney } from "./totals";

/**
 * "2026-09-09" becomes "09/09/26". Built from the stored parts rather than a
 * locale, which would reorder the day and month depending on where the browser
 * thinks it is.
 */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year.slice(-2)}`;
}

export default function ReceiptCard({
  receipt,
  store,
  expanded,
  onToggle,
  onChange,
  onDelete,
  settled,
  onSettle,
}: {
  receipt: Receipt;
  store: ExpenseStore;
  expanded: boolean;
  onToggle: () => void;
  onChange: (receipt: Receipt) => void;
  onDelete: () => void;
  settled: SettledSet;
  onSettle: (debtor: Person) => void;
}) {
  const expenses = expensesFor(store.expenses, receipt.id);
  const split = computeSplit(expenses);
  const owedTo = receipt.payer;
  const shareOf = (person: Person) =>
    split.people.find((entry) => entry.person === person)?.total ?? 0;
  const label = receipt.name || "Untitled receipt";

  // Held while editing so nothing is written until the change is saved.
  const [draft, setDraft] = useState<Receipt | null>(null);
  const editing = draft !== null;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [settling, setSettling] = useState<Person | null>(null);

  function startEditing() {
    setDraft(receipt);
    // Editing covers the items too, so they need to be on screen.
    if (!expanded) onToggle();
  }

  function saveDetails() {
    if (draft) onChange(draft);
    // Rows left blank while typing are not part of the receipt.
    store.discardBlankRows(receipt.id);
    setDraft(null);
  }

  return (
    <section className={expanded ? "receipt is-open" : "receipt"}>
      <div className="receipt-top">
        <button
          type="button"
          className="receipt-arrow"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          onClick={onToggle}
        >
          <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        </button>

        {editing && draft ? (
          <ReceiptHeader draft={draft} onChange={setDraft} />
        ) : (
          <button
            type="button"
            className="receipt-summary"
            // The arrow is hidden on a phone, so the line itself carries the
            // state as well as the tap.
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <span className="receipt-title">{label}</span>
            <span className="receipt-meta">{formatDate(receipt.purchasedOn)}</span>
            <span className="receipt-total">{formatMoney(split.assignedTotal)}</span>
            {owedTo ? (
              <span className="badge">{owedTo} paid</span>
            ) : (
              <span className="badge badge-empty">No payer set</span>
            )}
          </button>
        )}

        <div className="row-end">
          {editing ? (
            <>
              <button
                type="button"
                className="action danger icon-only"
                aria-label={`Delete ${label}`}
                onClick={() => setConfirmingDelete(true)}
              >
                <span className="action-icon">
                  <TrashIcon />
                </span>
                <span className="action-label">delete</span>
              </button>
              <button
                type="button"
                className="action save icon-only"
                aria-label="Save changes"
                onClick={saveDetails}
              >
                <span className="action-icon">
                  <CheckIcon />
                </span>
                <span className="action-label">Save changes</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="action icon-action"
              aria-label={`Edit details of ${label}`}
              onClick={startEditing}
            >
              <PencilIcon />
            </button>
          )}
        </div>
      </div>

      <div className="receipt-figures">
        {PEOPLE.map((person) => (
          <span key={person} className="receipt-share">
            {person} {formatMoney(shareOf(person))}
          </span>
        ))}
      </div>

      {owedTo && (
        <div className="receipt-debts">
          {PEOPLE.filter((person) => person !== owedTo).map((person) => {
            const isSettled = settled.has(settledKey(receipt.id, person));
            return (
              <span
                key={person}
                className={isSettled ? "receipt-debt is-settled" : "receipt-debt"}
              >
                <input
                  type="checkbox"
                  className="settle-box"
                  checked={isSettled}
                  // Settling cannot be taken back, so a ticked box stays ticked.
                  disabled={isSettled || shareOf(person) <= 0}
                  aria-label={`${person} has paid ${owedTo} for ${label}`}
                  onChange={() => setSettling(person)}
                />
                {person} owes {owedTo} <strong>{formatMoney(shareOf(person))}</strong>
                {isSettled && <span className="settled-note">paid</span>}
              </span>
            );
          })}
        </div>
      )}

      {settling !== null && owedTo && (
        <Modal title="mark this as paid?" onClose={() => setSettling(null)}>
          <p className="confirm-text">
            this records that {settling} has paid {owedTo}{" "}
            <strong>{formatMoney(shareOf(settling))}</strong> for {label}, and takes it off the
            settling up. this can't be undone.
          </p>
          <div className="confirm-actions">
            <button type="button" className="action" onClick={() => setSettling(null)}>
              not yet
            </button>
            <button
              type="button"
              className="action save"
              onClick={() => {
                onSettle(settling);
                setSettling(null);
              }}
            >
              yes, paid
            </button>
          </div>
        </Modal>
      )}

      {confirmingDelete && (
        <Modal title="delete this receipt?" onClose={() => setConfirmingDelete(false)}>
          <p className="confirm-text">
            {label} and its {expenses.length} item{expenses.length === 1 ? "" : "s"} will be
            removed. this can't be undone.
          </p>
          <div className="confirm-actions">
            <button type="button" className="action" onClick={() => setConfirmingDelete(false)}>
              keep it
            </button>
            <button type="button" className="action danger-solid" onClick={onDelete}>
              delete receipt
            </button>
          </div>
        </Modal>
      )}

      {expanded && (
        <div className="receipt-body">
          <ExpenseTable receiptId={receipt.id} store={store} editing={editing} />
        </div>
      )}
    </section>
  );
}
