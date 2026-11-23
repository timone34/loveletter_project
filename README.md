# Love Letter Strategy

This is my Love Letter Strategy project. I played (a version of) this game with my friends, and, naturally, we discussed the optimal strategy.
So, I'm making this to answer the question: **How do you play a perfect game of Love Letter?**

This is not an easy question to answer by any stretch of the imagination. It raises a bunch of other questions, such as: "What even is perfect play?" or "How much is luck involved?"

The project consists of:

- A **Python game engine** that plays full games of Love Letter between pluggable strategies (bots or humans).
- A set of **bots** of increasing sophistication, to compare against each other.
- A **simulation and statistics** package for running thousands of games and measuring how strategies perform.
- A **web interface** (React + FastAPI) for playing against the bots in the browser.
- **Love Letter Notation (LLN)**, a text format for recording games, described below.

## Getting started

### Requirements

- Python 3.10+
- Node.js 20+ (only for the web interface)

### Install

```bash
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
```

### Watch a single game in the terminal

```bash
python main.py
```

Plays one game (first to 3 round wins) between the bots configured in [main.py](main.py) and logs every turn to the console. To play yourself, swap one of the bots for `TerminalPlayer()`.

### Run a simulation

```bash
python experiment.py
```

Simulates 5000 games (rotating seats between games so no bot gets a seat advantage), builds a dataset from the game histories and prints win rates (with Wilson confidence intervals) and Guard accuracy. Edit the lineup and `n` in [experiment.py](experiment.py).

#### Comparing bots on the same decks

Pass a `seed` to `simulate()` to give every lineup exactly the same decks:

```python
from stats import simulate

old = simulate(1000, {"Alice": RandomChoice(), "Bob": RandomChoice(), "Charlie": RandomChoice(), "Diane": RandomChoice()}, seed=42)
new = simulate(1000, {"Alice": CardCounter(), "Bob": RandomChoice(), "Charlie": RandomChoice(), "Diane": RandomChoice()}, seed=42)
```

With the same seed, round *r* of game *i* always gets the same deck, no matter what the bots do, so differences between the two runs come from the bots and not from luck of the shuffle. The seed also fixes the bots' own random choices, so running the same lineup with the same seed twice gives identical games. Without a seed, every run is shuffled differently, as before.

### Play in the browser

Start the game server and the web front end in two terminals:

```bash
# terminal 1 - from the project root
uvicorn server:app --port 8000

# terminal 2
cd web
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173) and go to **Play**. The Vite dev server proxies `/ws` to the FastAPI server on port 8000. You play as "You" against three bots; the lineup is set in `lineup()` in [server.py](server.py).

The *Simulate* and *Stats* pages are placeholders for now.

## Project structure

[engine/](engine/) holds the hard rules of the game and imports nothing from outside itself. Everything else builds on top of it.

| Path | Contents |
| :--- | :--- |
| [engine/game.py](engine/game.py) | `Game`, `Round` and `Turn`: the core game loop |
| [engine/cards.py](engine/cards.py) | The eight card types and their effects |
| [engine/deck.py](engine/deck.py), [engine/player.py](engine/player.py) | Deck and player state |
| [engine/strategy.py](engine/strategy.py) | `Strategy` base class: the interface every bot implements |
| [engine/view.py](engine/view.py) | `PlayerView`: the information a player is allowed to see (hidden cards redacted) |
| [engine/history.py](engine/history.py) | Records of every turn, showdown, round and game |
| [engine/observer.py](engine/observer.py) | `Observer` base class: hooks into game events |
| [bots/](bots/) | Bot strategies (see below), including `TerminalPlayer` for playing in the terminal |
| [observers/](observers/) | Observer implementations; `ConsoleLogger` prints games to the terminal, `LLNWriter` saves them as `.lln` files |
| [lln/](lln/) | Love Letter Notation: writing (`save_lln`) and parsing (`load_lln`) `.lln` files |
| [stats/](stats/) | `simulate()`, `Dataset`, metrics (`winrate`, `guard_accuracy`, ...) and plots |
| [server.py](server.py) | FastAPI WebSocket server (`/ws/play`, `/ws/spectate`) |
| [web/](web/) | React + TypeScript + Vite front end |
| [games/](games/) | Example games recorded in LLN |

## Bots

| Bot | Class | Behaviour |
| :--- | :--- | :--- |
| Random Bot | `RandomChoice` | Picks cards, targets and guesses at random. |
| No Princess Bot (dumb) | `NoPrincessDumb` | Never plays the Princess; everything else random. |
| No Princess Bot | `NoPrincess` | Never plays or discards the Princess voluntarily; everything else random. |
| Card Counter Bot | `CardCounter` | Keeps track of which cards are still unseen and uses that to make its choices. |

### Writing your own bot

Subclass `Strategy` and implement the decision hooks. During a turn, `player.view` holds a `PlayerView` with your hand, every player's public state (discards, protection, rejection), the number of cards left in the deck and a redacted log of the round so far.

```python
from engine.cards import *
from engine.strategy import Strategy

