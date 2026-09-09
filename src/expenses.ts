import { useCallback, useEffect, useRef, useState } from "react";
import { PEOPLE, type Person } from "./people";
import { supabase, type ExpenseRow } from "./supabase";

export type Expense = {
  id: string;
  receiptId: string;
  name: string;
  /** Kept as typed text so a half-written number like "3." survives a keystroke. */
  cost: string;
  quantity: string;
  sharedBy: Record<Person, boolean>;
};

export type ScannedItem = { name: string; cost: number; quantity: number };

/** Which column each person's checkbox lives in. */
const COLUMN: Record<Person, "elephant" | "labubu" | "alpaca"> = {
  Elephant: "elephant",
  Labubu: "labubu",
  Alpaca: "alpaca",
};

/** Long enough that typing a cost isn't one write per keystroke. */
const SAVE_DELAY_MS = 500;

const newId = () => crypto.randomUUID();

function noShares(): Record<Person, boolean> {
  const sharedBy = {} as Record<Person, boolean>;
  for (const person of PEOPLE) sharedBy[person] = false;
  return sharedBy;
}

export function blankExpense(receiptId: string): Expense {
  return { id: newId(), receiptId, name: "", cost: "", quantity: "1", sharedBy: noShares() };
}

/** A row nobody has put anything in: worth keeping while typing, not after. */
export const isBlankRow = (expense: Expense) =>
  expense.name.trim() === "" && expense.cost.trim() === "";

const isUntouched = isBlankRow;

/** Above this, a line is left as one row rather than flooding the table. */
const MAX_UNIT_ROWS = 20;

/**
 * A receipt line for three packs of dumplings becomes three rows, because the
 * house may not split them the same way: one shared, two taken by one person.
 * The cost from the parser is already per unit, so the money is unchanged.
 */
