/** Classic pencil, drawn to sit on the same 16px grid as the arrow. */
export function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M11.6 1.9a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2l-7.7 7.7-3 1 1-3 7.2-8.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="m10.4 3.2 2.4 2.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** Grey circled i, for opening the unnetted detail. */
export function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
      <path d="M8 7.1v4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
