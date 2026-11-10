// Sharp-edged silhouettes drawn in a 100x130 box with currentColor,
// so the card decides whether they render white or black.
// To add a character: add it to CardKind and give it an entry in SHAPES.

export type CardKind = "guard" | "prince" | "baron";

const SHAPES: Record<CardKind, string[]> = {
  // Shield with a hollow centre and a diamond inside it
  guard: [
    "M50 12 L86 26 V70 L50 118 L14 70 V26 Z M50 30 L70 38 V66 L50 94 L30 66 V38 Z M50 46 L58 62 L50 78 L42 62 Z",
  ],
  // Crown and band
  prince: [
    "M14 96 L8 42 L34 64 L50 26 L66 64 L92 42 L86 96 Z",
    "M14 104 H86 V116 H14 Z",
  ],
  // Balance scale (the Baron compares hands)
  baron: [
    "M50 24 L60 40 L50 56 L40 40 Z",
    "M47 52 H53 V108 H47 Z",
    "M30 108 H70 L76 118 H24 Z",
    "M10 48 L90 34 V42 L10 56 Z",
    "M14 55 L1 90 H27 Z",
    "M86 41 L73 76 H99 Z",
  ],
};

type Props = { kind: CardKind; className?: string };

export function CardArt({ kind, className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 130"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[kind].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}