function unitRows(item: ScannedItem, receiptId: string): Expense[] {
  const count = Math.trunc(item.quantity);
  const asOneRow = !Number.isFinite(count) || count < 2 || count > MAX_UNIT_ROWS;
  if (asOneRow) {
    return [
      {
        id: newId(),
        receiptId,
        name: item.name,
        cost: item.cost.toFixed(2),
        quantity: String(item.quantity),
        sharedBy: noShares(),
      },
    ];
  }
  return Array.from({ length: count }, () => ({
    id: newId(),
    receiptId,
    name: item.name,
    cost: item.cost.toFixed(2),
    quantity: "1",
    sharedBy: noShares(),
  }));
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseFloat(trimmed.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function fromRow(row: ExpenseRow): Expense {
  const sharedBy = {} as Record<Person, boolean>;
  for (const person of PEOPLE) sharedBy[person] = row[COLUMN[person]] === true;
  return {
    id: row.id,
    receiptId: row.receipt_id,
    name: row.name ?? "",
    cost: row.cost === null ? "" : Number(row.cost).toFixed(2),
    quantity: row.quantity === null ? "" : String(row.quantity),
    sharedBy,
  };
}

function toRow(expense: Expense, sortOrder: number): ExpenseRow {
  const quantity = toNumberOrNull(expense.quantity);
  return {
    id: expense.id,
    name: expense.name,
    cost: toNumberOrNull(expense.cost),
    quantity: quantity === null ? null : Math.trunc(quantity),
    elephant: expense.sharedBy.Elephant,
    labubu: expense.sharedBy.Labubu,
    alpaca: expense.sharedBy.Alpaca,
    sort_order: sortOrder,
    receipt_id: expense.receiptId,
  };
}

/** Items belong to one receipt; pass null before a receipt has been chosen. */
/**
 * Every row the house has, kept in one place. The collapsed summary of a
 * receipt has to stay in step with edits made inside it, which it cannot do if
 * each receipt loads its own items separately.
 */
export function useExpenseStore() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Mirrors `expenses` synchronously so handlers can read the current list. */
  const latest = useRef<Expense[]>([]);
  /** Sort order per row, so a reload keeps the order people see on screen. */
  const order = useRef(new Map<string, number>());
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const setAll = useCallback((next: Expense[]) => {
    latest.current = next;
    setExpenses(next);
  }, []);

  const saveRow = useCallback(async (expense: Expense) => {
    const sortOrder = order.current.get(expense.id) ?? 0;
    const { error: saveError } = await supabase.from("expenses").upsert(toRow(expense, sortOrder));
    if (saveError) setError("Couldn't save that change. It's still on screen but not stored.");
    else setError(null);
  }, []);

  /** Collapses a burst of keystrokes on one row into a single write. */
  const scheduleSave = useCallback(
    (expense: Expense) => {
      const timers = saveTimers.current;
      const existing = timers.get(expense.id);
      if (existing !== undefined) clearTimeout(existing);
      timers.set(
        expense.id,
        setTimeout(() => {
          timers.delete(expense.id);
          void saveRow(expense);
        }, SAVE_DELAY_MS),
      );
    },
    [saveRow],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error: loadError } = await supabase
        .from("expenses")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (cancelled) return;

      if (loadError) {
        setError("Couldn't load the items. Check your connection and refresh.");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as ExpenseRow[];
      rows.forEach((row, index) => order.current.set(row.id, row.sort_order ?? index));
      setAll(rows.map(fromRow));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [setAll]);

  useEffect(() => {
    const pending = saveTimers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  /** Sort order runs per receipt, so one receipt's rows keep their own order. */
  const nextSortOrder = (receiptId: string) => {
    const used = latest.current
      .filter((expense) => expense.receiptId === receiptId)
      .map((expense) => order.current.get(expense.id) ?? 0);
    return used.length === 0 ? 0 : Math.max(...used) + 1;
  };

  const commit = (next: Expense[], id: string) => {
    setAll(next);
    const updated = next.find((expense) => expense.id === id);
    if (!updated) return;
    if (!order.current.has(id)) order.current.set(id, nextSortOrder(updated.receiptId));
    scheduleSave(updated);
  };

  const updateExpense = (id: string, changes: Partial<Omit<Expense, "id" | "receiptId" | "sharedBy">>) =>
    commit(
      latest.current.map((expense) => (expense.id === id ? { ...expense, ...changes } : expense)),
      id,
    );

  const toggleShare = (id: string, person: Person) =>
    commit(
      latest.current.map((expense) =>
        expense.id === id
          ? { ...expense, sharedBy: { ...expense.sharedBy, [person]: !expense.sharedBy[person] } }
          : expense,
      ),
      id,
    );

  /** Not written until it has content, so blank rows don't reach the house. */
  const addExpense = (receiptId: string): string => {
    const row = blankExpense(receiptId);
    setAll([...latest.current, row]);
    return row.id;
  };

  /** Called when editing ends: rows nobody filled in are not worth keeping. */
  const discardBlankRows = (receiptId: string) => {
    const blanks = latest.current.filter(
      (expense) => expense.receiptId === receiptId && isBlankRow(expense),
    );
    if (blanks.length === 0) return;

    const ids = new Set(blanks.map((expense) => expense.id));
    setAll(latest.current.filter((expense) => !ids.has(expense.id)));

    for (const id of ids) {
      const pending = saveTimers.current.get(id);
      if (pending !== undefined) clearTimeout(pending);
      saveTimers.current.delete(id);
      order.current.delete(id);
    }

    // Most were never written; deleting those is a harmless no-op.
    void supabase
      .from("expenses")
      .delete()
      .in("id", [...ids]);
  };

  /** Nobody is checked off on a scanned item; that's still the house's call. */
  const addScannedItems = (receiptId: string, items: ScannedItem[]) => {
    if (items.length === 0) return;

    let sortOrder = nextSortOrder(receiptId);
    const rows = items.flatMap((item) => unitRows(item, receiptId));
    for (const row of rows) order.current.set(row.id, sortOrder++);

    const current = latest.current;
    // A single empty starter row is replaced rather than left above the scan.
    const own = current.filter((expense) => expense.receiptId === receiptId);
    const startsEmpty = own.length === 1 && isUntouched(own[0]);
    const kept = startsEmpty ? current.filter((expense) => expense.id !== own[0].id) : current;
    setAll([...kept, ...rows]);

    void (async () => {
      const { error: insertError } = await supabase
        .from("expenses")
        .upsert(rows.map((row) => toRow(row, order.current.get(row.id) ?? 0)));
      if (insertError) setError("The scan is on screen but couldn't be saved.");
      else setError(null);
    })();
  };

  const removeExpense = (id: string) => {
    setAll(latest.current.filter((expense) => expense.id !== id));

    const pending = saveTimers.current.get(id);
    if (pending !== undefined) {
      clearTimeout(pending);
      saveTimers.current.delete(id);
    }
    order.current.delete(id);

    void (async () => {
      const { error: deleteError } = await supabase.from("expenses").delete().eq("id", id);
      if (deleteError) setError("Couldn't delete that row. Refresh to see what's stored.");
    })();
  };

  return {
    expenses,
    loading,
    error,
    updateExpense,
    toggleShare,
    addExpense,
    addScannedItems,
    removeExpense,
    discardBlankRows,
  };
}

export type ExpenseStore = ReturnType<typeof useExpenseStore>;

/** The rows on one receipt, in the order they were added. */
export function expensesFor(expenses: Expense[], receiptId: string): Expense[] {
  return expenses.filter((expense) => expense.receiptId === receiptId);
}
