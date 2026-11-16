import { useCallback, useEffect, useRef, useState } from "react";
import { describe, historyEntry, type HistoryEntry } from "./describe";
import type { Prompt, ServerMessage, TableView } from "./types";

const SOCKET_PATH = "/ws/play"; // proxied to FastAPI by vite.config.ts

export type GameStatus = {
  connected: boolean;
  connecting: boolean;
  running: boolean; // a game is in progress on the server
  paused: boolean;
  revealHands: boolean;
  revealBurn: boolean;
};

export type GameSetup = {
  bots: ("random" | "no-princess")[];
  botNames: string[];
  tableName: string;
  targetRoundWins: number;
  revealHands: boolean;
  revealBurn: boolean;
  deckBackdrop: "rectangle" | "none";
};

export function useGame() {
  const [table, setTable] = useState<TableView | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [caption, setCaption] = useState("");
  const [log, setLog] = useState<HistoryEntry[]>([]);
  const [winner, setWinner] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<GameStatus>({
    connected: false,
    connecting: false,
    running: false,
    paused: false,
    revealHands: false,
    revealBurn: false,
  });
  const [attempt, setAttempt] = useState(0); // bump to reconnect
  const socket = useRef<WebSocket | null>(null);
  const setup = useRef<GameSetup | null>(null);

  useEffect(() => {
    if (!setup.current) return;
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${window.location.host}${SOCKET_PATH}`);
    socket.current = ws;

    ws.onopen = () => {
      if (socket.current !== ws) return;
      setStatus((s) => ({ ...s, connected: true, connecting: false }));
      ws.send(JSON.stringify({ type: "new_game", ...setup.current }));
    };

    ws.onclose = () => {
      if (socket.current !== ws) return; // an older socket (StrictMode remount, reconnect)
      socket.current = null;
      setStatus((s) => ({ ...s, connected: false, connecting: false, running: false }));
      setPrompt(null);
    };

    ws.onmessage = (e: MessageEvent<string>) => {
      const msg = JSON.parse(e.data) as ServerMessage;

      switch (msg.type) {
        case "status":
          setStatus((s) => ({
            ...s,
            running: msg.running,
            paused: msg.paused,
            revealHands: msg.revealHands,
            revealBurn: msg.revealBurn,
          }));
          return;
        case "error":
          setError(msg.message);
          setPrompt(null);
          return;
        case "table": // resent after toggling "reveal hands"
          setTable(msg.table);
          return;
        case "prompt":
          setTable(msg.table);
          setPrompt(msg.prompt);
          return;
      }

      // everything else is a game event
      setTable(msg.table);
      const description = describe(msg, msg.table);
      setCaption(description);
      const entry = historyEntry(msg, msg.table);
      if (entry) setLog((entries) => [...entries, entry]);
      if (msg.type === "game_start") {
        setWinner(null);
        setError(null);
      }
      if (msg.type === "game_end") setWinner(msg.winner);
    };

    return () => ws.close();
  }, [attempt]);

  const send = useCallback((msg: object) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const startGame = useCallback((config: GameSetup) => {
    setup.current = config;
    setPrompt(null);
    setWinner(null);
    setError(null);
    setCaption("");
    setLog([]);
    setStatus((s) => ({ ...s, connected: false, connecting: true }));
    setAttempt((n) => n + 1);
  }, []);

  const returnToSetup = useCallback(() => {
    setup.current = null;
    socket.current?.close();
    socket.current = null;
    setTable(null);
    setPrompt(null);
    setWinner(null);
    setError(null);
    setCaption("");
    setLog([]);
    setStatus({
      connected: false,
      connecting: false,
      running: false,
      paused: false,
      revealHands: false,
      revealBurn: false,
    });
  }, []);

  const newGame = useCallback(() => {
    if (!setup.current) return;
    setPrompt(null);
    setWinner(null);
    setError(null);
    setCaption("");
    setLog([]);
    send({
      type: "new_game",
      ...setup.current,
      revealHands: status.revealHands,
      revealBurn: status.revealBurn,
    });
  }, [send, status.revealHands, status.revealBurn]);

  const togglePause = useCallback(
    () => send({ type: status.paused ? "resume" : "pause" }),
    [send, status.paused],
  );

  const toggleRevealHands = useCallback(
    () => send({ type: "visibility", hands: !status.revealHands, burn: status.revealBurn }),
    [send, status.revealHands, status.revealBurn],
  );

  const toggleRevealBurn = useCallback(
    () => send({ type: "visibility", hands: status.revealHands, burn: !status.revealBurn }),
    [send, status.revealHands, status.revealBurn],
  );

  // answer the current prompt with an index into prompt.options
  const choose = useCallback((index: number) => {
    setPrompt(null);
    send({ type: "choice", index });
  }, [send]);

  const reconnect = useCallback(() => {
    setStatus((s) => ({ ...s, connecting: true }));
    setAttempt((n) => n + 1);
  }, []);

  return {
    table, prompt, caption, log, winner, error, status,
    startGame, returnToSetup, newGame, togglePause, toggleRevealHands, toggleRevealBurn, choose, reconnect,
  };
}
