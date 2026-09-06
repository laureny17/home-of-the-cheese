import { PEOPLE } from "./people";
import { useExpenses } from "./expenses";
import { computeTotals, formatMoney } from "./totals";

export default function ExpenseTable() {
  const { expenses, updateExpense, toggleShare, addExpense, removeExpense } =
    useExpenses();
  const { perPerson, grandTotal, unassigned } = computeTotals(expenses);

  return (
    <>
      <div className="ledger-scroll">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col" className="col-item">
                Item
              </th>
              <th scope="col" className="col-number">
                Cost
              </th>
              <th scope="col" className="col-number">
                Qty
              </th>
              {PEOPLE.map((person) => (
                <th scope="col" key={person} className="col-person">
                  {person}
                </th>
              ))}
              <th scope="col" className="col-remove">
                <span className="visually-hidden">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="col-item">
                  <input
                    className="cell-input"
                    value={expense.name}
                    placeholder="Untitled"
                    aria-label="Item"
                    onChange={(event) =>
                      updateExpense(expense.id, { name: event.target.value })
                    }
                  />
                </td>
                <td className="col-number">
                  <input
                    className="cell-input align-right"
                    value={expense.cost}
                    placeholder="0.00"
                    inputMode="decimal"
                    aria-label={`Cost of ${expense.name || "untitled item"}`}
                    onChange={(event) =>
                      updateExpense(expense.id, { cost: event.target.value })
                    }
                  />
                </td>
                <td className="col-number">
                  <input
                    className="cell-input align-right"
                    value={expense.quantity}
                    placeholder="1"
                    inputMode="numeric"
                    aria-label={`Quantity of ${expense.name || "untitled item"}`}
                    onChange={(event) =>
                      updateExpense(expense.id, {
                        quantity: event.target.value,
                      })
                    }
                  />
                </td>
                {PEOPLE.map((person) => (
                  <td key={person} className="col-person">
                    <input
                      type="checkbox"
                      checked={expense.sharedBy[person]}
                      aria-label={`${person} shares ${expense.name || "untitled item"}`}
                      onChange={() => toggleShare(expense.id, person)}
                    />
                  </td>
                ))}
                <td className="col-remove">
                  <button
                    type="button"
                    className="remove"
                    aria-label={`Remove ${expense.name || "untitled item"}`}
                    onClick={() => removeExpense(expense.id)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            <tr className="add-row-line">
              <td colSpan={4 + PEOPLE.length}>
                <button type="button" className="add-row" onClick={addExpense}>
                  + Add item
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="col-item owes-label">
                Owes
              </th>
              <td className="col-number owes-total" colSpan={2}>
                {formatMoney(grandTotal)}
              </td>
              {PEOPLE.map((person) => (
                <td key={person} className="col-person owes-amount">
                  {formatMoney(perPerson[person])}
                </td>
              ))}
              <td className="col-remove" />
            </tr>
          </tfoot>
        </table>
      </div>
      {unassigned > 0 && (
        <p className="unassigned">
          {formatMoney(unassigned)} isn't checked off to anyone yet.
        </p>
      )}
    </>
  );
}
