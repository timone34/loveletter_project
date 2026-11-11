export type CardId =
  | "guard"
  | "priest"
  | "baron"
  | "handmaid"
  | "prince"
  | "king"
  | "countess"
  | "princess";

export type CardInfo = {
  id: CardId;
  value: number;
  letter: string; // the LLN letter, case-sensitive
  name: string;
  text: string;
  copies: number; // how many are in the deck
};

export const CARDS: CardInfo[] = [
  { id: "guard", value: 1, letter: "g", name: "Guard", copies: 5,
    text: "Guess someone's card. If you're correct, they're rejected." },
  { id: "priest", value: 2, letter: "p", name: "Priest", copies: 2,
    text: "Look at someone's card." },
  { id: "baron", value: 3, letter: "B", name: "Baron", copies: 2,
    text: "Compare hands with someone. The loser is rejected." },
  { id: "handmaid", value: 4, letter: "H", name: "Handmaid", copies: 2,
    text: "Become protected for one turn." },
  { id: "prince", value: 5, letter: "P", name: "Prince", copies: 2,
    text: "Make someone discard their card and draw a new one." },
  { id: "king", value: 6, letter: "K", name: "King", copies: 1,
    text: "Swap hands with someone." },
  { id: "countess", value: 7, letter: "C", name: "Countess", copies: 1,
    text: "If you have a Prince or King, you must play this card." },
  { id: "princess", value: 8, letter: "Q", name: "Princess", copies: 1,
    text: "If you play or discard this card, you're rejected." },
];

export const CARD_BY_ID = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
) as Record<CardId, CardInfo>;