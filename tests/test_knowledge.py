"""bots.knowledge: what a bot knows about the other hands, and the bots planning with it.

The unit tests feed small handmade logs; test_never_rules_out_the_real_card plays
real games and checks the knowledge against the hands everyone really held."""
from __future__ import annotations

import pytest

from bots import CardCounterV3, FastCardCounterV2, RandomChoice
from bots.bot_knowledge import PriestKnowledgeV2
from bots.knowledge import ANY, Knowledge
from engine import TurnHistory
from engine.cards import Baron, Card, Countess, Guard, Handmaid, King, Priest, Prince, Princess
from engine.history import Outcome
from engine.observer import Observer
from stats import Tally, iter_games
from stats.replay import walk

ME = 0


def knowing(*turns: TurnHistory, private: bool = True, missed_guesses: bool = False) -> Knowledge:
    k = Knowledge(ME, range(4), private=private, missed_guesses=missed_guesses)
    for t in turns:
        k.apply(t)
    return k


def play(seat: int, card: Card, target: int | None = None, outcome: Outcome = Outcome.NONE, **fields) -> TurnHistory:
    return TurnHistory(cycle=1, seat=seat, played=card, target=target, outcome=outcome, **fields)


def my_priest_on(seat: int, seen: Card) -> TurnHistory:
    return play(ME, Priest(), seat, seen=seen)


def test_starts_knowing_nothing_about_the_others():
    k = knowing()
    assert k.possible == {1: ANY, 2: ANY, 3: ANY}  # never about myself


def test_priest_look_is_private_knowledge():
    assert knowing(my_priest_on(1, King())).possible[1] == {King}
    assert knowing(my_priest_on(1, King()), private=False).possible[1] == ANY


def test_playing_a_card_of_another_kind_keeps_the_info():
    k = knowing(my_priest_on(1, King()), play(1, Handmaid()))
    assert k.possible[1] == {King}  # they played the card they drew


def test_playing_the_seen_kind_forgets_it():
    k = knowing(my_priest_on(1, King()), play(1, King(), 2))
    assert k.possible[1] == ANY  # the seen King, or a second one they drew?


def test_prince_redraw_forgets():
    k = knowing(my_priest_on(1, Countess()), play(2, Prince(), 1, discarded=Countess(), redrawn=Guard()))
    assert k.possible[1] == ANY


def test_prince_on_myself_doesnt_touch_the_others():
    k = knowing(my_priest_on(1, Countess()), play(ME, Prince(), ME, discarded=Guard(), redrawn=Baron()))
    assert k.possible[1] == {Countess}


def test_king_between_others_moves_the_info():
    k = knowing(my_priest_on(1, Countess()), play(2, King(), 1))
    assert k.possible[2] == {Countess}  # 2 now holds what 1 had
    assert k.possible[1] == ANY  # and 1 holds 2's old card, unknown


def test_my_king_tells_me_what_they_now_hold():
    k = knowing(play(ME, King(), 1, given=Baron(), received=Priest()))
    assert k.possible[1] == {Baron}
    assert knowing(play(ME, King(), 1, given=Baron(), received=Priest()), private=False).possible[1] == ANY


def test_a_king_on_me_tells_me_what_they_now_hold():
    k = knowing(play(2, King(), ME, given=Guard(), received=Handmaid()))
    assert k.possible[2] == {Handmaid}  # what I had


def test_protected_target_changes_nothing():
    k = knowing(my_priest_on(1, Countess()), play(2, Prince(), 1, Outcome.PROTECTED))
    assert k.possible[1] == {Countess}


def test_missed_guess_is_its_own_switch():
    miss = play(2, Guard(), 1, Outcome.INCORRECT, guess=Baron())
    assert knowing(miss).possible[1] == ANY
    assert knowing(miss, missed_guesses=True).possible[1] == ANY - {Baron}


def test_knocked_out_players_are_dropped():
    k = knowing(play(2, Guard(), 1, Outcome.CORRECT, guess=King(), rejected=[1], revealed=King()))
    assert 1 not in k.possible


def test_skipped_turns_are_ignored():
    k = knowing(my_priest_on(1, Princess()), TurnHistory(cycle=2, seat=1))
    assert k.possible[1] == {Princess}


# ----- against real games -----

class Truth(Observer):
    """Hands the live round's RoundHistory to the checking bot at every turn start."""
    def __init__(self) -> None:
        self.round = None

    def on_turn_start(self, game_history, round_history, turn_history) -> None:
        self.round = round_history


class CheckedKnowledge(PriestKnowledgeV2):
    """PriestKnowledgeV2 with every kind of knowledge on, checking it each turn."""
    missed_guesses = True

    def __init__(self, truth: Truth) -> None:
        super().__init__()
        self.id = "CheckedKnowledge"
        self.truth = truth
        self.checks = 0
        self.narrowed = 0  # checks where something was known

    def choose_card(self, player, playable):
        view = player.view
        rh = self.truth.round
        assert view is not None and rh is not None
        hands = dict(rh.starting_hands)
        for _, table in walk(rh):  # the table after the last finished turn
            hands = table.hands
        odds = self.hand_odds(view)
        for seat, types in self.knowledge(view).possible.items():
            real = hands[seat]
            assert real is not None, "knowledge about a player who's out"
            assert type(real) in types, f"ruled out the {real.name} seat {seat} holds"
            assert odds[seat].get(type(real), 0) > 0
            self.checks += 1
            self.narrowed += types != ANY
        return super().choose_card(player, playable)


def test_never_rules_out_the_real_card():
    truth = Truth()
    bot = CheckedKnowledge(truth)
    lineup = {"Ann": bot, "Ben": PriestKnowledgeV2(), "Cat": RandomChoice(), "Dan": FastCardCounterV2()}
    for _ in iter_games(300, lineup, obs=truth, seed="knowledge"):
        pass
    assert bot.checks > 1000
    assert bot.narrowed > 100  # the rules really were exercised


def test_v3_is_v2_in_a_new_shape():
    """Same information and the same choices: as many wins as FastCardCounterV2."""
    lineup = {"A": CardCounterV3(), "B": FastCardCounterV2(), "C": CardCounterV3(), "D": FastCardCounterV2()}
    tally = Tally()
    for gh in iter_games(1000, lineup, seed="v3"):
        tally.add(gh)
    bots = {b["bot"]: b for b in tally.to_json()["bots"]}
    v3, v2 = bots["CardCounterV3"]["gameWinRate"], bots["FastCardCounterV2"]["gameWinRate"]
    assert v3["lo"] < v2["p"] < v3["hi"]


def test_priest_knowledge_v2_uses_its_looks():
    lineup = {"P": PriestKnowledgeV2(), "C": FastCardCounterV2(), "R": RandomChoice(), "S": RandomChoice()}
    tally = Tally()
    for gh in iter_games(500, lineup, seed="priest"):
        tally.add(gh)
    priest = next(p for p in tally.to_json()["players"] if p["name"] == "P")["priest"]
    assert priest["takenRate"]["p"] > 0.95
