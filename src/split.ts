import { PEOPLE, type Person } from "./people";
import type { Expense } from "./expenses";
import { lineTotal } from "./totals";

/**
 * Tax and tip aren't things anyone "bought", so they're pulled out of the item
 * list and reported on their own. The receipt parser names them plainly, which
 * is what these match.
 */
const TAX_NAME = /\btax(es)?\b/i;
const TIP_NAME = /\btip\b|\bgratuity\b|\bservice charge\b/i;

type Surcharge = "tax" | "tip";

function surchargeOf(name: string): Surcharge | null {
  if (TAX_NAME.test(name)) return "tax";
  if (TIP_NAME.test(name)) return "tip";
  return null;
}

export type SplitLine = {
  id: string;
  name: string;
  /** How many people are on the row, so a share can be labelled as one. */
  sharedWays: number;
  /** This person's cut of the row. */
  amount: number;
};

export type PersonSplit = {
  person: Person;
  lines: SplitLine[];
  itemsSubtotal: number;
  tax: number;
  tip: number;
  total: number;
};

export type Split = {
  people: PersonSplit[];
  /** Only report a surcharge line when the receipt actually has one. */
  hasTax: boolean;
  hasTip: boolean;
  /** Money on rows nobody is checked off for, so nobody is being charged it. */
  unassigned: number;
  assignedTotal: number;
};

export function computeSplit(expenses: Expense[]): Split {
  const lines = {} as Record<Person, SplitLine[]>;
  const itemsSubtotal = {} as Record<Person, number>;
  const tax = {} as Record<Person, number>;
  const tip = {} as Record<Person, number>;
  for (const person of PEOPLE) {
    lines[person] = [];
    itemsSubtotal[person] = 0;
    tax[person] = 0;
    tip[person] = 0;
  }

  let hasTax = false;
  let hasTip = false;
  let unassigned = 0;
  // Surcharges nobody ticked, shared out by item spend once the items are in.
  const pooled = { tax: 0, tip: 0 };

  for (const expense of expenses) {
    const total = lineTotal(expense);
    if (total === 0) continue;

    const kind = surchargeOf(expense.name);
    if (kind === "tax") hasTax = true;
    if (kind === "tip") hasTip = true;

    const sharers = PEOPLE.filter((person) => expense.sharedBy[person]);

    if (kind !== null) {
      // Ticking a tax or tip row is a deliberate call, so it wins over spend.
      if (sharers.length === 0) {
        pooled[kind] += total;
        continue;
      }
      const bucket = kind === "tax" ? tax : tip;
      const share = total / sharers.length;
      for (const person of sharers) bucket[person] += share;
      continue;
    }

    if (sharers.length === 0) {
      unassigned += total;
      continue;
    }

    const share = total / sharers.length;
    const name = expense.name.trim() === "" ? "Untitled" : expense.name.trim();
    for (const person of sharers) {
      lines[person].push({ id: expense.id, name, sharedWays: sharers.length, amount: share });
      itemsSubtotal[person] += share;
    }
  }

  // Tax and tip follow what each person actually spent, not a flat third each.
  const spent = PEOPLE.reduce((sum, person) => sum + itemsSubtotal[person], 0);
  for (const kind of ["tax", "tip"] as const) {
    const amount = pooled[kind];
    if (amount === 0) continue;
    if (spent === 0) {
      // Nothing to weigh it against, so it stays on the unassigned pile.
      unassigned += amount;
      continue;
    }
    const bucket = kind === "tax" ? tax : tip;
    for (const person of PEOPLE) bucket[person] += amount * (itemsSubtotal[person] / spent);
  }

  const people = PEOPLE.map((person) => ({
    person,
    lines: lines[person],
    itemsSubtotal: itemsSubtotal[person],
    tax: tax[person],
    tip: tip[person],
    total: itemsSubtotal[person] + tax[person] + tip[person],
  }));

  return {
    people,
    hasTax,
    hasTip,
    unassigned,
    assignedTotal: people.reduce((sum, person) => sum + person.total, 0),
  };
}