class MyBot(Strategy):
    def __init__(self):
        self.name = "My Bot"
        self.description = "What this bot does."

    def choose_card(self, player, playable): ...          # which card to play
    def choose_guard_target(self, player, targets): ...   # one hook per targeting card
    def choose_priest_target(self, player, targets): ...
    def choose_baron_target(self, player, targets): ...
    def choose_prince_target(self, player, targets): ...
    def choose_king_target(self, player, targets): ...
    def guard_guess(self, player, target): ...            # return a card from guessable()
```

Add it to [bots/\_\_init\_\_.py](bots/__init__.py) and put it in the lineup in `main.py` or `experiment.py`. See [bots/bot_random.py](bots/bot_random.py) for the simplest complete example.

## Rules

In Love Letter, your objective is to get your letter to the princess. To do this you pass your letter to different members of the court, represented by cards.

Every player gets dealt a starting card. Another card is put aside, face-down.
On a player's turn, they take a second card into their hand and play one of the two.
Once there are no cards remaining, the players compare hands. The player with the highest value card wins the round.
A round also ends when only one player is left who hasn't been rejected.

The deck has 16 cards:

| Value | Card | Copies | Effect |
| :---: | :--- | :---: | :--- |
| 1 | Guard | 5 | Guess another player's hand (you can't guess a Guard). If you're correct, the other player is rejected. |
| 2 | Priest | 2 | Look at another player's hand. |
| 3 | Baron | 2 | Compare your hand with another player's. The player with the lowest hand is rejected. |
| 4 | Handmaid | 2 | You are protected until your next turn. No player can target you with a card effect. |
| 5 | Prince | 2 | Choose a player (including yourself); this player discards their hand and draws a new card. |
| 6 | King | 1 | Trade hands with another player. |
| 7 | Countess | 1 | If you have this card and a King or Prince, you must play this card. |
| 8 | Princess | 1 | If you play or discard this card, you are rejected. |

## Love Letter Notation (LLN)

In this project, I'll be using my system for saving games of Love Letter called Love Letter Notation (or LLN for short).
It's inspired by PGN and FEN, chess notation systems.

All cards get shortened to a letter, just like pieces in chess notation. Some turn results are also stored as symbols.

| Card/Result | Letter |
| :-------- | :-------: |
| Guard | g |
| Priest | p |
| Baron | B |
| Handmaid | H |
| Prince | P |
| King | K |
| Countess | C |
| Princess | Q |
| Player rejected | - |
| Turn results in rejection of target | # |
| Player wins Baron comparison | > |
| Player loses Baron comparison | < |
| Baron comparison ends with tie | = |
| Target protected by Handmaid | * |

Every game of Love Letter is determined most of all by the order of the deck. I've come up with a system that uses this to its advantage.
At the very start of a round, the deck is shuffled. Its order is saved in a string of 16 card letters. For example: `CBpBQgpgggHPgPKH`. Cards at the front of the string represent the top of the deck.
Thus we can immediately see the card put aside is the Countess.
If we know who is dealing this round, the starting hands are determined as well. The player who is after the dealer in rotation receives the second card in the deck string, the next player the third, etc.

A move is the card played, optionally followed by a target seat, a `:` and a Guard guess, and finally a result symbol, e.g. `g1:H`, `p4*` or `B3<#`. A `-` is the turn of a player who has already been rejected.

A file starts with `[Version: ...]`, followed by the lineup shared by every game in the file: the seats (name and strategy) and `[Target]` (round wins needed to win a game). Each game then has its `[Score]` (the final score per seat). In a multi-game file where players change seats between games, as `simulate()` does, a game says `[Rotation: k]`: seat 1 is taken by whoever had seat 1+k in the shared lineup, and so on. A game with a completely different lineup lists its own `[Seat]` tags instead. Each round has its number, the dealer's seat, the deck string and the result (`W3`: seat 3 wins; `T13`: seats 1 and 3 tie). The turns follow, one line per cycle, in the order they were played, like moves in chess notation. Text after `//` is a comment.

