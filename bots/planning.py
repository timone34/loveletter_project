from collections.abc import Sequence

from engine.cards import *
from engine.strategy import Action
from engine.view import PlayerView


def opponent_seats(view: PlayerView) -> list[int]:
    return [p.seat for p in view.players if p.seat != view.seat and not p.rejected]


def playable_types(hand: Sequence[Card]) -> list[type[Card]]:
    types = list(dict.fromkeys(type(card) for card in hand))  # uniek, volgorde blijft
    if Countess in types and (Prince in types or King in types):
        return [Countess]
    return types


def targets(view: PlayerView, card: type[Card]) -> Sequence[int | None]:
    if not card.targeted:
        return [None]  # no target
    seats = opponent_seats(view)
    return seats + [view.seat] if card.self_target else seats


def guesses(card: type[Card]) -> Sequence[type[Card] | None]:
    return GUESSABLE_TYPES if card is Guard else [None]  # [None]: no guess


def legal_actions(view: PlayerView) -> list[Action]:
    return [
        Action(card, target, guess)
        for card in playable_types(view.hand)
        for target in targets(view, card)
        for guess in guesses(card)
    ]
