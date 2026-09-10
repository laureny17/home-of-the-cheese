import { useState } from "react";
import ReceiptCard from "./ReceiptCard";
import SettleSummary from "./SettleSummary";
import Pagination from "./Pagination";
import NewReceipt from "./NewReceipt";
import { useExpenseStore } from "./expenses";
import { newReceipt, useReceipts } from "./receipts";
import { isReceiptSettled } from "./settle";

const PER_PAGE = 10;

export default function App() {
  const receiptStore = useReceipts();
  const store = useExpenseStore();
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set<string>());
  const [page, setPage] = useState(1);

  const { receipts } = receiptStore;
  const [showSettled, setShowSettled] = useState(false);

  // Squared-up receipts are kept, not deleted, but they are no longer the
  // business of the page, so they step out of the list until asked for.
  const settledReceipts = receipts.filter((receipt) =>
    isReceiptSettled(receipt, store.expenses, receiptStore.settled),
  );
  const settledIds = new Set(settledReceipts.map((receipt) => receipt.id));
  const listed = showSettled
    ? receipts
    : receipts.filter((receipt) => !settledIds.has(receipt.id));

  // Receipts are already newest first, so a page is just a slice.
  const pageCount = Math.max(1, Math.ceil(listed.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const shown = listed.slice((current - 1) * PER_PAGE, current * PER_PAGE);

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
              onSettleAll={(pairs) => void receiptStore.markManySettled(pairs)}
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
                  settled={receiptStore.settled}
                  onSettle={(debtor) => void receiptStore.markSettled(receipt.id, debtor)}
                />
              ))}
            </div>
            {listed.length === 0 && (
              <p className="store-status">
                {settledReceipts.length > 0
                  ? "everything is settled up."
                  : "no receipts yet. add one to get started."}
              </p>
            )}

            {settledReceipts.length > 0 && (
              <button
                type="button"
                className="add-row settled-toggle"
                onClick={() => {
                  setShowSettled((shown) => !shown);
                  setPage(1);
                }}
              >
                {showSettled
                  ? `hide ${settledReceipts.length} settled`
                  : `show ${settledReceipts.length} settled`}
              </button>
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
