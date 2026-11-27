"""FastCardCounterV2 must give exactly CardCounterV2's odds, just faster."""
from __future__ import annotations

import pytest

from bots import CardCounterV2, FastCardCounterV2, RandomChoice
from bots.bot_knowledge import PriestKnowledge
from stats import iter_games


class CheckedOdds(PriestKnowledge):
    """Plays like PriestKnowledge (so some hands are narrowed down), and compares
    its fast odds with CardCounterV2's slow ones every turn."""
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
