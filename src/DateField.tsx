import { useEffect, useState } from "react";

/**
 * A date typed as mm/dd/yy.
 *
 * An <input type="date"> looked different on every browser -- mm/dd/yyyy on
 * one, a written-out month on a phone -- and none of that can be styled. This
 * keeps the stored value as ISO and shows the same six digits everywhere.
 */
export function isoToDisplay(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year.slice(-2)}`;
}

/** Returns null when it isn't a date yet, so half-typed input isn't stored. */
export function displayToIso(text: string): string | null {
  const parts = text.split(/[/\-.\s]+/).filter(Boolean);
  if (parts.length !== 3) return null;

  const [rawMonth, rawDay, rawYear] = parts;
  if (!/^\d{1,2}$/.test(rawMonth) || !/^\d{1,2}$/.test(rawDay)) return null;
  if (!/^\d{2}$|^\d{4}$/.test(rawYear)) return null;

  const month = Number(rawMonth);
  const day = Number(rawDay);
  // Two digits mean this century; nobody is filing a receipt from 1998.
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Rejects the 31st of a 30-day month rather than rolling into the next one.
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function DateField({
  value,
  onChange,
  className = "receipt-date",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  return (
    <input
      className={className}
      inputMode="numeric"
      placeholder="mm/dd/yy"
      aria-label="Date"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const iso = displayToIso(text);
        // Nonsense reverts rather than silently storing a wrong day.
        if (iso === null) setText(isoToDisplay(value));
        else onChange(iso);
      }}
    />
  );
}
