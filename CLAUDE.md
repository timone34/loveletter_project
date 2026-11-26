# CLAUDE.md

Guidance for AI agents working in this repo. Read this first; read the code for everything else.

## Project goal

A Python recreation of the card game **Love Letter** (4 players), built as a framework for:

1. **Writing bots** (Strategies) that are easy to program and only see what they legitimately could.
2. **Running diagnostics** on bot versions: simulate many games, compute stats, compare bots.
3. **Finding a "perfect" strategy**, by iterating on bots and measuring each iteration.

The game rules ("the bones") should be solid but as simple as possible, so Strategies and stat-crunching Observers are easy to write.

Secondary goal: a **YouTube video** on Love Letter and the bot-building journey, in the style of Sebastian Lague: a short rules section, then results over code (what each bot iteration adds and how much it improves). Prioritise clear, reproducible results and good visuals over polishing code internals.

## Git and branches (read before any commit or push)

- **NEVER commit to or push to a branch whose name doesn't start with `claude/`.** Check `git branch --show-current` before every commit and push.
- Work goes on clearly named `claude/<topic>` branches made from an up-to-date `main`, one per piece of work.
- Commit and push to `claude/` branches freely whenever you make an edit. Keep every local branch in sync with GitHub (`gh` is installed).
- Only ask before opening a PR into `main`. When you think a feature is finished, first ask the owner to test it, then ask to open the PR.
- Don't merge into, push to, rebase or reset the owner's branches (`main`, ...) unless explicitly asked. Merging `main` *into* a `claude/` branch is fine.
- **Don't leave old branches lying around.** Delete merged branches locally and on GitHub. Abandoned or superseded work is simply deleted too. Only archive (`archived/<name>`) a **really big** architectural difference or complete rework, e.g. `archived/copilot`, which built the whole website differently.

## Working agreement

- **Do not repeat yourself, and do not suggest things that are already implemented.** Check the code before proposing a feature.
- Game logic and stats correctness matter more than speed: wrong numbers fail silently and will be presented publicly. Sanity-check changes: equal bots win about 25% each, win rates sum to 100%, the same seed/deck gives the same result.
- The owner is fairly experienced with Python/numpy, new to pandas, and new to frontend/web development. For frontend work, explain what each file does so the design can be extended by hand. Agents for web plumbing are fine; bot logic and metric definitions deserve more care and explanation.
- The owner uses a type checker: keep annotations correct (e.g. `Card | None`, pandas return types).

## Architecture rules

- `engine/` is the hard rules and **must never import from outside `engine/`**. Bots, observers, stats, LLN and the server depend on it, never the other way around. If a change changes the game itself, it belongs in `engine/`; everything else gets its own folder. Entry points (`main.py`, `experiment.py`, `server.py`) stay in the repo root.
- Strategies only get legitimate information (`engine/view.py`). The webapp uses the same redaction for the human seat.
- History dataclasses are write-only while a game runs; the game never reads them back.
- Shared targeting code belongs in the `Card` base class rather than repeated per card (still being cleaned up).

## Bots so far (the "ladder")

Random → NoPrincessDumb (never plays the Princess voluntarily) → NoPrincess (also never Princes itself while holding the Princess; no visible improvement over NoPrincessDumb in 10,000 games) → CardCounter (tracks cards out of play for Guard guesses and Baron comparisons).

Planned: an evaluation-function bot that scores game states and looks ahead, chess-bot style.

Record each bot's results under a fixed experiment setup (same opponents, same number of games). Negative results are as valuable as positive ones: good material for the video.

## Love Letter Notation (LLN)

A chess-PGN-inspired notation for recording games, currently **LLN 1.5** (the writer and parser in `lln/` are the spec; `games/example_game_annotated_v1.5.lln` explains it). Design decisions:

- Four players only for now. Seats are absolute. Cards seen via a Priest are not recorded. A Guard guess is never a Guard. Skipped turns of rejected players stay in the file.
- The examples in `games/` (1.4 and 1.5 versions of the same game) must keep parsing; older files are in `games/legacy/`.
- Replaying a recorded deck order with different bots is an intended use (`rerun_decks`); `simulate(seed=...)` gives new runs on identical decks.
- 1000 games are ~650 KB in 1.5; compressing (`.lln.bz2`, ~10x) is the next option if size matters.

## Webapp

The main workspace. Everything starts on one setup page (`/new`, `web/src/pages/setup/`): a lineup of four bots plus a mode switch:

- **Play**: you take a seat (the fourth bot sits out), then the table (`/play/table`), live against own bots via the WebSocket. Designed for the owner's desktop in fullscreen (no scaling-based layout). Cards are uniform in design, only the LLN letter differs.
  - Table features: icon toolbar (lucide-react), full screen (F, the whole page like F11), on-table speed, cheat sheet with unseen counts (C), action log with each turn's LLN line (sent by the server) and history browsing (←/→, End = live; the game keeps running; short steps animate, played backwards when stepping back: `useBrowse.ts`), keyboard play (1-9), click-to-target, "Back" on target/guess prompts (the server's `Web_Strategy` asks card, target and guess all inside `choose_card`, so the card can still change), a round summary.
  - The setup page starts from defaults on every visit, except via the table's "Table settings" button (router state `keep`) or a Stats page's "Edit & run".
  - Animations (`web/src/pages/play/motion/`, using `motion`): `plan.ts` turns each event into card flights between `data-slot`s and badges (worked out from the event, since cards have no identity); `FlightLayer.tsx` flies ghost cards over the table and hides the destination until they land. Durations scale with speed and fit inside the server's `PACE`.
- **Watch**: four bots play one game on the same table (`TableConfig.mode == "watch"`, no human seat, `youSeat` null).
- **Simulate**: runs play in the background (`runs/`, one at a time) and land on their Stats page.
- **History / Stats**: the simulation history (`/stats`, saved in `simulations/`) and one run's stats (`/stats/<id>`), filling in live while it plays. The stat definitions live in `stats/tally.py` (docstring); the charts are hand-written SVG/CSS in `web/src/pages/stats/charts/`. Changing what a saved stat means or how it's stored: bump `FORMAT` in `runs/history.py`, so older runs show as outdated (re-runnable from their seed) instead of with wrong numbers.
- **Performance** (section 4 of a run's Stats page): `stats/timing.py` wraps each bot in a stopwatch (`TimedStrategy`, outside `engine/`; timed games are identical to untimed ones) when the run's "Measure think time" toggle (`measureTime`) is on. Every run also times its phases (play / count / LLN). The latest speed per lineup is kept in `simulations/meta/lineup_speeds.json` for the Setup page's time estimate. Times are wall time: never compare them across machines.

Style: modern, slightly "vibe-coded" but in the owner's own coding style, JetBrains Mono, palette in `web/src/index.css` (light green is the favourite colour). A dark mode toggle is wanted.

Ideas on the table: a Bots page (the ladder: each bot's results across runs, compare two runs), showing bots' reasoning while watching, accounts with online play and career stats. Not a focus yet: a Stockfish-like engine (best moves, LLN lines, hit-chance percentages).

## Next steps under consideration

- A `strategy` column in the stats tables, so bot versions can be compared when seats rotate and names differ.
- Duplicate deals in `simulate()`: replay each shuffle with rotated seats so luck cancels out and fewer games are needed.
- A single "ladder" experiment function: bot in, win rate and CI against a fixed field out.
