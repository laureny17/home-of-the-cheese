import { useState } from "react";
import { PEOPLE, type Person } from "./people";
import Modal from "./Modal";
import { InfoIcon } from "./icons";
import type { Debt } from "./settle";
import { pairwiseDebts, remainingTransfers } from "./settle";
import type { Expense } from "./expenses";
import type { Payment, Receipt, SettledSet } from "./receipts";
import { formatDate } from "./ReceiptCard";
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
function OwedInFull({ owed, paid }: { owed: Debt[]; paid: Payment[] }) {
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
      {paid.length > 0 && (
        <div className="owed-group">
          <h3 className="owed-name">paid so far</h3>
          <PaymentList payments={paid} />
        </div>
      )}
    </>
  );
}

const paidOn = (payment: Payment) =>
  formatDate(new Date(payment.createdAt).toLocaleDateString("en-CA"));

function PaymentList({ payments }: { payments: Payment[] }) {
  return (
    <ul className="settle-list">
      {payments.map((payment) => (
        <li className="settle-line" key={payment.id}>
          <span>
            <strong>{payment.from}</strong> paid <strong>{payment.to}</strong>{" "}
            <span className="payment-date">{paidOn(payment)}</span>
          </span>
          <span className="settle-amount">{formatMoney(payment.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

/** "12.5", "$12.50" and "12.50 " all mean the same; anything else is null. */
function parseAmount(value: string): number | null {
  const trimmed = value.trim().replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;
  const amount = Math.round(Number.parseFloat(trimmed) * 100) / 100;
  return amount > 0 ? amount : null;
}

/**
 * One person recording what they have sent, on their own. Who they pay comes
 * from the plan, so they can only pay someone they actually owe.
 */
function PayForm({
  transfers,
  onPay,
  onClose,
}: {
  transfers: Debt[];
  onPay: (from: Person, to: Person, amount: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [payer, setPayer] = useState<Person | null>(null);
  const [payee, setPayee] = useState<Person | null>(null);
  const [amountText, setAmountText] = useState("");
  const [saving, setSaving] = useState(false);

  const owing = payer ? transfers.filter((debt) => debt.from === payer) : [];
  const owedToPayer = payer ? transfers.filter((debt) => debt.to === payer) : [];
  const debt = owing.find((entry) => entry.to === payee) ?? null;
  const amount = parseAmount(amountText);
  // Whole cents, so the fill button's figure is never refused as too much.
  const owedInCents = debt ? Math.round(debt.amount * 100) / 100 : 0;
  const tooMuch = amount !== null && amount > owedInCents;

  function choosePayer(person: Person) {
    setPayer(person);
    const theirs = transfers.filter((entry) => entry.from === person);
    setPayee(theirs.length === 1 ? theirs[0].to : null);
    setAmountText("");
  }

  async function submit() {
    if (!payer || !payee || amount === null || tooMuch) return;
    setSaving(true);
    const saved = await onPay(payer, payee, amount);
    setSaving(false);
    if (saved) onClose();
  }

  return (
    <form
      className="pay-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="pay-label">who are you?</p>
      <div className="pay-choices">
        {PEOPLE.map((person) => (
          <button
            key={person}
            type="button"
            className={person === payer ? "person-chip is-picked" : "person-chip"}
            aria-pressed={person === payer}
            onClick={() => choosePayer(person)}
          >
            {person}
          </button>
        ))}
      </div>

      {payer && owing.length === 0 && (
        <p className="confirm-text pay-none">
          you don't owe anyone right now.
          {owedToPayer.map((entry) => (
            <span key={entry.from}>
              {" "}
              {entry.from} owes you {formatMoney(entry.amount)}.
            </span>
          ))}
        </p>
      )}

      {owing.length > 1 && (
        <>
          <p className="pay-label">who are you paying?</p>
          <div className="pay-choices">
            {owing.map((entry) => (
              <button
                key={entry.to}
                type="button"
                className={entry.to === payee ? "person-chip is-picked" : "person-chip"}
                aria-pressed={entry.to === payee}
                onClick={() => {
                  setPayee(entry.to);
                  setAmountText("");
                }}
              >
                {entry.to}
              </button>
            ))}
          </div>
        </>
      )}

      {debt && (
        <>
          <p className="pay-label">
            you owe {debt.to} <strong>{formatMoney(debt.amount)}</strong>. how much are you paying?
          </p>
          <div className="pay-amount">
            <span className="pay-currency" aria-hidden="true">
              $
            </span>
            <input
              className="pay-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              aria-label={`Amount ${debt.from} is paying ${debt.to}`}
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
            />
            <button
              type="button"
              className="action"
              onClick={() => setAmountText(owedInCents.toFixed(2))}
            >
              full amount
            </button>
          </div>
          {tooMuch && (
            <p className="pay-warning">that's more than you owe {debt.to}.</p>
          )}
          <p className="confirm-text pay-note">
            this takes it off what you owe. it can't be undone, so record it once the money has
            actually been sent.
          </p>
        </>
      )}

      <div className="confirm-actions">
        <button type="button" className="action" onClick={onClose}>
          cancel
        </button>
        <button
          type="submit"
          className="action save"
          disabled={!debt || amount === null || tooMuch || saving}
        >
          {saving ? "saving\u2026" : "record payment"}
        </button>
      </div>
    </form>
  );
}

export default function SettleSummary({
  receipts,
  expenses,
  settled,
  payments,
  onPay,
}: {
  receipts: Receipt[];
  expenses: Expense[];
  settled: SettledSet;
  payments: Payment[];
  onPay: (from: Person, to: Person, amount: number) => Promise<Payment | null>;
}) {
  const owed = pairwiseDebts(receipts, expenses, settled);
  const openPayments = payments.filter((payment) => !payment.cleared);
  const transfers = remainingTransfers(owed, openPayments);
  const [showDetail, setShowDetail] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function pay(from: Person, to: Person, amount: number): Promise<boolean> {
    return (await onPay(from, to, amount)) !== null;
  }

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

      <div className="settle-actions">
        <button type="button" className="action" onClick={() => setShowHistory(true)}>
          payment history
        </button>
        {transfers.length > 0 && (
          <button type="button" className="action save" onClick={() => setPaying(true)}>
            settle up
          </button>
        )}
      </div>

      {showHistory && (
        <Modal title="payment history" onClose={() => setShowHistory(false)}>
          {payments.length === 0 ? (
            <p className="confirm-text pay-none">
              no payments yet. ones recorded with settle up will show here.
            </p>
          ) : (
            // Every payment ever made, so it scrolls rather than growing past the screen.
            <div className="payment-history">
              <PaymentList payments={payments} />
            </div>
          )}
        </Modal>
      )}

      {paying && (
        <Modal title="settle up" onClose={() => setPaying(false)}>
          <PayForm transfers={transfers} onPay={pay} onClose={() => setPaying(false)} />
        </Modal>
      )}

      {showDetail && (
        <Modal title="before settling up" onClose={() => setShowDetail(false)}>
          <OwedInFull owed={owed} paid={openPayments} />
        </Modal>
      )}
    </section>
  );
}
