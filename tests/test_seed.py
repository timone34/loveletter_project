from bots import CardCounter, NoPrincess, RandomChoice
from engine import GameHistory
from stats import simulate


def deck_strings(ghs: list[GameHistory]) -> dict[tuple[int, int], str]:
    """(game index, round number) -> deck order as a string of card names."""
    return {
        (g, rh.number): ",".join(type(c).__name__ for c in rh.deck_order)
        for g, gh in enumerate(ghs) for rh in gh.rounds
    }


def lineup_a():
    return {"A": CardCounter(), "B": RandomChoice(), "C": RandomChoice(), "D": RandomChoice()}


def lineup_b():
    return {"A": NoPrincess(), "B": NoPrincess(), "C": CardCounter(), "D": CardCounter()}


def test_same_seed_gives_different_lineups_the_same_decks():
    a = deck_strings(simulate(200, lineup_a(), seed=7))
    b = deck_strings(simulate(200, lineup_b(), seed=7))
    shared = a.keys() & b.keys()
    assert len(shared) > 500  # most rounds are played by both lineups
    assert all(a[k] == b[k] for k in shared)


def test_same_seed_and_lineup_is_reproducible():
    first = simulate(100, lineup_a(), seed=3)
    second = simulate(100, lineup_a(), seed=3)
    assert deck_strings(first) == deck_strings(second)
    assert [gh.scores for gh in first] == [gh.scores for gh in second]


def test_different_seeds_give_different_decks():
    assert deck_strings(simulate(20, lineup_a(), seed=1)) != deck_strings(simulate(20, lineup_a(), seed=2))


def test_decks_do_not_depend_on_earlier_games():
    # game i's decks come from (seed, i), so a shorter run is a prefix of a longer one
    short = deck_strings(simulate(10, lineup_a(), seed=5))
    long = deck_strings(simulate(30, lineup_b(), seed=5))
    assert all(long[k] == v for k, v in short.items() if k in long)