What does a game of Love Letter look like in LLN? This one is played to a single round win:

```
[Version: 1.5]

[Seat 1: Alice, RandomChoice]
[Seat 2: Bob, RandomChoice]
[Seat 3: Charlie, RandomChoice]
[Seat 4: Diane, RandomChoice]
[Target: 1]

[Game: 1]
[Score: 0-0-1-0]

[Round: 1]
[Dealer: 1]
[Deck: CBpBQgpgggHPgPKH]
[Result: W3]

1. g1:H p2 g1:Q# -
2. g3:H g2:B# H -
3. - p4* g3:K -
4. - P3 B3<#
```

Seat 1 deals, so seat 2 plays first in every cycle: in cycle 1, Bob plays `g1:H`, Charlie `p2`, Diane `g1:Q#` (rejecting Alice), and Alice's turn is skipped (`-`).

Turns can also be written one per line in the long form `cycle.seat. move`, e.g. `1.2. g1:H` (cycle 1, seat 2). This is handy for commenting on each turn, and the two forms can be mixed. Earlier versions of LLN (1.4 and before) always used the long form and repeated the seats in every game.

The same game is in [games/example_game_v1.5.lln](games/example_game_v1.5.lln), and with commentary per turn in [games/example_game_annotated_v1.5.lln](games/example_game_annotated_v1.5.lln). The LLN 1.4 versions are [games/example_game.lln](games/example_game.lln) and [games/example_game_annotated.lln](games/example_game_annotated.lln). Files in even older LLN versions are kept in [games/legacy/](games/legacy/).

### Loading LLN files
[lln/parser.py](lln/parser.py) turns `.lln` files (versions 1.3, 1.4 and 1.5) back into `GameHistory` objects. Since 1.4, the round-win target is stored in a `[Target: n]` tag. For 1.3 files, pass `target_round_wins=` yourself (default 3).

```python
from lln import load_lln

histories = load_lln("games/2026-11-23/CardCounter-v-3xRandomChoice_n1000.lln")
```

A file only stores the deck, the dealer and the players' choices. The parser replays each game through the real engine to fill in everything else (held/drawn cards, Priest sightings, Prince redraws, King swaps, rejections, showdowns). It then checks every turn, result and score against the file. If something doesn't match, it raises an `LLNParseError` that gives the line number.

### Replaying recorded decks with other bots

`rerun_decks` plays the decks from recorded games again with a different lineup. Round *r* of game *i* gets the deck that round *r* of recorded game *i* had:

```python
from lln import load_lln, rerun_decks

recorded = load_lln("games/2026-11-23/CardCounter-v-3xRandomChoice_n1000.lln")
rerun = rerun_decks(recorded, {"Alice": NoPrincess(), "Bob": RandomChoice(), "Charlie": RandomChoice(), "Diane": RandomChoice()}, seed=1)
```

The new bots may need more rounds than the recording has. Those extra rounds get a seeded deck when you pass `seed` (reproducible), and a normal shuffle otherwise. For new simulations, `simulate(..., seed=...)` (see "Comparing bots on the same decks") is the simpler way to give lineups the same decks. `rerun_decks` is for decks you already have in a file.

## Statistics

To compare strategies with each other, we need a way of looking at the game data.
Various statistics can help us in our journey to find the way to perfect play.
These different stats can be split into multiple categories. Win rates and Guard accuracy are implemented in [stats/metrics.py](stats/metrics.py); the rest is planned.

### 1. Outcome stats
Did the bot win, and how?
These stats are important for observing which bot performs best.
- Game winrate (%)
- Round winrate (%)
- Rejection stats (cause, timing, who did it)
- Seat and dealer specific effects

### 2. Play stats
What did the bot actually do?
These stats are important for telling us what to improve.
- Guard accuracy (%)
- Baron results (x% win, y% tie, z% loss)
- Information usage (card counting accuracy)

### 3. Context
How far can we trust these numbers?
Maybe the least important, but still useful for our purposes.
- Luck analysis
- Drawn cards
- Comparison setup (head-to-head, rating, confidence interval)
