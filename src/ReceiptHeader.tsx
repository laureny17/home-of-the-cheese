import { PEOPLE, type Person } from "./people";
import DateField from "./DateField";
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
        <DateField
          value={draft.purchasedOn}
          onChange={(purchasedOn) => onChange({ ...draft, purchasedOn })}
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
