import { useCallback, useEffect, useRef, useState } from "react";
import { describe } from "./describe";
import type { TableConfig } from "./config";
import type { Prompt, ServerMessage, TableView } from "./types";

const SOCKET_PATH = "/ws/play"; // proxied to FastAPI by vite.config.ts

export type GameStatus = {
  connected: boolean;
  running: boolean; // a game is in progress on the server
  paused: boolean;
  reveal: boolean;
};

export function useGame() {
  const [table, setTable] = useState<TableView | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [caption, setCaption] = useState("");
  const [winner, setWinner] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<GameStatus>({
    connected: false, running: false, paused: false, reveal: false,
  });
  const [attempt, setAttempt] = useState(0); // bump to reconnect
  const socket = useRef<WebSocket | null>(null);

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
      setCaption(describe(msg, msg.table));
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

  const newGame = useCallback((config: TableConfig) => {
    setPrompt(null);
    setWinner(null);
    setError(null);
    setCaption("");
    send({ type: "new_game", config });
  }, [send]);

  const togglePause = useCallback(
    () => send({ type: status.paused ? "resume" : "pause" }),
    [send, status.paused],
  );

  const toggleReveal = useCallback(
    () => send({ type: "reveal", on: !status.reveal }),
    [send, status.reveal],
  );

  // answer the current prompt with an index into prompt.options
  const choose = useCallback((index: number) => {
    setPrompt(null);
    send({ type: "choice", index });
  }, [send]);

  const reconnect = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    table, prompt, caption, winner, error, status,
    newGame, togglePause, toggleReveal, choose, reconnect,
  };
}
