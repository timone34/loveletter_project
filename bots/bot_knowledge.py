import random

from bots import FastCardCounterV2
from bots.bot_card_counter import CardCounterV3, Plan, kept, opponents
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


class PriestKnowledgeV2(CardCounterV3):
    """Knows what its Priest saw and what its King swaps moved, and acts on it.

    Before anything else, it looks for a sure kill with the hand it holds:
      1. a Guard on a player whose card it knows for certain (and isn't a Guard),
      2. a Baron on a player whose every possible card is lower than the one it keeps.
    Certain means the odds leave one card (or only lower ones), so card counting
    alone can make a kill sure too, e.g. when every copy of the other types is gone.
    Protected players are skipped. Otherwise it plays like CardCounterV3, except
    that a Guard goes to the player whose likeliest card is likeliest.
    """
    private_knowledge = True

    def __init__(self) -> None:
        super().__init__()
        self.id = "PriestKnowledgeV2"
        self.name = "Priest Knowledge Bot v2"
        self.description = "Plans its turn from what its Priest saw: a sure kill with a Guard or Baron first."

    def plan_turn(self, view: PlayerView, playable: list[Card]) -> Plan:
        odds = self.hand_odds(view)
        protected = {p.seat for p in view.players if p.protected}
        open_seats = [s for s in odds if s not in protected and odds[s]]

        for card in playable:  # 1. a Guard that can't miss
            if isinstance(card, Guard):
                for seat in open_seats:
                    if len(odds[seat]) == 1:
                        (card_type,) = odds[seat]
                        if card_type is not Guard:
                            return Plan(card, seat, card_type)

        for card in playable:  # 2. a Baron that can't lose or tie
            if isinstance(card, Baron):
                mine = kept(view, card).value
                for seat in open_seats:
                    if max(t.value for t in odds[seat]) < mine:
                        return Plan(card, seat)

        plan = super().plan_turn(view, playable)
        if isinstance(plan.card, Guard):  # aim the Guard where a guess is likeliest to hit
            seats = open_seats or opponents(view)
            chance = {s: max((p for t, p in odds[s].items() if t is not Guard), default=0.0) for s in seats}
            best = max(chance.values())
            target = random.choice([s for s in seats if chance[s] == best])
            plan = Plan(plan.card, target, self.best_guess(view, target))
        return plan
