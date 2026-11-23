import dataclasses
import random
from pathlib import Path

import pytest

from bots import CardCounter, NoPrincess, RandomChoice
from engine import Baron, Card, Countess, Guard, Handmaid, Outcome, Priest, Prince, Princess
from lln import LLNParseError, load_lln, parse_lln, rerun_decks, to_lln
from stats.sim import simulate

GAMES_DIR = Path(__file__).resolve().parent.parent / "games"

# One 4-player round, played to 1 round win. Seat 1 deals, burn = Countess.
SAMPLE = """\
[Version: 1.4]

[Game: 1]
[Seat 1: Alice, CardCounter]
[Seat 2: Bob, RandomChoice]
[Seat 3: Charlie, RandomChoice]
[Seat 4: Diane, RandomChoice]
[Target: 1]
[Score: 0-1-0-0]

[Round: 1]
[Dealer: 1]
[Deck: CgpgBHKQgPggpBHP]
[Result: W2]

1.2. H
1.3. p2*
1.4. g3:K#
1.1. B4<#
2.2. P4#   // Diane is forced to discard her Princess
"""


def same(a, b) -> bool:
    """Deep equality for history objects; Cards (no __eq__) compare by type."""
    if isinstance(a, Card) or isinstance(b, Card):
        return type(a) is type(b)
    if dataclasses.is_dataclass(a):
        return type(a) is type(b) and all(
            same(getattr(a, f.name), getattr(b, f.name)) for f in dataclasses.fields(a)
        )
    if isinstance(a, (list, tuple)):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    return a == b


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_round_trip_simulated_games(seed):
    random.seed(seed)
    players = {"Alice": CardCounter(), "Bob": RandomChoice(), "Charlie": NoPrincess(), "Diane": RandomChoice()}
    originals = simulate(50, players)

    parsed = parse_lln("\n".join(to_lln(originals)))

    assert len(parsed) == len(originals)
    for original, replayed in zip(originals, parsed):
        assert same(original, replayed)
    assert to_lln(parsed) == to_lln(originals)


def test_round_trip_two_and_three_players():
    random.seed(42)
    for players in ({"A": RandomChoice(), "B": CardCounter()},
                    {"A": RandomChoice(), "B": RandomChoice(), "C": CardCounter()}):
        originals = simulate(20, players)
        parsed = parse_lln("\n".join(to_lln(originals)))
        assert all(same(o, p) for o, p in zip(originals, parsed))


def test_sample_fills_in_derived_fields():
    (gh,) = parse_lln(SAMPLE)
    assert gh.players == ["Alice", "Bob", "Charlie", "Diane"]
    assert gh.strategies == ["CardCounter", "RandomChoice", "RandomChoice", "RandomChoice"]
    assert gh.winner == 1 and gh.scores == {0: 0, 1: 1, 2: 0, 3: 0}

    (rh,) = gh.rounds
    assert isinstance(rh.burn, Countess)
    assert {s: type(c) for s, c in rh.starting_hands.items()} == {1: Guard, 2: Priest, 3: Guard, 0: Baron}
    assert rh.winners == [1] and rh.showdown is None

    hand, priest, guard, baron, prince = rh.turns
    assert isinstance(hand.held, Guard) and isinstance(hand.drawn, Handmaid)
    assert priest.outcome is Outcome.PROTECTED and priest.target == 1 and priest.seen is None
    assert guard.outcome is Outcome.CORRECT and guard.rejected == [2]
    assert baron.outcome is Outcome.LOSE and baron.rejected == [0]
    assert isinstance(prince.played, Prince) and isinstance(prince.discarded, Princess)
    assert prince.redrawn is None and prince.rejected == [3]


def test_load_lln(tmp_path):
    path = tmp_path / "game.lln"
    path.write_text(SAMPLE, encoding="utf-8")
    assert to_lln(load_lln(path)) == to_lln(parse_lln(SAMPLE))


def test_dealer_by_name_is_accepted():
    (gh,) = parse_lln(SAMPLE.replace("[Dealer: 1]", "[Dealer: Alice]"))
    assert gh.rounds[0].dealer == 0


