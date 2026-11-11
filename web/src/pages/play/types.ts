import type { CardId } from "../../components/cardData";

export type Opponent = {
  name: string;
  avatar: string;
  detail: string;
  tilt: string;
  discard: CardId;
};

export type GameAction = {
  player: string;
  action: string;
  time: string;
  tone?: "guard" | "you";
};
