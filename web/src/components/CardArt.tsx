// Sharp-edged silhouettes drawn in a 100x130 box with currentColor,
// so the card decides whether they render white or black.
// To add a character: add it to CardKind and give it an entry in SHAPES.

export type CardKind =
  | "guard"
  | "priest"
  | "baron"
  | "handmaid"
  | "prince"
  | "king"
  | "countess"
  | "princess";

const SHAPES: Record<CardKind, string[]> = {
  // Shield with a hollow centre and a diamond inside it
  guard: [
    "M50 12 L86 26 V70 L50 118 L14 70 V26 Z M50 30 L70 38 V66 L50 94 L30 66 V38 Z M50 46 L58 62 L50 78 L42 62 Z",
  ],
  // Bishop's mitre with a cross cut out of it
  priest: [
    "M50 10 L80 60 L74 100 L26 100 L20 60 Z M47 32 H53 V44 H65 V50 H53 V78 H47 V50 H35 V44 H47 Z",
    "M16 108 H84 V118 H16 Z",
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
  // Apron bow: two wings, a knot and two tails
  handmaid: [
    "M50 62 L10 38 V86 Z",
    "M50 62 L90 38 V86 Z",
    "M43 52 H57 V72 H43 Z",
    "M45 76 L30 118 L47 106 Z",
    "M55 76 L70 118 L53 106 Z",
  ],
  // Crown and band
  prince: [
    "M14 96 L8 42 L34 64 L50 26 L66 64 L92 42 L86 96 Z",
    "M14 104 H86 V116 H14 Z",
  ],
  // Crown with a cross on top
  king: [
    "M14 100 L8 62 L32 80 L50 50 L68 80 L92 62 L86 100 Z",
    "M46 12 H54 V22 H64 V30 H54 V44 H46 V30 H36 V22 H46 Z",
    "M14 108 H86 V118 H14 Z",
  ],
  // Cut gemstone with a girdle slit and a facet
  countess: [
    "M30 20 H70 L92 50 L50 116 L8 50 Z M12 52 H88 L86 56 H14 Z M40 50 L50 28 L60 50 Z",
  ],
  // Angular heart
  princess: [
    "M50 112 L10 62 L10 34 L26 18 L40 18 L50 30 L60 18 L74 18 L90 34 L90 62 Z",
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

// A love letter: the emblem on the back of every card.
export function EnvelopeArt({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 24 H90 V80 H10 Z M17 31 L50 58 L83 31 V38 L50 65 L17 38 Z" />
    </svg>
  );
}