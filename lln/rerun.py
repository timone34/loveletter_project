"""Play recorded deck orders again with different bots.

    from lln import load_lln, rerun_decks

    recorded = load_lln("games/2026-11-23/CardCounter-v-3xRandomChoice_n1000.lln")
    new = rerun_decks(recorded, {"Alice": NoPrincess(), "Bob": RandomChoice(), ...}, seed=1)

Round r of game i gets the deck that round r of recorded game i had. The new
bots may need more rounds than the recording has; those extra rounds get a
seeded deck when `seed` is given (reproducible) and a normal shuffle otherwise.
"""
from __future__ import annotations

import random
from collections import deque

from engine import Card, Deck, Game, GameHistory, Observer, Strategy


class FixedDeckGame(Game):
    """A Game that deals the given deck orders, one per round, in order."""

    def __init__(
        self,
        players: dict[str, Strategy],
        decks: list[list[Card]],
        target_round_wins: int = 3,
        observers: Observer | None = None,
        deck_seed: int | str | None = None,
    ) -> None:
        super().__init__(players, target_round_wins, observers, deck_seed)
        self.decks = decks

    def _new_deck(self) -> Deck | None:
        if self.round > len(self.decks):
            return super()._new_deck()  # recording ran out: seeded or normal shuffle
        deck = Deck()
        deck.cards = [type(card)() for card in self.decks[self.round - 1]]  # fresh cards
        return deck


def rerun_decks(
    recorded: list[GameHistory],
    players: dict[str, Strategy],
    rotate_seats: bool = True,
    obs: Observer | None = None,
    seed: int | None = None,
) -> list[GameHistory]:
    """Play every recorded game again with `players`, dealing the recorded decks.

    Works like stats.simulate(): seats rotate between games (rotate_seats), and
    `seed` seeds the bots and the decks of any rounds beyond the recording.
    Each game keeps the recorded game's target_round_wins.
    """
    if seed is not None:
        random.seed(seed)

    player_order = deque(players.items())
    histories: list[GameHistory] = []

    for i, gh in enumerate(recorded):
        if len(gh.players) != len(players):
            raise ValueError(
                f"recorded game {i + 1} has {len(gh.players)} players, but {len(players)} were given"
            )
        game = FixedDeckGame(
            dict(player_order),
            decks=[rh.deck_order for rh in gh.rounds],
            target_round_wins=gh.target_round_wins,
            observers=obs,
            deck_seed=None if seed is None else f"{seed}:{i}",
        )
        game.play()
        histories.append(game.history)

        if rotate_seats:
            player_order.rotate(-1)

    return histories
