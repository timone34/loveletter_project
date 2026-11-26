import { useCallback, useEffect, useRef, useState } from "react";
import { describe } from "./describe";
import type { Speed, TableConfig } from "./config";
import type { GameEvent, Prompt, ServerMessage, TableView } from "./types";

const SOCKET_PATH = "/ws/play"; // proxied to FastAPI by vite.config.ts

export type GameStatus = {
  connected: boolean;
  running: boolean; // a game is in progress on the server
  paused: boolean;
  reveal: boolean;
};

// One game event as it arrived, with the table right before and right after it.
// The action log lists these, browsing the log shows `table`, and the
// animations compare `before` with `table`.
export type FeedEntry = {
  seq: number; // counts up over the whole session, so React keys never repeat
  event: GameEvent;
  table: TableView;
  before: TableView | null;
  caption: string; // describe(event): one plain-English sentence
};

// Which events get a line in the action log. The others (game_start,
// turn_start) only move the table along.
export const isLogged = (e: FeedEntry) => e.event.type !== "game_start" && e.event.type !== "turn_start";

// "Reveal hands" was toggled: the tables before and after (the live one, and
// the log's snapshots in `beforeFeed`, by index), to turn the cards over.
export type FlipEvent = { seq: number; before: TableView; after: TableView; beforeFeed: FeedEntry[] };

type EventMessage = GameEvent & { table: TableView };

function toEntry(msg: EventMessage, seq: number, before: TableView | null): FeedEntry {
  const { table, ...event } = msg;
  return { seq, event, table, before: event.type === "game_start" ? null : before, caption: describe(event, table) };
}

// The log again, with the server's resent events (same game, same order, now
// seen with "reveal hands" on or off). Events that arrive after the resend
// was made are kept as they are.
function reseen(feed: FeedEntry[], history: EventMessage[]): FeedEntry[] {
  if (!feed.length || history[0]?.type !== feed[0].event.type) return feed;
  return feed.map((entry, i) =>
    i < history.length ? toEntry(history[i], entry.seq, i > 0 ? history[i - 1].table : null) : entry,
  );
}

export function useGame() {
  const [table, setTable] = useState<TableView | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]); // this game's events, oldest first
  const [flip, setFlip] = useState<FlipEvent | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<GameStatus>({
    connected: false, running: false, paused: false, reveal: false,
  });
  const [attempt, setAttempt] = useState(0); // bump to reconnect
  const socket = useRef<WebSocket | null>(null);
  const lastTable = useRef<TableView | null>(null); // the `before` of the next event
  const seq = useRef(0);
  const feedRef = useRef<FeedEntry[]>([]); // the feed as of the last message (the handler reads it)
  const putFeed = useCallback((next: FeedEntry[]) => {
    feedRef.current = next;
    setFeed(next);
  }, []);

  useEffect(() => {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${window.location.host}${SOCKET_PATH}`);
    socket.current = ws;

    ws.onopen = () => setStatus((s) => ({ ...s, connected: true }));

    ws.onclose = () => {
      if (socket.current !== ws) return; // an older socket (StrictMode remount, reconnect)
      socket.current = null;
      setStatus((s) => ({ ...s, connected: false, running: false }));
      setPrompt(null);
    };

    ws.onmessage = (e: MessageEvent<string>) => {
      const msg = JSON.parse(e.data) as ServerMessage;

      switch (msg.type) {
        case "status":
          setStatus((s) => ({ ...s, running: msg.running, paused: msg.paused, reveal: msg.reveal }));
          return;
        case "error":
          setError(msg.message);
          setPrompt(null);
          return;
        case "table": { // resent after toggling "reveal hands", with the log's events
          const beforeFeed = feedRef.current;
          if (msg.history) putFeed(reseen(beforeFeed, msg.history));
          if (lastTable.current) setFlip({ seq: ++seq.current, before: lastTable.current, after: msg.table, beforeFeed });
          lastTable.current = msg.table;
          setTable(msg.table);
          return;
        }
        case "prompt":
          lastTable.current = msg.table;
          setTable(msg.table);
          setPrompt(msg.prompt);
          return;
      }

      // everything else is a game event
      const entry = toEntry(msg, ++seq.current, lastTable.current);
      const event = entry.event;
      lastTable.current = entry.table;
      setTable(entry.table);
      putFeed(event.type === "game_start" ? [entry] : [...feedRef.current, entry]);
      if (event.type === "game_start") {
        setWinner(null);
        setError(null);
      }
      if (event.type === "game_end") setWinner(event.winner);
    };

    return () => ws.close();
  }, [attempt, putFeed]);

  const send = useCallback((msg: object) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const newGame = useCallback((config: TableConfig) => {
    setPrompt(null);
    setWinner(null);
    setError(null);
    putFeed([]);
    send({ type: "new_game", config });
  }, [send, putFeed]);

  const togglePause = useCallback(
    () => send({ type: status.paused ? "resume" : "pause" }),
    [send, status.paused],
  );

  const toggleReveal = useCallback(
    () => send({ type: "reveal", on: !status.reveal }),
    [send, status.reveal],
  );

  // changes the pace of the running game (new games take it from their config)
  const setSpeed = useCallback((speed: Speed) => send({ type: "speed", speed }), [send]);

  // answer the current prompt with an index into prompt.options
  const choose = useCallback((index: number) => {
    setPrompt(null);
    send({ type: "choice", index });
  }, [send]);

  // "Back" on a target or guess prompt: the server asks for a card again
  const cancel = useCallback(() => {
    setPrompt(null);
    send({ type: "cancel" });
  }, [send]);

  const reconnect = useCallback(() => setAttempt((n) => n + 1), []);

  const latest = feed.length ? feed[feed.length - 1] : null;

  return {
    table, prompt, feed, latest, flip, winner, error, status,
    caption: latest?.caption ?? "",
    newGame, togglePause, toggleReveal, setSpeed, choose, cancel, reconnect,
  };
}
