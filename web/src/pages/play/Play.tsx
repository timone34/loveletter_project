import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header, Footer } from "../../components/Header";

import { PlayerSeat } from "./components/PlayerSeat";
import { DeckPile } from "./components/DeckPile";
import { TablePanel } from "./components/TablePanel";
import { TableControls } from "./components/TableControls";
import { ActionLog } from "./components/ActionLog";
import { CheatSheet } from "./components/CheatSheet";
import { FlightLayer } from "./motion/FlightLayer";
import { isLogged, useGame } from "./useGame";
import { useBrowse } from "./useBrowse";
import { useFullscreen } from "./useFullscreen";
import { botsAtTable, loadConfig, saveConfig, type Speed } from "./config";
import "./Play.css";

const CHEAT_KEY = "loveletter.cheatSheet"; // remembers whether the cheat sheet is open

export default function Play() {
  const game = useGame();
  const { prompt, status, feed } = game;
  const navigate = useNavigate();
  const location = useLocation();

  // the settings from the setup page (/new); "New game" reuses them, with the speed chosen here
  const [config] = useState(loadConfig);
  const [speed, setSpeed] = useState<Speed>(config.speed);
  const newGame = useCallback(() => game.newGame({ ...config, speed }), [game, config, speed]);
  const changeSpeed = (s: Speed) => {
    setSpeed(s);
    game.setSpeed(s);
    saveConfig({ ...config, speed: s });
  };

  // arriving from the setup page's "Sit down": start as soon as we're connected
  const autoStart = useRef(location.state?.start === true);
  useEffect(() => {
    if (status.connected && autoStart.current) {
      autoStart.current = false;
      game.newGame(config);
    }
  }, [status.connected, game, config]);

  // ----- Browsing the log (useBrowse.ts): which event is on the table, null = live ----- //
  const browse = useBrowse(feed, speed, game.flip);
  const view = browse.shown;
  const table = view !== null ? feed[view].table : game.table;
  const live = browse.live;
  const step = browse.stepLog;

  // ----- Panels and full screen ----- //
  const [cheatSheet, setCheatSheet] = useState(() => {
    try {
      return localStorage.getItem(CHEAT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleCheatSheet = useCallback(() => {
    setCheatSheet((open) => {
      try {
        localStorage.setItem(CHEAT_KEY, open ? "0" : "1");
      } catch {
        // not remembered; it still toggles
      }
      return !open;
    });
  }, []);

  const felt = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen();

  // ----- Seats ----- //
  // The bottom seat is yours; when watching (no seat of yours) it's seat 1.
  const bottom = table?.youSeat ?? 0;
  const you = table?.players[bottom];
  const opponents = table
    ? [...table.players.slice(bottom + 1), ...table.players.slice(0, bottom)]
    : [];
  const livePrompt = live ? prompt : null; // a past table can't be played on
  const cardPrompt = livePrompt?.kind === "card" ? livePrompt : null;
  const targetPrompt = livePrompt?.kind === "target" ? livePrompt : null;
  const onTarget = (seat: number) => {
    const i = targetPrompt?.options.indexOf(seat) ?? -1;
    return i >= 0 ? () => game.choose(i) : undefined;
  };
  const winsNeeded = table?.winsNeeded ?? 3;

  // ----- Keyboard ----- //
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable=true]")) return;

      const key = e.key.toLowerCase();
      const digit = Number(e.key);
      if (key === "arrowleft" || key === "arrowup") step(-1);
      else if (key === "arrowright" || key === "arrowdown") step(1);
      else if (key === "home") browse.goTo(feed.findIndex(isLogged) >= 0 ? feed.findIndex(isLogged) : null);
      else if ((key === "escape" || key === "backspace") && livePrompt && livePrompt.kind !== "card" && livePrompt.cancellable) game.cancel();
      else if (key === "end" || key === "escape") browse.goTo(null);
      else if (key === " " && status.running) game.togglePause();
      else if (key === "f") fullscreen.toggle();
      else if (key === "c") toggleCheatSheet();
      else if (key === "r" && status.connected) game.toggleReveal();
      else if (digit >= 1 && digit <= 9 && livePrompt) {
        // 1, 2, ...: the cards in your hand, or the options in the panel
        const i = digit - 1;
        if (i >= livePrompt.options.length) return;
        if (livePrompt.kind === "card" && !livePrompt.playable[i]) return;
        game.choose(i);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, feed, status, game, fullscreen, toggleCheatSheet, livePrompt, browse]);

  const caption = view !== null ? feed[view].caption : game.caption;

  return (
    <div className="page">
      <Header />

      <main className={cheatSheet ? "play play--cheat" : "play"}>
        {cheatSheet && <CheatSheet table={table} onClose={toggleCheatSheet} />}

        <section className="table">
          <header className="table__header">
            <div>
              <p className="table__eyebrow">
                {table && table.round > 0
                  ? `Round ${table.round} • ${table.players.length} Players`
                  : "4 Players"}
              </p>
              <h1 className="table__title">{table?.name ?? config.name}</h1>
            </div>

            <div className="table__aside">
              {table && (
                <div className="table__chips">
                  <span className="chip">First to {table.winsNeeded}</span>
                  {table.youSeat !== null && <span className="chip">{table.visibility === "public" ? "Public" : "Private"}</span>}
                  {config.deckSeed && <span className="chip">Seed · {config.deckSeed}</span>}
                </div>
              )}

              <TableControls
                status={status}
                speed={speed}
                fullscreen={fullscreen.active}
                cheatSheet={cheatSheet}
                onNewGame={newGame}
                onSettings={() => navigate("/new", { state: { keep: true } })}
                onPause={game.togglePause}
                onReveal={game.toggleReveal}
                onSpeed={changeSpeed}
                onCheatSheet={toggleCheatSheet}
                onFullscreen={fullscreen.toggle}
              />
            </div>
          </header>

          <div className={live ? "felt" : "felt felt--past"} ref={felt}>
            {!live && (
              <button type="button" className="felt__past" onClick={() => browse.goTo(null)}>
                Earlier in the game · back to live (End)
              </button>
            )}

            <div className="opponents">
              {opponents.map((p) => (
                <PlayerSeat key={p.seat} player={p} winsNeeded={winsNeeded} dealer={p.seat === table?.dealer} onTarget={onTarget(p.seat)} />
              ))}
            </div>

            <div className="deck-area">
              <p className="deck-area__caption" aria-live="polite">{caption}</p>
              {table ? (
                <DeckPile count={table.deckCount} inRound={table.round > 0} burn={table.burn ?? null} burnTaken={table.burnTaken ?? false} />
              ) : (
                <span />
              )}
              <TablePanel
                table={table}
                prompt={livePrompt}
                status={status}
                winner={live ? game.winner : null}
                error={game.error}
                onChoose={game.choose}
                onCancel={game.cancel}
                onNewGame={newGame}
                onSettings={() => navigate("/new", { state: { keep: true } })}
                opponents={botsAtTable(config).map((o) => o.name)}
                watching={config.mode === "watch"}
                onResume={game.togglePause}
                onReconnect={game.reconnect}
                feed={live ? feed : []}
              />
            </div>

            {you && (
              <PlayerSeat
                player={you}
                winsNeeded={winsNeeded}
                variant="you"
                dealer={you.seat === table?.dealer}
                onPickCard={cardPrompt ? game.choose : undefined}
                pickable={cardPrompt?.playable}
                onTarget={onTarget(you.seat)}
              />
            )}
          </div>
        </section>

        <ActionLog feed={feed} viewing={browse.headed ?? view} table={table} onSelect={browse.goTo} />
      </main>

      {/* outside the felt: its "earlier in the game" filter would shift fixed-position ghosts */}
      <FlightLayer step={browse.motion} root={felt} />

      <Footer />
    </div>
  );
}
