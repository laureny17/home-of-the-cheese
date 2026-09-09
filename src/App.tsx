import { useEffect, useRef } from "react";
import ExpenseTable from "./ExpenseTable";
import ReceiptHeader from "./ReceiptHeader";
import { newReceipt, useReceipts } from "./receipts";

export default function App() {
  const { receipts, loading, error, saveReceipt } = useReceipts();

  // Until the receipt list lands, the page edits the most recent receipt, and
  // makes one the first time the house opens the app.
  const creating = useRef(false);
  useEffect(() => {
    if (loading || error || receipts.length > 0 || creating.current) return;
    creating.current = true;
    void saveReceipt(newReceipt());
  }, [loading, error, receipts.length, saveReceipt]);

  const current = receipts[0];

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">home-of-the-cheese</span>
      </header>
      <main className="page">
        <h1 className="page-title">Expenses</h1>
        {error && <p className="store-status store-error">{error}</p>}
        {loading && <p className="store-status">Loading…</p>}
        {current && (
          <>
            <ReceiptHeader receipt={current} onChange={saveReceipt} />
            <ExpenseTable receiptId={current.id} />
          </>
        )}
      </main>
    </div>
  );
}
