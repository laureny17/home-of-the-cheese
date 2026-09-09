import type { Debt } from "./settle";
import { pairwiseDebts, settleUp } from "./settle";
import type { Expense } from "./expenses";
import type { Receipt, SettledSet } from "./receipts";
import { formatMoney } from "./totals";

function DebtLine({ debt }: { debt: Debt }) {
  return (
    <li className="settle-line">
      <span>
        <strong>{debt.from}</strong> pays <strong>{debt.to}</strong>
      </span>
      <span className="settle-amount">{formatMoney(debt.amount)}</span>
    </li>
  );
}

export default function SettleSummary({
  receipts,
  expenses,
  settled,
}: {
  receipts: Receipt[];
  expenses: Expense[];
  settled: SettledSet;
}) {
  const owed = pairwiseDebts(receipts, expenses, settled);
  const transfers = settleUp(owed);

  // With nothing to net off, the settled list is already the full picture, and
  // repeating it underneath reads as a mistake rather than as detail.
  const sameAsNetted =
    owed.length === transfers.length &&
    owed.every((debt) =>
      transfers.some(
        (transfer) =>
          transfer.from === debt.from &&
          transfer.to === debt.to &&
          Math.abs(transfer.amount - debt.amount) < 0.005,
      ),
    );

  return (
    <section className="settle" aria-labelledby="settle-heading">
      <h2 className="settle-heading" id="settle-heading">
        Settling up
      </h2>

      {transfers.length === 0 ? (
        <p className="settle-clear">Everyone's square.</p>
      ) : (
        <ul className="settle-list">
          {transfers.map((debt) => (
            <DebtLine key={`${debt.from}-${debt.to}`} debt={debt} />
          ))}
        </ul>
      )}

      {owed.length > 0 && !sameAsNetted && (
        <div className="settle-detail">
          <h3 className="settle-subheading">Before settling up</h3>
          <ul className="settle-list">
            {owed.map((debt) => (
              <DebtLine key={`${debt.from}-${debt.to}`} debt={debt} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
