"""stats.Tally: the numbers on the Stats page. They're checked against each other
(things that must add up) and against the pandas Dataset metrics."""
import pytest

from bots import CardCounter, NoPrincess, RandomChoice
from engine import Baron, Guard, Prince, Princess, TurnHistory
from stats import Dataset, Tally, guard_accuracy, iter_games, simulate
from stats.tally import CAUSES, loss_cause


def lineup():
    return {"Ann": CardCounter(), "Ben": RandomChoice(), "Cat": NoPrincess(), "Dan": RandomChoice()}


def tally_of(ghs) -> Tally:
    tally = Tally(expected_games=len(ghs))
    for gh in ghs:
        tally.add(gh)
    return tally


@pytest.fixture(scope="module")
def run():
    ghs = simulate(400, lineup(), seed=11)
    return ghs, tally_of(ghs).to_json()


def test_totals_add_up(run):
    ghs, stats = run
    players = stats["players"]
    assert stats["games"] == 400
    assert stats["rounds"] == sum(len(gh.rounds) for gh in ghs)
    assert sum(p["gameWins"] for p in players) == stats["games"]  # one winner a game
    assert all(p["games"] == 400 and p["rounds"] == stats["rounds"] for p in players)

    extra_winners = sum(len(rh.winners) - 1 for gh in ghs for rh in gh.rounds)
    assert extra_winners > 0  # ties happen in 400 games
    assert sum(p["roundWins"] for p in players) == stats["rounds"] + extra_winners
    assert stats["tiedRounds"] == sum(len(rh.winners) > 1 for gh in ghs for rh in gh.rounds)

    hist = dict(stats["roundsPerGame"]["histogram"])
    assert sum(hist.values()) == 400
    assert sum(k * v for k, v in hist.items()) == stats["rounds"]
    assert stats["roundsPerGame"]["mean"] == pytest.approx(stats["rounds"] / 400)


def test_every_lost_round_has_one_cause(run):
    _, stats = run
    for p in stats["players"]:
        assert list(p["losses"]) == list(CAUSES)
        assert sum(p["losses"].values()) == p["rounds"] - p["roundWins"]


def test_guard_and_baron_outcomes_add_up(run):
    _, stats = run
    for p in stats["players"]:
        g, b = p["guard"], p["baron"]
        assert g["played"] == g["correct"] + g["incorrect"] + g["protected"] > 0
        assert g["accuracy"]["p"] == pytest.approx(g["correct"] / (g["correct"] + g["incorrect"]))
        assert b["played"] == b["won"] + b["lost"] + b["tied"] + b["protected"] > 0


def test_matches_the_pandas_metrics(run):
    ghs, stats = run
    ds = Dataset.from_histories(ghs)
    by_name = {p["name"]: p for p in stats["players"]}

    for name, won in ds.games.groupby("player")["won"].sum().items():
        assert by_name[name]["gameWins"] == won
    for name, won in ds.rounds.groupby("player")["won"].sum().items():
        assert by_name[name]["roundWins"] == won
    for name, row in guard_accuracy(ds).iterrows():
        assert by_name[name]["guard"]["correct"] == row["correct_guesses"]
        assert by_name[name]["guard"]["played"] == row["guards_played"]

    # knock-outs, by the card that caused them
    card_of = {"guard": "Guard", "baron": "Baron", "ownBaron": "Baron", "prince": "Prince",
               "ownPrince": "Prince", "princess": "Princess"}
    for name, p in by_name.items():
        mine = ds.rejections[ds.rejections["victim"] == name]
        for card in ("Guard", "Baron", "Prince", "Princess"):
            expected = (mine["cause"] == card).sum()
            assert sum(n for cause, n in p["losses"].items() if card_of.get(cause) == card) == expected
        assert p["losses"]["ownBaron"] + p["losses"]["ownPrince"] + p["losses"]["princess"] \
            == mine["self_inflicted"].sum()


def test_equal_bots_win_about_a_quarter_each():
    players = {name: RandomChoice() for name in ("A", "B", "C", "D")}
    stats = tally_of(simulate(3000, players, seed=5)).to_json()
    for p in stats["players"]:
        assert 0.22 < p["gameWinRate"]["p"] < 0.28
    # one bot group: 4 seats, per-seat win rate exactly 1/4
    (bot,) = stats["bots"]
    assert bot["seats"] == 4 and bot["games"] == 12000
    assert bot["gameWinRate"]["p"] == pytest.approx(0.25)


def test_bots_sum_their_players(run):
    _, stats = run
    bots = {b["bot"]: b for b in stats["bots"]}
    assert bots["RandomChoice"]["seats"] == 2
    ben, dan = (p for p in stats["players"] if p["bot"] == "RandomChoice")
    assert bots["RandomChoice"]["gameWins"] == ben["gameWins"] + dan["gameWins"]
    assert bots["RandomChoice"]["games"] == 800
    assert bots["RandomChoice"]["losses"]["guard"] == ben["losses"]["guard"] + dan["losses"]["guard"]


def test_same_seed_same_stats():
    a = tally_of(list(iter_games(150, lineup(), seed="x"))).to_json()
    b = tally_of(list(iter_games(150, lineup(), seed="x"))).to_json()
    assert a == b


def test_convergence_ends_on_the_final_numbers(run):
    _, stats = run
    points = stats["convergence"]
    assert 90 <= len(points) <= 101
    assert [pt["games"] for pt in points] == sorted({pt["games"] for pt in points})
    assert points[-1]["games"] == 400
    assert [r["p"] for r in points[-1]["players"]] == [p["gameWinRate"]["p"] for p in stats["players"]]


