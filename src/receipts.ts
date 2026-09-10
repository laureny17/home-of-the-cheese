import { useCallback, useEffect, useState } from "react";
import { PEOPLE, type Person } from "./people";
import { supabase } from "./supabase";

export type Receipt = {
  id: string;
  name: string;
  /** ISO date (YYYY-MM-DD), no time: a shop happens on a day. */
  purchasedOn: string;
  /** Null until someone records who fronted the money. */
  payer: Person | null;
};

type ReceiptRow = {
  id: string;
  name: string;
  purchased_on: string;
  payer: string | null;
};

type SettlementRow = { receipt_id: string; debtor: string };

/** Who has already squared up on a receipt, as `${receiptId}:${person}`. */
export type SettledSet = ReadonlySet<string>;

export const settledKey = (receiptId: string, person: Person) => `${receiptId}:${person}`;

const isPerson = (value: unknown): value is Person =>
  typeof value === "string" && (PEOPLE as readonly string[]).includes(value);

export const todayIso = () => new Date().toLocaleDateString("en-CA");

function fromRow(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    name: row.name ?? "",
    purchasedOn: row.purchased_on ?? todayIso(),
    payer: isPerson(row.payer) ? row.payer : null,
  };
}

export function newReceipt(): Receipt {
  return { id: crypto.randomUUID(), name: "", purchasedOn: todayIso(), payer: null };
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [settled, setSettled] = useState<SettledSet>(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [receiptResult, settlementResult] = await Promise.all([
      supabase
        .from("receipts")
        .select("id, name, purchased_on, payer")
        .order("purchased_on", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("settlements").select("receipt_id, debtor"),
    ]);

    if (receiptResult.error || settlementResult.error) {
      setError("Couldn't load receipts. Check your connection and refresh.");
      setLoading(false);
      return;
    }

    setReceipts((receiptResult.data as ReceiptRow[]).map(fromRow));
    const marks = new Set<string>();
    for (const row of settlementResult.data as SettlementRow[]) {
      if (isPerson(row.debtor)) marks.add(settledKey(row.receipt_id, row.debtor));
    }
    setSettled(marks);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveReceipt = useCallback(async (receipt: Receipt) => {
    setReceipts((current) => {
      const known = current.some((item) => item.id === receipt.id);
      const next = known
        ? current.map((item) => (item.id === receipt.id ? receipt : item))
        : [receipt, ...current];
      return next;
    });

    const { error: saveError } = await supabase.from("receipts").upsert({
      id: receipt.id,
      name: receipt.name,
      purchased_on: receipt.purchasedOn,
      payer: receipt.payer,
    });
    setError(saveError ? "Couldn't save that receipt." : null);
  }, []);

  const removeReceipt = useCallback(async (id: string) => {
    setReceipts((current) => current.filter((receipt) => receipt.id !== id));
    // Items and settlements go with it: both cascade on the foreign key.
    const { error: deleteError } = await supabase.from("receipts").delete().eq("id", id);
    if (deleteError) setError("Couldn't delete that receipt.");
  }, []);

  /**
   * One-way by design. The table has no update or delete policy, so this can
   * only ever add a row.
   */
  const markSettled = useCallback(async (receiptId: string, debtor: Person) => {
    setSettled((current) => new Set(current).add(settledKey(receiptId, debtor)));
    const { error: settleError } = await supabase
      .from("settlements")
      .insert({ receipt_id: receiptId, debtor });
    if (settleError) setError("Couldn't record that payment.");
  }, []);

  /** Squaring up the whole house at once: one row per debt being cleared. */
  const markManySettled = useCallback(async (pairs: { receiptId: string; debtor: Person }[]) => {
    if (pairs.length === 0) return;

    setSettled((current) => {
      const next = new Set(current);
      for (const pair of pairs) next.add(settledKey(pair.receiptId, pair.debtor));
      return next;
    });

    const { error: settleError } = await supabase
      .from("settlements")
      .insert(pairs.map((pair) => ({ receipt_id: pair.receiptId, debtor: pair.debtor })));
    if (settleError) setError("Couldn't record that. Refresh to see what was saved.");
  }, []);

  return {
    receipts,
    settled,
    loading,
    error,
    saveReceipt,
    removeReceipt,
    markSettled,
    markManySettled,
    reload: load,
  };
}
