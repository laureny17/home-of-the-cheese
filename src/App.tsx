import ExpenseTable from "./ExpenseTable";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">home-of-the-cheese</span>
      </header>
      <main className="page">
        <h1 className="page-title">Expenses</h1>
        <ExpenseTable />
      </main>
    </div>
  );
}
