// A heart icon (round wins). Sized by font-size (1em) and coloured by `color`,
// like text. filled = a round won; outline = still to win.
export function Heart({ filled = true, className = "" }: { filled?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
    >
      <path d="M12 20.5s-7.6-4.6-9.6-9.4C1 7.7 3.2 4 6.8 4c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.6 0 5.8 3.7 4.4 7.1-2 4.8-9.6 9.4-9.6 9.4z" />
    </svg>
  );
}
