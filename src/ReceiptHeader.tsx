import { PEOPLE, type Person } from "./people";
import type { Receipt } from "./receipts";

/**
 * The editable form of the first line. Every control is sized to match the
 * static text it replaces, so switching into editing doesn't move the line.
 */
export default function ReceiptHeader({
  draft,
  onChange,
}: {
  draft: Receipt;
  onChange: (receipt: Receipt) => void;
}) {
  return (
    <>
      <input
        className="receipt-name"
        value={draft.name}
        placeholder="Untitled receipt"
        aria-label="Receipt name"
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
      />
      <div className="receipt-meta-fields">
        <input
          type="date"
          className="receipt-date"
          value={draft.purchasedOn}
          aria-label="Date"
          onChange={(event) =>
            onChange({ ...draft, purchasedOn: event.target.value })
          }
        />
        <select
          className="receipt-payer"
          value={draft.payer ?? ""}
          aria-label="Who paid"
          onChange={(event) =>
            onChange({
              ...draft,
              payer: (event.target.value || null) as Person | null,
            })
          }
        >
          <option value="">Who paid?</option>
          {PEOPLE.map((person) => (
            <option key={person} value={person}>
              {person} paid
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
