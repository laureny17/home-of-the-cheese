import { PEOPLE, type Person } from "./people";
import type { Expense } from "./expenses";

const toNumber = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Quantity defaults to 1 so an item with a cost still counts before you fill it in. */
export function lineQuantity(expense: Expense): number {
  return expense.quantity.trim() === "" ? 1 : toNumber(expense.quantity);
}

export function lineTotal(expense: Expense): number {
  return toNumber(expense.cost) * lineQuantity(expense);
}

export type Totals = {
  perPerson: Record<Person, number>;
  grandTotal: number;
  /** Money on items nobody has checked off yet. */
  unassigned: number;
};

export function computeTotals(expenses: Expense[]): Totals {
  const perPerson = {} as Record<Person, number>;
  for (const person of PEOPLE) perPerson[person] = 0;

  let grandTotal = 0;
  let unassigned = 0;

  for (const expense of expenses) {
    const total = lineTotal(expense);
    if (total === 0) continue;
    grandTotal += total;

    const sharers = PEOPLE.filter((person) => expense.sharedBy[person]);
    if (sharers.length === 0) {
      unassigned += total;
      continue;
    }

    const share = total / sharers.length;
    for (const person of sharers) perPerson[person] += share;
  }

  return { perPerson, grandTotal, unassigned };
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const formatMoney = (amount: number) => currency.format(amount);
