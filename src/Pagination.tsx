/** Always shown, so the controls don't appear and disappear as receipts pile up. */
export default function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Receipt pages">
      <button
        type="button"
        className="page-step"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        Previous
      </button>
      <span className="page-count">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className="page-step"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
      >
        Next
      </button>
    </nav>
  );
}
