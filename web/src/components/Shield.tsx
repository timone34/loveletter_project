// A shield icon (protected by the Handmaid). Sized by font-size (1em) and
// coloured by `color`, like text.
export function Shield({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12 2.5 4 5.6v6.1c0 4.9 3.4 8.6 8 9.8 4.6-1.2 8-4.9 8-9.8V5.6L12 2.5z" />
    </svg>
  );
}
