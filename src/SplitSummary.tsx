import { useState } from "react";
import { formatMoney } from "./totals";
import type { Split, SplitLine } from "./split";

/** "×2 · split 3 ways" — only the parts that say something. */
function lineNote(line: SplitLine): string {
  const parts: string[] = [];
  if (line.quantity !== 1) parts.push(`×${line.quantity}`);
  if (line.sharedWays > 1) parts.push(`split ${line.sharedWays} ways`);
  return parts.join(" · ");
}

export default function SplitSummary({ split }: { split: Split }) {
  const showSubtotal = split.hasTax || split.hasTip;
  // Closed to begin with: the totals are the answer, the lines are the workings.
  const [openPeople, setOpenPeople] = useState<ReadonlySet<string>>(new Set<string>());

  const toggle = (person: string) =>
    setOpenPeople((current) => {
      const next = new Set(current);
      if (next.has(person)) next.delete(person);
      else next.add(person);
      return next;
    });

  return (
    <section className="split" aria-labelledby="split-heading">
      <h2 className="split-heading" id="split-heading">
        Who owes what
      </h2>

      {split.people.map((entry) => {
        const open = openPeople.has(entry.person);
        return (
          <article className={open ? "split-person is-open" : "split-person"} key={entry.person}>
            <button
              type="button"
              className="split-person-head"
              aria-expanded={open}
              onClick={() => toggle(entry.person)}
            >
              <span className="receipt-arrow" aria-hidden="true">
                {open ? "\u25be" : "\u25b8"}
              </span>
              <h3 className="split-name">{entry.person}</h3>
              <span className="split-person-total">{formatMoney(entry.total)}</span>
            </button>

            {open && (
              <div className="split-person-body">
                {entry.lines.length === 0 ? (
                  <p className="split-empty">Nothing checked off to them yet.</p>
                ) : (
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
                )}

                <dl className="split-tally">
                  {showSubtotal && (
                    <div className="split-tally-row">
                      <dt>Items</dt>
                      <dd>{formatMoney(entry.itemsSubtotal)}</dd>
                    </div>
                  )}
                  {split.hasTax && (
                    <div className="split-tally-row">
                      <dt>Tax</dt>
                      <dd>{formatMoney(entry.tax)}</dd>
                    </div>
                  )}
                  {split.hasTip && (
                    <div className="split-tally-row">
                      <dt>Tip</dt>
                      <dd>{formatMoney(entry.tip)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </article>
        );
      })}

      <p className="split-footnote">
        {formatMoney(split.assignedTotal)} split across {split.people.length} people.
        {split.unassigned > 0 &&
          ` ${formatMoney(split.unassigned)} is left out — nobody is checked off for it.`}
      </p>
    </section>
  );
}
