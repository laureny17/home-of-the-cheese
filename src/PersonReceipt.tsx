import type { Split, SplitLine } from "./split";
import type { Person } from "./people";
import { formatMoney } from "./totals";

/** "×2 · split 3 ways" — only the parts that say something. */
function lineNote(line: SplitLine): string {
  const parts: string[] = [];
  if (line.quantity !== 1) parts.push(`×${line.quantity}`);
  if (line.sharedWays > 1) parts.push(`split ${line.sharedWays} ways`);
  return parts.join(" · ");
}

/** One person's share of a receipt, item by item. */
export default function PersonReceipt({ split, person }: { split: Split; person: Person }) {
  const entry = split.people.find((candidate) => candidate.person === person);
  if (!entry) return null;

  const showSubtotal = split.hasTax || split.hasTip;

  if (entry.lines.length === 0) {
    return <p className="split-empty">nothing checked off to them on this receipt.</p>;
  }

  return (
    <>
      <ul className="split-lines">
        {entry.lines.map((line) => {
          const note = lineNote(line);
          return (
            <li className="split-line" key={line.id}>
              <span className="split-line-name">
                {line.name}
                {note !== "" && <span className="split-line-note">{note}</span>}
              </span>
              <span className="split-line-amount">{formatMoney(line.amount)}</span>
            </li>
          );
        })}
      </ul>

      <dl className="split-tally">
        {showSubtotal && (
          <div className="split-tally-row">
            <dt>items</dt>
            <dd>{formatMoney(entry.itemsSubtotal)}</dd>
          </div>
        )}
        {split.hasTax && (
          <div className="split-tally-row">
            <dt>tax</dt>
            <dd>{formatMoney(entry.tax)}</dd>
          </div>
        )}
        {split.hasTip && (
          <div className="split-tally-row">
            <dt>tip</dt>
            <dd>{formatMoney(entry.tip)}</dd>
          </div>
        )}
        <div className="split-tally-row split-tally-total">
          <dt>total</dt>
          <dd>{formatMoney(entry.total)}</dd>
        </div>
      </dl>
    </>
  );
}
