"""FastCardCounterV2 must give exactly CardCounterV2's odds, just faster."""
from __future__ import annotations

import pytest

from bots import CardCounterV2, FastCardCounterV2, RandomChoice
from engine.cards import Baron
from bots.knowledge import Knowledge
from stats import iter_games


class Knowing(FastCardCounterV2):  # Knowledge switched on, so some hands are narrowed down
    def possible_cards(self, view):
        knowledge = Knowledge.from_view(view, private=True, missed_guesses=True)
        return {seat: set(types) for seat, types in knowledge.possible.items()}


class CheckedOdds(Knowing):
    """Plays like Knowing, and compares its fast odds with CardCounterV2's slow
    ones every turn."""
    def __init__(self) -> None:
        super().__init__()
        self.id = "CheckedOdds"
        self.slow = CardCounterV2()
        self.checks = 0

    def choose_card(self, player, playable):
        view = player.view
        assert view is not None
        possible = self.possible_cards(view)
        self.slow.possible_cards = lambda view: possible  # the same knowledge, the slow way
        fast, slow = self.hand_odds(view), self.slow.hand_odds(view)
        assert fast.keys() == slow.keys()
        for seat in fast:
            assert fast[seat].keys() == slow[seat].keys()
            for card_type, p in fast[seat].items():
                assert p == pytest.approx(slow[seat][card_type], abs=1e-12)
        self.checks += 1
        return super().choose_card(player, playable)


def test_fast_odds_are_card_counter_v2_odds():
    bot = CheckedOdds()
    lineup = {"Ann": bot, "Ben": FastCardCounterV2(), "Cat": RandomChoice(), "Dan": RandomChoice()}
    for _ in iter_games(100, lineup, seed="odds"):
        pass
    assert bot.checks > 500


class Narrowed(FastCardCounterV2):
    """Narrows every opponent to 'anything but a Baron', so the loop is used."""
    def possible_cards(self, view):
        return {seat: types - {Baron} for seat, types in super().possible_cards(view).items()}


def test_narrowed_hand_odds_is_card_counter_v2_loop():
    """FastCardCounterV2's copy of the loop gives CardCounterV2's odds."""
    bot, slow = Narrowed(), CardCounterV2()
    checked = 0

    class Check(Narrowed):
        def choose_card(self, player, playable):
            nonlocal checked
            view = player.view
            assert view is not None
            possible = self.possible_cards(view)
            slow.possible_cards = lambda view: possible
            assert self.hand_odds(view) == slow.hand_odds(view)
            checked += 1
            return super().choose_card(player, playable)

    for _ in iter_games(30, {"Ann": Check(), "Ben": bot, "Cat": RandomChoice(), "Dan": RandomChoice()}, seed="narrowed"):
        pass
    assert checked > 100
