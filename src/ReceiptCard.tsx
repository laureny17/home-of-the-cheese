import { useState } from "react";
import { PEOPLE, type Person } from "./people";
import ExpenseTable from "./ExpenseTable";
import ReceiptHeader from "./ReceiptHeader";
import { PencilIcon } from "./icons";
import { expensesFor, type ExpenseStore } from "./expenses";
import type { Receipt } from "./receipts";
import { computeSplit } from "./split";
import { formatMoney } from "./totals";

/** "2026-09-09" → "9 Sep 2026", without dragging in a date library. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ReceiptCard({
  receipt,
  store,
  expanded,
  onToggle,
  onChange,
}: {
  receipt: Receipt;
  store: ExpenseStore;
  expanded: boolean;
  onToggle: () => void;
  onChange: (receipt: Receipt) => void;
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

  function startEditing() {
    setDraft(receipt);
    if (!expanded) onToggle();
  }

  function saveDetails() {
    if (draft) onChange(draft);
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
          <>
            <ReceiptHeader draft={draft} onChange={setDraft} />
            {/* Not editable, but kept on the line so all three states read
                title, date, total. */}
            <span className="receipt-total">{formatMoney(split.assignedTotal)}</span>
          </>
        ) : (
          <button type="button" className="receipt-summary" onClick={onToggle}>
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

        {editing ? (
          <button type="button" className="action save" onClick={saveDetails}>
            Save changes
          </button>
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

      <div className="receipt-figures">
        {PEOPLE.map((person) => (
          <span key={person} className="receipt-share">
            {person} {formatMoney(shareOf(person))}
          </span>
        ))}
      </div>

      {owedTo && (
        <div className="receipt-debts">
          {PEOPLE.filter((person) => person !== owedTo).map((person) => (
            <span key={person} className="receipt-debt">
              {person} owes {owedTo} <strong>{formatMoney(shareOf(person))}</strong>
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="receipt-body">
          <ExpenseTable receiptId={receipt.id} store={store} />
        </div>
      )}
    </section>
  );
}
