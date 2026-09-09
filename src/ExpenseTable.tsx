import { useRef, useState } from "react";
import { PEOPLE, type Person } from "./people";
import { expensesFor, type ExpenseStore } from "./expenses";
import { scanReceipt } from "./scanReceipt";
import { computeSplit } from "./split";
import Modal from "./Modal";
import PersonReceipt from "./PersonReceipt";
import { computeTotals, formatMoney } from "./totals";

export default function ExpenseTable({
  receiptId,
  store,
  editing,
  composing = false,
}: {
  receiptId: string;
  store: ExpenseStore;
  /** Owned by the receipt: one edit covers its description and its items. */
  editing: boolean;
  /** A receipt still being written leads with the scanner. */
  composing?: boolean;
}) {
  const { updateExpense, toggleShare, addExpense, addScannedItems, removeExpense } = store;

  const [openPerson, setOpenPerson] = useState<Person | null>(null);
  const expenses = expensesFor(store.expenses, receiptId);
  const { perPerson, grandTotal, unassigned } = computeTotals(expenses);
  const split = computeSplit(expenses);

  const fileInput = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);


  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset first, so picking the same photo twice still fires a change event.
    event.target.value = "";
    if (!file) return;

    setScanning(true);
    setScanNote(null);
    try {
      const items = await scanReceipt(file);
      if (items.length === 0) {
        setScanNote("No items found on that photo. Try a clearer shot of the receipt.");
      } else {
        addScannedItems(receiptId, items);
        setScanNote(
          `Added ${items.length} item${items.length === 1 ? "" : "s"}. Check the costs, then tick who's in.`,
        );
      }
    } catch (error) {
      setScanNote(error instanceof Error ? error.message : "Couldn't read the receipt. Try again.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      {composing && expenses.length === 0 && (
        <div className="scan-prompt">
          <button
            type="button"
            className={scanning ? "action scan-cta scanning" : "action scan-cta"}
            onClick={() => fileInput.current?.click()}
            disabled={scanning}
          >
            {scanning ? "reading receipt\u2026" : "scan a receipt"}
          </button>
          <span className="scan-prompt-note">or add the items by hand below</span>
        </div>
      )}
      <div className="ledger-scroll">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col" className="col-item">
                Item
              </th>
              <th scope="col" className="col-number">
                Cost
              </th>
              <th scope="col" className="col-number">
                Qty
              </th>
              {PEOPLE.map((person) => (
                <th scope="col" key={person} className="col-person">
                  {person}
                </th>
              ))}
              <th scope="col" className="col-remove">
                <span className="visually-hidden">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="col-item">
                  <input
                    className="cell-input"
                    readOnly={!editing}
                    value={expense.name}
                    placeholder="Untitled"
                    aria-label="Item"
                    onChange={(event) =>
                      updateExpense(expense.id, { name: event.target.value })
                    }
                  />
                </td>
                <td className="col-number">
                  <input
                    className="cell-input align-right"
                    readOnly={!editing}
                    value={expense.cost}
                    placeholder="0.00"
                    inputMode="decimal"
                    aria-label={`Cost of ${expense.name || "untitled item"}`}
                    onChange={(event) =>
                      updateExpense(expense.id, { cost: event.target.value })
                    }
                  />
                </td>
                <td className="col-number">
                  <input
                    className="cell-input align-right"
                    readOnly={!editing}
                    value={expense.quantity}
                    placeholder="1"
                    inputMode="numeric"
                    aria-label={`Quantity of ${expense.name || "untitled item"}`}
                    onChange={(event) =>
                      updateExpense(expense.id, {
                        quantity: event.target.value,
                      })
                    }
                  />
                </td>
                {PEOPLE.map((person) => (
                  <td key={person} className="col-person">
                    <input
                      type="checkbox"
                      disabled={!editing}
                      checked={expense.sharedBy[person]}
                      aria-label={`${person} shares ${expense.name || "untitled item"}`}
                      onChange={() => toggleShare(expense.id, person)}
                    />
                  </td>
                ))}
                <td className="col-remove">
                  {editing && (
                    <button
                      type="button"
                      className="remove"
                      aria-label={`Remove ${expense.name || "untitled item"}`}
                      onClick={() => removeExpense(expense.id)}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {editing && (
            <tr className="add-row-line">
              <td colSpan={4 + PEOPLE.length}>
                <div className="row-actions">
                  <button type="button" className="add-row" onClick={() => addExpense(receiptId)}>
                    + Add item
                  </button>
                  {!(composing && expenses.length === 0) && (
                    <button
                      type="button"
                      className={scanning ? "add-row scanning" : "add-row"}
                      onClick={() => fileInput.current?.click()}
                      disabled={scanning}
                    >
                      {scanning ? "Reading receipt\u2026" : "Scan a receipt"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="col-item owes-label">
                Totals
              </th>
              <td className="col-number owes-total" colSpan={2}>
                {formatMoney(grandTotal)}
              </td>
              {PEOPLE.map((person) => (
                <td key={person} className="col-person owes-amount">
                  {formatMoney(perPerson[person])}
                </td>
              ))}
              <td className="col-remove" />
            </tr>
          </tfoot>
        </table>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        className="visually-hidden"
        onChange={handleFile}
      />
      {scanNote && <p className="scan-note">{scanNote}</p>}
      {unassigned > 0 && (
        <p className="unassigned">
          {formatMoney(unassigned)} isn't checked off to anyone yet.
        </p>
      )}
      {!composing && (
      <div className="split-actions">
        <div className="person-receipts">
          <span className="person-receipts-label">receipts:</span>
          {PEOPLE.map((person) => (
            <button
              key={person}
              type="button"
              className="person-chip"
              onClick={() => setOpenPerson(person)}
            >
              {person}
            </button>
          ))}
        </div>
      </div>
      )}
      {openPerson && (
        <Modal title={`${openPerson}'s share`} onClose={() => setOpenPerson(null)}>
          <PersonReceipt split={split} person={openPerson} />
        </Modal>
      )}
    </>
  );
}
