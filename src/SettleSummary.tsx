import { useState } from "react";
import { PEOPLE, type Person } from "./people";
import Modal from "./Modal";
import { InfoIcon } from "./icons";
import type { Debt } from "./settle";
import { outstandingDebts, pairwiseDebts, settleUp } from "./settle";
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

/**
 * Every pair, netting nothing off and hiding nothing, so a figure in the
 * settled list can be traced back to where it came from.
 */
function OwedInFull({ owed }: { owed: Debt[] }) {
  const amountOwed = (from: Person, to: Person) =>
    owed.find((debt) => debt.from === from && debt.to === to)?.amount ?? 0;

  return (
    <>
      {PEOPLE.map((person) => (
        <div className="owed-group" key={person}>
          <h3 className="owed-name">{person}</h3>
          <ul className="settle-list">
            {PEOPLE.filter((other) => other !== person).map((other) => {
              const amount = amountOwed(person, other);
              return (
                <li className="settle-line" key={other}>
                  <span className={amount === 0 ? "owed-none" : undefined}>owes {other}</span>
                  <span className={amount === 0 ? "settle-amount owed-none" : "settle-amount"}>
                    {formatMoney(amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

export default function SettleSummary({
  receipts,
  expenses,
  settled,
  onSettleAll,
}: {
  receipts: Receipt[];
  expenses: Expense[];
  settled: SettledSet;
  onSettleAll: (pairs: { receiptId: string; debtor: Person }[]) => void;
}) {
  const owed = pairwiseDebts(receipts, expenses, settled);
  const transfers = settleUp(owed);
  const outstanding = outstandingDebts(receipts, expenses, settled);
  const [showDetail, setShowDetail] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const receiptCount = new Set(outstanding.map((debt) => debt.receiptId)).size;

  return (
    <section className="settle" aria-labelledby="settle-heading">
      <div className="settle-head">
        <h2 className="settle-heading" id="settle-heading">
          settling up
        </h2>
        <button
          type="button"
          className="settle-info"
          aria-label="Show what each person owes before settling up"
          onClick={() => setShowDetail(true)}
        >
          <InfoIcon />
        </button>
      </div>

      {transfers.length === 0 ? (
        <p className="settle-clear">everyone's square.</p>
      ) : (
        <ul className="settle-list">
          {transfers.map((debt) => (
            <DebtLine key={`${debt.from}-${debt.to}`} debt={debt} />
          ))}
        </ul>
      )}

      {transfers.length > 0 && (
        <div className="settle-actions">
          <button type="button" className="action save" onClick={() => setConfirming(true)}>
            we've settled up
          </button>
        </div>
      )}

      {confirming && (
        <Modal title="everyone has paid up?" onClose={() => setConfirming(false)}>
          <p className="confirm-text">
            this marks {receiptCount} receipt{receiptCount === 1 ? "" : "s"} as settled and clears
            the list. only say yes once all {transfers.length} payment
            {transfers.length === 1 ? " has" : "s have"} actually been made. this can't be undone.
          </p>
          <ul className="settle-list confirm-list">
            {transfers.map((debt) => (
              <DebtLine key={`${debt.from}-${debt.to}`} debt={debt} />
            ))}
          </ul>
          <div className="confirm-actions">
            <button type="button" className="action" onClick={() => setConfirming(false)}>
              not yet
            </button>
            <button
              type="button"
              className="action save"
              onClick={() => {
                onSettleAll(outstanding.map((debt) => ({ receiptId: debt.receiptId, debtor: debt.debtor })));
                setConfirming(false);
              }}
            >
              yes, settled
            </button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title="before settling up" onClose={() => setShowDetail(false)}>
          <OwedInFull owed={owed} />
        </Modal>
      )}
    </section>
  );
}
