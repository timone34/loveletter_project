from bots import FastCardCounterV2
from engine.cards import *
from engine.history import Outcome
from engine.view import PlayerView


class PriestKnowledge(FastCardCounterV2):
    def __init__(self) -> None:
        super().__init__()
        self.id = "PriestKnowledge"
        self.name = "Priest Knowledge Bot"
        self.description = "Uses Priest seen info to confirm kills."
        self.debug = False

    def possible_cards(self, view: PlayerView) -> dict[int, set[type[Card]]]:
        """If I've seen a card with a Priest, and it hasn't been played after that,
        the target of that Priest can only have the card I saw."""

        possible = {seat: set(cards) for seat, cards in super().possible_cards(view).items()}
        known: dict[int, type[Card]] = {}

        for turn in view.log:
            if turn.played is None:  # skipped turn of a rejected player
                continue
            played = type(turn.played)

            # Played the known card: the hand is now the drawn card (unknown).
            if known.get(turn.seat) is played:
                del known[turn.seat]

            target = turn.target
            if target is not None and turn.outcome is not Outcome.PROTECTED:
                if turn.seen is not None:  # my Priest (others' sightings are redacted)
                    known[target] = type(turn.seen)
                elif turn.discarded is not None:  # Prince: the target redraws
                    known.pop(target, None)
                elif played is King and target != turn.seat:
                    # given: what the King player handed over, received: what they got back
                    if view.seat == turn.seat and turn.given is not None:
                        known[target] = type(turn.given)
                    elif view.seat == target and turn.received is not None:
                        known[turn.seat] = type(turn.received)
                    else:  # the knowledge moves with the cards
                        a, b = known.pop(turn.seat, None), known.pop(target, None)
                        if a is not None:
                            known[target] = a
                        if b is not None:
                            known[turn.seat] = b

        for seat, card_type in known.items():
            if seat in possible:
                possible[seat] = {card_type}

        return possible

