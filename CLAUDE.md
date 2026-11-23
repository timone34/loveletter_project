# CLAUDE.md

Guidance for AI agents working in this repo. Read this first.

## Project goal

A Python recreation of the card game **Love Letter** (coded for 4 players), built as a framework for:

1. **Writing bots** (Strategies) that are easy to program and only see what they legitimately could.
2. **Running diagnostics** on bot versions: simulate many games, compute stats, compare bots.
3. **Finding a "perfect" strategy**, by iterating on bots and measuring each iteration.

Design vision: the game rules ("the bones") are solid but as simple as possible, so that writing Strategies and stat-crunching Observers is easy. The framework should be as complete as possible.

A secondary goal is a **YouTube video** on Love Letter and the journey of building bots for it (see "Video" below). Keep in mind that results should be easy to present.

## Working agreement

- **Do not repeat yourself, and do not suggest things that are already implemented.** Check the code before proposing a feature.
- Game logic and stats correctness matter more than speed. Wrong numbers fail silently, and results will be presented publicly. Sanity-check changes: equal bots should win about 25% each, win rates should sum to 100%, and the same seed/deck should give the same result.
- Game-logic changes go to the main branch without LLN code mixed in. LLN work was developed on a separate branch; do not mix the two unless asked.
- The owner is fairly experienced with Python/numpy, new to pandas, and new to frontend/web development. For frontend work, explain what each file does and give enough information to extend the design by hand. The owner cares about results more than about learning every detail of webapp code, so using agents for web plumbing is fine; bot logic and metric definitions deserve more care and explanation.
- The owner uses a type checker, so keep annotations correct (e.g. `Card | None`, pandas return types).

## Architecture (root of the repo)

- `game.py`: `Game`, `Round`, `Turn`, each with its own `play()`.
- `cards.py`: card effects. Shared targeting code belongs in the `Card` base class rather than repeated blocks (still being cleaned up).
- `deck.py`, `player.py`: deck (draws from the front) and player state, including the forced Countess rule (playable cards) and a `seat`.
- `strategy.py`: base `Strategy` class. It provides random defaults and per-card targeting hooks (`choose_guard_target`, `choose_prince_target`, ...) so a bot can override just one card's targeting.
- `bots/`: the bots themselves (`bot_random.py`, `bot_no_princess.py`, `bot_card_counter.py`).
- `view.py`: `PlayerView`, `view_for`, `redact_turn`. One view per player is built at the start of each turn, so a strategy sees only legitimate information. The view is also used for the server's live display.
- `history.py`: dataclasses (`TurnHistory`, `RoundHistory`, `GameHistory`, `ShowdownHistory`). They are write-only while the game runs; the game never reads them back.
- `observers/`: Observers consume history events (`on_game_start`, `on_round_start`, `on_turn_start`, `on_turn_end`, `on_showdown`, `on_round_end`, `on_game_end`). Includes `ConsoleLogger`; `LLNWriter` is being developed on the LLN branch.
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

A chess-PGN-inspired notation for recording games. Current version is **LLN 1.1**.

- Header tags: version, players (with strategy names), round, dealer, shuffled deck order, result (including the whole-game result).
- Movetext lines are `cycle.seat.` followed by `-` (skipped/rejected player) or an action: card letter (`g` Guard, `p` Priest, `B` Baron, `H` Handmaid, `P` Prince, `K` King, `C` Countess, `Q` Princess), a target seat, and a suffix (`*` protected target, `#` target rejected, `=` Baron draw, `>` / `<` Baron win/lose). Guard guesses use a colon (`g4:H`) and a guess is never a Guard. Cards seen via a Priest are not recorded. Seats are absolute. Skipped-turn lines for rejected players stay in the file. Rounds end with a result such as `W3`.
- Four-player only for now; other variants are postponed.
- Status: `LLNWriter` (`observers/llnwriter.py`) writes LLN 1.1 via `to_lln` / `save_file` (files go to `games/{date}/{time}`). Planned: more descriptive filenames, multi-game support, efficient storage of ~1000-game simulations, and a **parser** that turns a `.lln` file back into a `GameHistory` with its `RoundHistory`s and `TurnHistory`s.
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
