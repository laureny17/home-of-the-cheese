import { PEOPLE, type Person } from "./people";
import type { Receipt } from "./receipts";

/** Name, date and who fronted the money for one receipt. */
export default function ReceiptHeader({
  receipt,
  onChange,
}: {
  receipt: Receipt;
  onChange: (receipt: Receipt) => void;
}) {
  return (
    <div className="receipt-header">
      <input
        className="receipt-name"
        value={receipt.name}
        placeholder="Untitled receipt"
        aria-label="Receipt name"
        onChange={(event) => onChange({ ...receipt, name: event.target.value })}
      />
      <input
        type="date"
        className="receipt-date"
        value={receipt.purchasedOn}
        aria-label="Date"
        onChange={(event) => onChange({ ...receipt, purchasedOn: event.target.value })}
      />
      <label className="receipt-payer">
        <span className="visually-hidden">Who paid</span>
        <select
          value={receipt.payer ?? ""}
          onChange={(event) =>
            onChange({ ...receipt, payer: (event.target.value || null) as Person | null })
          }
        >
          <option value="">Who paid?</option>
          {PEOPLE.map((person) => (
            <option key={person} value={person}>
              {person} paid
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