@pytest.mark.parametrize("old, new, message", [
    ("[Version: 1.4]", "[Version: 1.1]", "unsupported LLN version"),
    ("[Version: 1.4]\n", "", "must start with a [Version"),
    ("[Target: 1]\n", "", "has no [Target] tag"),
    ("[Target: 1]", "[Target: 0]", "[Target] must be at least 1"),
    ("[Seat 1: Alice, CardCounter]", "[Seat1: Alice, CardCounter]", "did you mean [Seat 1: ...]?"),
    ("[Round: 1]", "[Round 1]", "malformed tag"),
    ("CgpgBHKQgPggpBHP", "CgpgBHKQgPggpBHX", "unknown card letter"),
    ("CgpgBHKQgPggpBHP", "CgpgBHKQgPggpBHg", "not a full Love Letter deck"),
    ("1.3. p2*", "1.3. p3*", "not a legal target"),
    ("1.1. B4<#", "1.1. B4>#", "does not match the replay"),
    ("1.3. p2*", "1.3. C", "cannot play Countess"),
    ("1.2. H", "1.3. H", "expected turn 1.2."),
    ("[Result: W2]", "[Result: W1]", "[Result] says"),
    ("[Score: 0-1-0-0]", "[Score: 1-0-0-0]", "[Score] is"),
    ("[Dealer: 1]", "[Dealer: 2]", "dealer should be seat 1"),
    ("2.2. P4#", "2.2. P4#\n2.3. -", "already over"),
    ("2.2. P4#   // Diane is forced to discard her Princess\n", "", "not over yet"),
])
def test_errors(old, new, message):
    assert old in SAMPLE
    with pytest.raises(LLNParseError, match=message.replace("[", r"\[").replace(".", r"\.")):
        parse_lln(SAMPLE.replace(old, new))


def test_error_reports_line_number():
    with pytest.raises(LLNParseError) as exc:
        parse_lln(SAMPLE.replace("1.1. B4<#", "1.1. B4=#"))
    assert exc.value.line == 19


def test_target_is_written_and_read_back():
    random.seed(5)
    originals = simulate(10, {"A": RandomChoice(), "B": CardCounter(), "C": RandomChoice()})
    for gh in originals:
        assert gh.target_round_wins == 3
    lines = to_lln(originals)
    assert lines.count("[Target: 3]") == 10

    (gh,) = parse_lln(SAMPLE)
    assert gh.target_round_wins == 1


def test_target_from_file_overrides_argument():
    (gh,) = parse_lln(SAMPLE, target_round_wins=5)
    assert gh.target_round_wins == 1


def test_v13_files_without_target_use_argument():
    v13 = SAMPLE.replace("[Version: 1.4]", "[Version: 1.3]").replace("[Target: 1]\n", "")
    (gh,) = parse_lln(v13, target_round_wins=1)
    assert gh.target_round_wins == 1
    with pytest.raises(LLNParseError, match="not decided"):
        parse_lln(v13)  # default target 3, but only 1 round in the file


def test_game_not_decided_by_end_of_file():
    with pytest.raises(LLNParseError, match="not decided"):
        parse_lln(SAMPLE.replace("[Target: 1]", "[Target: 3]"))


def test_extra_round_after_game_decided():
    extra = SAMPLE + "\n[Round: 2]\n[Dealer: 1]\n[Deck: CgpgBHKQgPggpBHP]\n[Result: W2]\n1.2. H\n"
    with pytest.raises(LLNParseError, match="already decided"):
        parse_lln(extra)


@pytest.mark.parametrize("name", ["example_game.lln", "example_game_annotated.lln"])
def test_example_files_parse(name):
    (gh,) = load_lln(GAMES_DIR / name)
    assert gh.rounds[0].winners == [2] and gh.scores == {0: 0, 1: 0, 2: 1, 3: 0}


def test_annotated_example_is_the_same_game():
    plain = load_lln(GAMES_DIR / "example_game.lln")
    annotated = load_lln(GAMES_DIR / "example_game_annotated.lln")
    assert same(plain, annotated)


def deck_strings(gh):
    return ["".join(type(c).__name__[:2] for c in rh.deck_order) for rh in gh.rounds]


def test_rerun_decks_deals_the_recorded_decks():
    random.seed(11)
    recorded = parse_lln("\n".join(to_lln(simulate(
        30, {"A": CardCounter(), "B": RandomChoice(), "C": RandomChoice(), "D": RandomChoice()}))))
    rerun = rerun_decks(recorded, {"A": NoPrincess(), "B": NoPrincess(), "C": NoPrincess(), "D": CardCounter()}, seed=1)

    assert len(rerun) == len(recorded)
    for old, new in zip(recorded, rerun):
        old_decks, new_decks = deck_strings(old), deck_strings(new)
        shared = min(len(old_decks), len(new_decks))
        assert new_decks[:shared] == old_decks[:shared]
        assert new.target_round_wins == old.target_round_wins
        assert new.strategies != old.strategies or new.players != old.players


def test_rerun_decks_is_reproducible_with_seed():
    recorded = load_lln(GAMES_DIR / "example_game.lln")
    lineup = lambda: {"A": RandomChoice(), "B": RandomChoice(), "C": RandomChoice(), "D": RandomChoice()}
    first, second = rerun_decks(recorded, lineup(), seed=4), rerun_decks(recorded, lineup(), seed=4)
    assert same(first, second)


def test_rerun_decks_rejects_wrong_player_count():
    recorded = load_lln(GAMES_DIR / "example_game.lln")
    with pytest.raises(ValueError, match="4 players, but 2"):
        rerun_decks(recorded, {"A": RandomChoice(), "B": RandomChoice()})
