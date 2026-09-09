import { useState } from "react";
import ReceiptCard from "./ReceiptCard";
import SettleSummary from "./SettleSummary";
import { useExpenseStore } from "./expenses";
import { newReceipt, useReceipts } from "./receipts";

export default function App() {
  const receiptStore = useReceipts();
  const store = useExpenseStore();
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set<string>());

  const loading = receiptStore.loading || store.loading;
  const error = receiptStore.error ?? store.error;

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function addReceipt() {
    const receipt = newReceipt();
    await receiptStore.saveReceipt(receipt);
    // A new receipt has nothing in it, so open it ready to be filled in.
    setOpenIds((current) => new Set(current).add(receipt.id));
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">home-of-the-cheese</span>
      </header>
      <main className="page">
        <h1 className="page-title">Expenses</h1>
        {error && <p className="store-status store-error">{error}</p>}
        {loading && <p className="store-status">Loading…</p>}

        {!loading && (
          <>
            <SettleSummary
              receipts={receiptStore.receipts}
              expenses={store.expenses}
              settled={receiptStore.settled}
            />
            <div className="receipt-list">
              {receiptStore.receipts.map((receipt) => (
                <ReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  store={store}
                  expanded={openIds.has(receipt.id)}
                  onToggle={() => toggle(receipt.id)}
                  onChange={receiptStore.saveReceipt}
                />
              ))}
            </div>
            {receiptStore.receipts.length === 0 && (
              <p className="store-status">No receipts yet. Add one to get started.</p>
            )}
            <button type="button" className="add-row add-receipt" onClick={() => void addReceipt()}>
              + New receipt
            </button>
          </>
        )}
      </main>
    </div>
  );
}
