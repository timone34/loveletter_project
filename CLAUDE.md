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
- The owner's `main` branch stays free of LLN code until the owner decides to merge it. LLN work lives on `lln` (owner) and `claude/main` (Claude). Claude's game-logic changes also go to `claude/` branches (see "Git and branches"), and the owner decides what reaches `main`.
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
- `bots/`: the bots themselves (`bot_random.py`, `bot_no_princess.py`, `bot_card_counter.py`), plus `bot_terminal.py` (`TerminalPlayer`, a human playing in the terminal).
- `observers/`: Observer implementations: `ConsoleLogger`, and `LLNWriter` (a thin observer that calls into `lln/`).
- `lln/`: Love Letter Notation. `writer.py` (`to_lln`, `save_lln`, `generate_turn_line`) and `parser.py` (`load_lln`, `parse_lln`: replays a file through the engine to rebuild full `GameHistory` objects). Tests in `tests/test_lln.py`.
- `stats/`: `sim.py` (`simulate(n, players, obs, rotate_seats=True)` returns `list[GameHistory]`, seats rotate between games), `dataset.py` (pandas tables), `metrics.py` (win rates with 95% CIs and other metrics), `plots.py` (matplotlib). `experiment.py` sits in the repo root.
- `server.py`: FastAPI with a `/ws/play` WebSocket (`Web_Strategy`, `TableObserver`, `redact`).
- `web/`: React + TypeScript frontend with its own CSS per component (`.tsx` + `.css` pairs, shared pieces in `web/src/content/Asset.tsx`).
- `main.py`: runs 4 bots with `target_round_wins=3`.
- `games/`: example `.lln` files.

## Bots so far (the "ladder")

Random, then No_Princess (never plays the Princess voluntarily), then No_Princess_Or_Prince_Suicide (also never self-targets with the Prince while holding the Princess; no visible improvement over No_Princess in 10,000 games), then Card_Counter (tracks cards that are out of play and uses that for Guard guesses and Baron comparisons).

Planned: an evaluation-function bot that scores game states and looks ahead at possible future states, chess-bot style.

Keep a record of each bot's results under a fixed experiment setup (same opponents, same number of games). Negative results are as valuable as positive ones, because they are good material for the video.

## Love Letter Notation (LLN)

A chess-PGN-inspired notation for recording games. Current version is **LLN 1.4** (1.4 added a per-game `[Target: n]` tag for the round-win target).

- Header tags: version, players (with strategy names), round, dealer, shuffled deck order, result (including the whole-game result).
- Movetext lines are `cycle.seat.` followed by `-` (skipped/rejected player) or an action: card letter (`g` Guard, `p` Priest, `B` Baron, `H` Handmaid, `P` Prince, `K` King, `C` Countess, `Q` Princess), a target seat, and a suffix (`*` protected target, `#` target rejected, `=` Baron draw, `>` / `<` Baron win/lose). Guard guesses use a colon (`g4:H`) and a guess is never a Guard. Cards seen via a Priest are not recorded. Seats are absolute. Skipped-turn lines for rejected players stay in the file. Rounds end with a result such as `W3`.
- Four-player only for now; other variants are postponed.
- Status (on `claude/main`): `lln/writer.py` writes LLN 1.4, with descriptive filenames and multi-game files (`save_lln`, files go to `games/{date}/`). `lln/parser.py` turns a `.lln` file back into `GameHistory` objects, with their `RoundHistory`s and `TurnHistory`s, and accepts 1.3 and 1.4. Still planned: efficient storage of ~1000-game simulations, and replaying a recorded deck order with different bots.
- Replaying a recorded deck order with different bots is an intended use.

## Webapp

Main workspace for the project, with three modes:

- **Play**: play against own bots at `/play`. Live via the FastAPI WebSocket. Layout: three opponents on top, deck in the middle, own hand at the bottom, action log in a column on the right. Designed for the owner's own desktop only (no scaling-based layout). Cards are uniform in design with only the LLN letter differing; the card back uses striped accent colours.
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