def test_loss_causes():
    assert loss_cause(TurnHistory(1, 0, played=Guard(), target=2), 2) == "guard"
    assert loss_cause(TurnHistory(1, 0, played=Baron(), target=2), 2) == "baron"
    assert loss_cause(TurnHistory(1, 0, played=Baron(), target=2), 0) == "ownBaron"
    assert loss_cause(TurnHistory(1, 0, played=Prince(), target=2), 2) == "prince"
    assert loss_cause(TurnHistory(1, 0, played=Prince(), target=0), 0) == "ownPrince"
    assert loss_cause(TurnHistory(1, 0, played=Princess()), 0) == "princess"


def test_empty_tally():
    stats = Tally().to_json()
    assert stats["games"] == 0 and stats["players"] == [] and stats["roundsPerGame"]["mean"] is None


def test_seats_sum_to_the_same_totals(run):
    _, stats = run
    seats, players = stats["seats"], stats["players"]
    assert [s["seat"] for s in seats] == [0, 1, 2, 3]
    for key in ("games", "gameWins", "rounds", "roundWins"):
        assert sum(s[key] for s in seats) == sum(p[key] for p in players)
    for cause in CAUSES:
        assert sum(s["losses"][cause] for s in seats) == sum(p["losses"][cause] for p in players)
    assert sum(s["guard"]["correct"] for s in seats) == sum(p["guard"]["correct"] for p in players)


def test_fixed_seats_make_seats_and_players_equal():
    stats = tally_of(simulate(100, lineup(), rotate_seats=False, seed=2)).to_json()
    for seat, player in zip(stats["seats"], stats["players"]):
        assert {k: v for k, v in seat.items() if k != "seat"} == \
            {k: v for k, v in player.items() if k not in ("name", "bot")}


def test_turn_order(run):
    ghs, stats = run
    order = stats["turnOrder"]
    assert [t["position"] for t in order] == [0, 1, 2, 3]
    assert all(t["rounds"] == stats["rounds"] for t in order)
    extra_winners = sum(len(rh.winners) - 1 for gh in ghs for rh in gh.rounds)
    assert sum(t["roundWins"] for t in order) == stats["rounds"] + extra_winners
    # position 0 is the player left of the dealer, who moves first
    firsts = sum(rh.turns[0].seat == (rh.dealer + 1) % 4 for gh in ghs for rh in gh.rounds)
    assert firsts == stats["rounds"]


def test_replay_knows_every_hand(run):
    from stats.replay import walk
    ghs, _ = run
    for gh in ghs[:200]:
        for rh in gh.rounds:
            state = None
            for turn, state in walk(rh):
                assert type(state.hands[turn.seat]) is type(turn.held)
            assert state is not None
            if rh.showdown:
                for seat, card in rh.showdown.contender_hands.items():
                    assert type(state.hands[seat]) is type(card)
            # every card is somewhere: burned, in the deck, in a hand or face up
            in_hands = sum(c is not None for c in state.hands.values())
            face_up = sum(len(pile) for pile in state.discards.values())
            # (a Prince on an empty deck redraws the burned card, which then counts too)
            drawn = len(rh.starting_hands) + sum(1 for t in rh.turns if t.drawn is not None) \
                + sum(1 for t in rh.turns if t.redrawn is not None)
            assert in_hands + face_up == drawn


def test_start_cards_add_up(run):
    _, stats = run
    for p in stats["players"]:
        assert sum(c["rounds"] for c in p["startCard"].values()) == p["rounds"]
        assert sum(c["wins"] for c in p["startCard"].values()) == p["roundWins"]


def test_choices_add_up(run):
    ghs, stats = run
    for p in stats["players"]:
        turns = sum(1 for gh in ghs for rh in gh.rounds for t in rh.turns
                    if t.played is not None and gh.players[t.seat] == p["name"])
        assert sum(c["n"] for c in p["choices"]) == turns
        assert all(c["played"] in (c["a"], c["b"]) and 0 <= c["wins"] <= c["n"] for c in p["choices"])
        assert all(c["played"] == "Countess" for c in p["choices"] if {c["a"], c["b"]} in ({"Countess", "King"}, {"Countess", "Prince"}))


def test_baron_by_card_adds_up(run):
    _, stats = run
    for p in stats["players"]:
        for outcome in ("won", "tied", "lost", "protected"):
            assert sum(c[outcome] for c in p["baronByCard"].values()) == p["baron"][outcome]
        assert p["baronByCard"]["Guard"]["won"] == 0  # a Guard never wins a comparison
        assert p["baronByCard"]["Princess"]["lost"] == 0


def test_guard_odds(run):
    _, stats = run
    by_bot = {p["bot"]: p for p in stats["players"]}
    counter = by_bot["CardCounter"]["guardOdds"]
    assert counter["pickedBest"]["p"] == 1.0  # it always names the likeliest card...
    assert counter["expected"] == pytest.approx(counter["bestPossible"])  # ...so it gets the best odds
    random_odds = by_bot["RandomChoice"]["guardOdds"]
    assert random_odds["expected"] < random_odds["bestPossible"]
    for p in stats["players"]:
        g = p["guardOdds"]
        assert g["checked"] == p["guard"]["correct"] + p["guard"]["incorrect"]
        assert 0 < g["expected"] <= g["bestPossible"] < 1


def test_priest_follow_up(run):
    _, stats = run
    for p in stats["players"]:
        pr = p["priest"]
        assert 0 <= pr["taken"] <= pr["chances"] <= pr["looks"]
        assert pr["chances"] > 0
