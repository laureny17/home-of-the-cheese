import { PEOPLE, type Person } from "./people";
import { expensesFor, type Expense } from "./expenses";
import { settledKey, type Receipt, type SettledSet } from "./receipts";
import { computeSplit } from "./split";

export type Debt = { from: Person; to: Person; amount: number };

/** Below half a cent is nothing anyone can pay. */
const CENT = 0.005;

const pairKey = (from: Person, to: Person) => `${from} ${to}`;

/**
 * What each person still owes each other person, receipt by receipt and
 * without any netting. Whoever paid fronted the whole bill, so everyone else
 * on that receipt owes them their share of it.
 *
 * A receipt with no payer recorded is skipped: there is nobody to owe.
 */
export function pairwiseDebts(
  receipts: Receipt[],
  expenses: Expense[],
  settled: SettledSet,
): Debt[] {
  const totals = new Map<string, number>();

  for (const receipt of receipts) {
    const payer = receipt.payer;
    if (payer === null) continue;

    const split = computeSplit(expensesFor(expenses, receipt.id));
    for (const entry of split.people) {
      if (entry.person === payer || entry.total <= CENT) continue;
      if (settled.has(settledKey(receipt.id, entry.person))) continue;
      const key = pairKey(entry.person, payer);
      totals.set(key, (totals.get(key) ?? 0) + entry.total);
    }
  }

  const debts: Debt[] = [];
  for (const [key, amount] of totals) {
    if (amount < CENT) continue;
    const [from, to] = key.split(" ") as [Person, Person];
    debts.push({ from, to, amount });
  }
  return debts.sort((a, b) => b.amount - a.amount);
}

/**
 * Collapses those debts into the fewest payments that leave everyone square.
 * Only the net position matters: if Alpaca owes Labubu and Labubu owes
 * Elephant more, Alpaca can pay Elephant directly and Labubu is spared being
 * a go-between. With three people this is never more than two payments.
 */
export function settleUp(debts: Debt[]): Debt[] {
  const net = new Map<Person, number>(PEOPLE.map((person) => [person, 0]));
  for (const debt of debts) {
    net.set(debt.from, (net.get(debt.from) ?? 0) - debt.amount);
    net.set(debt.to, (net.get(debt.to) ?? 0) + debt.amount);
  }

  const owing = PEOPLE.filter((person) => (net.get(person) ?? 0) < -CENT).sort(
    (a, b) => (net.get(a) ?? 0) - (net.get(b) ?? 0),
  );
  const owed = PEOPLE.filter((person) => (net.get(person) ?? 0) > CENT).sort(
    (a, b) => (net.get(b) ?? 0) - (net.get(a) ?? 0),
  );

  const transfers: Debt[] = [];
  let payer = 0;
  let payee = 0;

  while (payer < owing.length && payee < owed.length) {
    const from = owing[payer];
    const to = owed[payee];
    const amount = Math.min(-(net.get(from) ?? 0), net.get(to) ?? 0);

    if (amount > CENT) {
      transfers.push({ from, to, amount });
      net.set(from, (net.get(from) ?? 0) + amount);
      net.set(to, (net.get(to) ?? 0) - amount);
    }

    if (-(net.get(from) ?? 0) <= CENT) payer += 1;
    if ((net.get(to) ?? 0) <= CENT) payee += 1;
  }

  return transfers;
}

export type OutstandingDebt = { receiptId: string; debtor: Person; owedTo: Person; amount: number };

/**
 * Every receipt-and-person still owing something, which is what a settle-up
 * clears. Netting rearranges who pays whom, so a transfer cannot be traced
 * back to receipts on its own -- confirming the whole plan settles all of it.
 */
export function outstandingDebts(
  receipts: Receipt[],
  expenses: Expense[],
  settled: SettledSet,
): OutstandingDebt[] {
  const rows: OutstandingDebt[] = [];

  for (const receipt of receipts) {
    const payer = receipt.payer;
    if (payer === null) continue;

    const split = computeSplit(expensesFor(expenses, receipt.id));
    for (const entry of split.people) {
      if (entry.person === payer || entry.total <= CENT) continue;
      if (settled.has(settledKey(receipt.id, entry.person))) continue;
      rows.push({
        receiptId: receipt.id,
        debtor: entry.person,
        owedTo: payer,
        amount: entry.total,
      });
    }
  }

  return rows;
}
