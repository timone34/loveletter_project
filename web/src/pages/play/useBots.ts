import { useCallback, useEffect, useState } from "react";

// One bot from the bots/ folder, as listed by server.py's GET /api/bots.
export type BotInfo = { id: string; name: string; description: string };

export function useBots() {
  const [bots, setBots] = useState<BotInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bump to fetch again

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bots") // proxied to FastAPI by vite.config.ts
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BotInfo[]>;
      })
      .then((list) => {
        if (cancelled) return;
        setBots(list);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Can't reach the game server.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { bots, error, retry };
}
