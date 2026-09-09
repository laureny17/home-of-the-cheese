import { useState } from "react";
import ReceiptCard from "./ReceiptCard";
import SettleSummary from "./SettleSummary";
import Pagination from "./Pagination";
import NewReceipt from "./NewReceipt";
import { useExpenseStore } from "./expenses";
import { newReceipt, useReceipts } from "./receipts";

const PER_PAGE = 10;

export default function App() {
  const receiptStore = useReceipts();
  const store = useExpenseStore();
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set<string>());
  const [page, setPage] = useState(1);

  const { receipts } = receiptStore;
  // Receipts are already newest first, so a page is just a slice.
  const pageCount = Math.max(1, Math.ceil(receipts.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const shown = receipts.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const loading = receiptStore.loading || store.loading;
  const error = receiptStore.error ?? store.error;

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The row exists from the start so scanned items have something to attach to.
  const [composingId, setComposingId] = useState<string | null>(null);
  const composing = receipts.find((receipt) => receipt.id === composingId) ?? null;

  async function addReceipt() {
    const receipt = newReceipt();
    setPage(1);
    await receiptStore.saveReceipt(receipt);
    setComposingId(receipt.id);
  }

  async function discardReceipt(id: string) {
    setComposingId(null);
    await receiptStore.removeReceipt(id);
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

        {!loading && composing && (
          <NewReceipt
            receipt={composing}
            store={store}
            onChange={receiptStore.saveReceipt}
            onDone={() => setComposingId(null)}
            onDiscard={() => void discardReceipt(composing.id)}
          />
        )}

        {!loading && !composing && (
          <>
            <SettleSummary
              receipts={receipts}
              expenses={store.expenses}
              settled={receiptStore.settled}
            />
            <div className="receipt-list">
              {shown.map((receipt) => (
                <ReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  store={store}
                  expanded={openIds.has(receipt.id)}
                  onToggle={() => toggle(receipt.id)}
                  onChange={receiptStore.saveReceipt}
                  onDelete={() => void receiptStore.removeReceipt(receipt.id)}
                />
              ))}
            </div>
            {receipts.length === 0 && (
              <p className="store-status">No receipts yet. Add one to get started.</p>
            )}
            <button type="button" className="add-row add-receipt" onClick={() => void addReceipt()}>
              + New receipt
            </button>
            <Pagination page={current} pageCount={pageCount} onChange={setPage} />
          </>
        )}
      </main>
    </div>
  );
}
