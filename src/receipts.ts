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

/** Money one person has sent another toward what they owe. */
export type Payment = {
  id: string;
  from: Person;
  to: Person;
  amount: number;
  /** ISO timestamp. */
  createdAt: string;
  /** Once the house is square the receipts it paid for are settled, and it stops counting. */
  cleared: boolean;
};

type PaymentRow = {
  id: string;
  from_person: string;
  to_person: string;
  amount: number | string;
  created_at: string;
  cleared_at: string | null;
};

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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [receiptResult, settlementResult, paymentResult] = await Promise.all([
      supabase
        .from("receipts")
        .select("id, name, purchased_on, payer")
        .order("purchased_on", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("settlements").select("receipt_id, debtor"),
      supabase
        .from("payments")
        .select("id, from_person, to_person, amount, created_at, cleared_at")
        .order("created_at", { ascending: false }),
    ]);

    if (receiptResult.error || settlementResult.error || paymentResult.error) {
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
    setPayments(
      (paymentResult.data as PaymentRow[]).flatMap((row): Payment[] => {
        if (!isPerson(row.from_person) || !isPerson(row.to_person)) return [];
        return [
          {
            id: row.id,
            from: row.from_person,
            to: row.to_person,
            amount: Number(row.amount),
            createdAt: row.created_at,
            cleared: row.cleared_at !== null,
          },
        ];
      }),
    );
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

  /** Like settling, one-way: the table has no update or delete policy. */
  const recordPayment = useCallback(
    async (from: Person, to: Person, amount: number): Promise<Payment | null> => {
      const payment: Payment = {
        id: crypto.randomUUID(),
        from,
        to,
        amount,
        createdAt: new Date().toISOString(),
        cleared: false,
      };
      const { error: payError } = await supabase
        .from("payments")
        .insert({ id: payment.id, from_person: from, to_person: to, amount });
      if (payError) {
        setError("Couldn't record that payment. Try again.");
        return null;
      }
      setPayments((current) => [payment, ...current]);
      setError(null);
      return payment;
    },
    [],
  );

  /**
   * Once the payments leave everyone square, the receipts they covered are
   * marked settled and the payments cleared in one transaction, so the same
   * money is never counted twice.
   */
  const squareUp = useCallback(
    async (pairs: { receiptId: string; debtor: Person }[], paymentIds: string[]) => {
      const { error: squareError } = await supabase.rpc("square_up", {
        pairs,
        payment_ids: paymentIds,
      });
      if (squareError) {
        setError("Everyone's square, but the receipts couldn't be marked settled. Refresh to retry.");
        return;
      }

      const clearing = new Set(paymentIds);
      setSettled((current) => {
        const next = new Set(current);
        for (const pair of pairs) next.add(settledKey(pair.receiptId, pair.debtor));
        return next;
      });
      setPayments((current) =>
        current.map((payment) => (clearing.has(payment.id) ? { ...payment, cleared: true } : payment)),
      );
    },
    [],
  );

  return {
    receipts,
    settled,
    payments,
    loading,
    error,
    saveReceipt,
    removeReceipt,
    markSettled,
    recordPayment,
    squareUp,
    reload: load,
  };
}
