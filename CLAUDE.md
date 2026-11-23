# CLAUDE.md

Guidance for AI agents working in this repo. Read this first.

## Project goal

A Python recreation of the card game **Love Letter** (coded for 4 players), built as a framework for:

1. **Writing bots** (Strategies) that are easy to program and only see what they legitimately could.
2. **Running diagnostics** on bot versions: simulate many games, compute stats, compare bots.
3. **Finding a "perfect" strategy**, by iterating on bots and measuring each iteration.

Design vision: the game rules ("the bones") are solid but as simple as possible, so that writing Strategies and stat-crunching Observers is easy. The framework should be as complete as possible.

A secondary goal is a **YouTube video** on Love Letter and the journey of building bots for it (see "Video" below). Keep in mind that results should be easy to present.

## Git and branches (read before any commit or push)

- **NEVER commit to or push to a branch whose name doesn't start with `claude/`.** Check `git branch --show-current` before every commit and push.
- `claude/main` is Claude's main branch. Larger pieces of work may go on `claude/<topic>` branches made from it.
- Keep Claude's changes separate from the owner's own branches (`main`, `lln`, ...). Do not merge into, push to, rebase or reset those branches unless the owner explicitly says to merge into main.
- Bringing the owner's changes *into* a `claude/` branch (e.g. `git merge origin/main` while on `claude/main`) is fine. It only changes the `claude/` branch.

## Working agreement

- **Do not repeat yourself, and do not suggest things that are already implemented.** Check the code before proposing a feature.
- Game logic and stats correctness matter more than speed. Wrong numbers fail silently, and results will be presented publicly. Sanity-check changes: equal bots should win about 25% each, win rates should sum to 100%, and the same seed/deck should give the same result.
- Claude's changes, game logic included, go to `claude/` branches (see "Git and branches"), and the owner decides what reaches `main` (via PRs).
- The owner is fairly experienced with Python/numpy, new to pandas, and new to frontend/web development. For frontend work, explain what each file does and give enough information to extend the design by hand. The owner cares about results more than about learning every detail of webapp code, so using agents for web plumbing is fine; bot logic and metric definitions deserve more care and explanation.
- The owner uses a type checker, so keep annotations correct (e.g. `Card | None`, pandas return types).

## Architecture

`engine/` is the game engine: the hard rules. **It must never import from outside `engine/`.** Bots, observers, stats, LLN and the server depend on the engine, never the other way around. If changing a file changes the game itself, it belongs in `engine/`; everything else goes in its own folder. `engine/__init__.py` re-exports the public names (`from engine import Game, Strategy, Guard, Observer`). Entry points (`main.py`, `experiment.py`, `server.py`) stay in the repo root.

