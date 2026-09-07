import { useEffect, useState } from "react";
import { PEOPLE, type Person } from "./people";

export type Expense = {
  id: string;
  name: string;
  /** Kept as typed text so a half-written number like "3." survives a keystroke. */
  cost: string;
  quantity: string;
  sharedBy: Record<Person, boolean>;
};

const STORAGE_KEY = "home-of-the-cheese.expenses";

const newId = () => Math.random().toString(36).slice(2, 10);

export function blankExpense(): Expense {
  const sharedBy = {} as Record<Person, boolean>;
  for (const person of PEOPLE) sharedBy[person] = false;
  return { id: newId(), name: "", cost: "", quantity: "1", sharedBy };
}

/** Trusts nothing from storage: a hand-edited or stale entry falls back to a blank row. */
function reviveExpense(raw: unknown): Expense | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const stored = (value.sharedBy ?? {}) as Record<string, unknown>;
  const sharedBy = {} as Record<Person, boolean>;
  for (const person of PEOPLE) sharedBy[person] = stored[person] === true;
  return {
    id: typeof value.id === "string" ? value.id : newId(),
    name: typeof value.name === "string" ? value.name : "",
    cost: typeof value.cost === "string" ? value.cost : "",
    quantity: typeof value.quantity === "string" ? value.quantity : "1",
    sharedBy,
  };
}

function loadExpenses(): Expense[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [blankExpense()];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [blankExpense()];
    const expenses = parsed.map(reviveExpense).filter((e): e is Expense => e !== null);
    return expenses.length > 0 ? expenses : [blankExpense()];
  } catch {
    return [blankExpense()];
  }
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>(loadExpenses);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    } catch {
      // Storage can be full or blocked; the table still works for this session.
    }
  }, [expenses]);

  const updateExpense = (id: string, changes: Partial<Omit<Expense, "id" | "sharedBy">>) =>
    setExpenses((current) =>
      current.map((expense) => (expense.id === id ? { ...expense, ...changes } : expense)),
    );

  const toggleShare = (id: string, person: Person) =>
    setExpenses((current) =>
      current.map((expense) =>
        expense.id === id
          ? { ...expense, sharedBy: { ...expense.sharedBy, [person]: !expense.sharedBy[person] } }
          : expense,
      ),
    );

  const addExpense = () => setExpenses((current) => [...current, blankExpense()]);

  const removeExpense = (id: string) =>
    setExpenses((current) => {
      const remaining = current.filter((expense) => expense.id !== id);
      return remaining.length > 0 ? remaining : [blankExpense()];
    });

  return { expenses, updateExpense, toggleShare, addExpense, removeExpense };
}