- `engine/game.py`: `Game`, `Round`, `Turn`, each with its own `play()`.
- `engine/cards.py`: card effects. Shared targeting code belongs in the `Card` base class rather than repeated blocks (still being cleaned up).
- `engine/deck.py`, `engine/player.py`: deck (draws from the front) and player state, including the forced Countess rule (playable cards) and a `seat`.
- `engine/strategy.py`: base `Strategy` class only (the interface the engine calls). It has per-card targeting hooks (`choose_guard_target`, `choose_prince_target`, ...) so a bot can override just one card's targeting.
- `engine/view.py`: `PlayerView`, `view_for`, `redact_turn`. One view per player is built at the start of each turn, so a strategy sees only legitimate information. The view is also used for the server's live display.
- `engine/history.py`: dataclasses (`TurnHistory`, `RoundHistory`, `GameHistory`, `ShowdownHistory`). They are write-only while the game runs; the game never reads them back.
- `engine/observer.py`: `Observer` / `Observers` base classes. The engine calls these hooks (`on_game_start`, `on_round_start`, `on_turn_start`, `on_turn_end`, `on_turn_skipped`, `on_showdown`, `on_round_end`, `on_game_end`).
- `bots/`: the bots themselves (`bot_random.py`, `bot_no_princess.py`, `bot_card_counter.py`), plus `bot_terminal.py` (`TerminalPlayer`, a human playing in the terminal). `bots.available_bots()` finds every `Strategy` subclass in the folder (order of `__all__` first, `human = True` strategies left out); the webapp's bot picker uses it, so a new bot file shows up there automatically.
- `observers/`: Observer implementations: `ConsoleLogger`, and `LLNWriter` (a thin observer that calls into `lln/`).
- `lln/`: Love Letter Notation. `writer.py` (`to_lln`, `save_lln`, `generate_turn_line`) and `parser.py` (`load_lln`, `parse_lln`: replays a file through the engine to rebuild full `GameHistory` objects), and `rerun.py` (`rerun_decks`: plays recorded decks again with other bots). Tests in `tests/test_lln.py`; seeded decks in `tests/test_seed.py`.
- `stats/`: `sim.py` (`simulate(n, players, rotate_seats=True, obs=None, seed=None)` returns `list[GameHistory]`, seats rotate between games; with a `seed`, round r of game i gets a deck that depends only on (seed, i, r), via `Game(deck_seed=...)` and a dedicated `random.Random`, so different lineups face identical decks, and the bots' global `random` is seeded for reproducibility), `dataset.py` (pandas tables), `metrics.py` (win rates with 95% CIs and other metrics), `plots.py` (matplotlib). `experiment.py` sits in the repo root.
- `server.py`: FastAPI with `GET /api/bots` and a `/ws/play` WebSocket (`Web_Strategy`, `TableObserver`, `redact`). `new_game` carries a `TableConfig` (opponents, names, seat, target, speed, deck seed, table name, visibility), validated server-side.
- `web/`: React + TypeScript frontend with its own CSS per component (`.tsx` + `.css` pairs, shared pieces in `web/src/content/Asset.tsx`).
- `main.py`: runs 4 bots with `target_round_wins=3`.
- `games/`: example `.lln` files.

## Bots so far (the "ladder")

Random, then No_Princess (never plays the Princess voluntarily), then No_Princess_Or_Prince_Suicide (also never self-targets with the Prince while holding the Princess; no visible improvement over No_Princess in 10,000 games), then Card_Counter (tracks cards that are out of play and uses that for Guard guesses and Baron comparisons).

Planned: an evaluation-function bot that scores game states and looks ahead at possible future states, chess-bot style.

Keep a record of each bot's results under a fixed experiment setup (same opponents, same number of games). Negative results are as valuable as positive ones, because they are good material for the video.

## Love Letter Notation (LLN)

A chess-PGN-inspired notation for recording games. Current version is **LLN 1.5**. 1.4 added `[Target: n]` for the round-win target; 1.5 moved the lineup and target into a shared file header (games use `[Rotation: k]` or their own `[Seat]` tags) and writes one line per cycle.

- Header tags: version; shared lineup (`[Seat n: name, strategy]`) and `[Target]` once per file; per game `[Score]` (final score) and optionally `[Rotation]`; per round number, dealer, shuffled deck order and result.
- Movetext: one line per cycle, turns in play order (`1. g1:H p2 g1:Q# -`). The long form, one turn per line (`1.2. g1:H`, cycle.seat.), is still accepted and can be mixed in (useful for per-turn comments). Each move is `-` (skipped/rejected player) or an action: card letter (`g` Guard, `p` Priest, `B` Baron, `H` Handmaid, `P` Prince, `K` King, `C` Countess, `Q` Princess), a target seat, and a suffix (`*` protected target, `#` target rejected, `=` Baron draw, `>` / `<` Baron win/lose). Guard guesses use a colon (`g4:H`) and a guess is never a Guard. Cards seen via a Priest are not recorded. Seats are absolute. Skipped turns (`-`) for rejected players stay in the file. The round result (e.g. `W3`) is in the round header.
- Four-player only for now; other variants are postponed.
- Status: `lln/writer.py` writes LLN 1.5, with descriptive filenames and multi-game files (`save_lln`, files go to `games/{date}/`). `lln/parser.py` turns a `.lln` file back into `GameHistory` objects, with their `RoundHistory`s and `TurnHistory`s, and accepts 1.3, 1.4 and 1.5. `lln/rerun.py` replays recorded deck orders with different bots. 1.5 brought 1000 games from ~1026 KB to ~650 KB; compressing (`.lln.bz2`, ~10x) is the next option if needed. Examples are in `games/example_game*.lln` (1.4 and `_v1.5` versions of the same game, both must keep parsing); files in older LLN versions are in `games/legacy/`.
- Replaying a recorded deck order with different bots is an intended use: `rerun_decks` for decks from a file, `simulate(seed=...)` for new runs on identical decks.

## Webapp

Main workspace for the project, with three modes:

- **Play**: `/play` is the setup page (pick three bots, table settings; remembered in localStorage), `/play/table` the table. Play against own bots Live via the FastAPI WebSocket. Layout: three opponents on top, deck in the middle, own hand at the bottom, action log in a column on the right. Designed for the owner's own desktop only (no scaling-based layout). Cards are uniform in design with only the LLN letter differing; the card back uses striped accent colours.
- **Simulate**: pit chosen bots against each other with visual comparisons (not built yet).
- **Stats**: compare win rates and explain why a bot wins (not built yet).

Style: modern, slightly "vibe-coded" but in the owner's own coding style. JetBrains Mono. Palette: text `#2A2829`, background `#f1f1ec`, primary `#43442B`, secondary `#D0C7B3`, accent `#939575` (light green is the favourite colour). A dark mode toggle is wanted.

Ideas on the table: live spectate mode showing bots' decisions in real time, accounts with online play and career stats, and fullscreen and click-to-target polish on the Play page.

Not a focus yet: a Stockfish-like engine (best moves, LLN lines, hit-chance percentages).

## Next steps under consideration

- Add a `strategy` column to the stats tables, so bot versions can be compared when seats rotate and names differ.
- Duplicate deals in `simulate()`: replay each shuffle with rotated seats so luck cancels out and fewer games are needed.
- A single "ladder" experiment function: bot in, win rate and CI against a fixed field out.
- The LLN parser, then the Simulate and Stats pages in the webapp (FastAPI endpoint returning JSON, frontend charts).

## Video

The owner plans an informative YouTube video analysing Love Letter and the bot-building journey, in the style of Sebastian Lague. Content plan: a short rules section, then results over code (what each bot iteration adds and how much it improves), implemented very briefly. Do not spend effort polishing code internals for the sake of the video; prioritise producing clear, reproducible results and good visuals.
