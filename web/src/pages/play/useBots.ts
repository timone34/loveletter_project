import { useCallback, useEffect, useState } from "react";

// One bot from the bots/ folder, as listed by server.py's GET /api/bots.
// family + version: the setup page shows one card per family with a version
// dropdown. listed = false: hidden from the library (still valid in a lineup).
export type BotInfo = { id: string; name: string; description: string; family: string; version: string; listed: boolean };

// The bots grouped by family, in the server's order (the ladder order).
export type BotFamily = { family: string; versions: BotInfo[] };

export function botFamilies(bots: BotInfo[]): BotFamily[] {
  const families: BotFamily[] = [];
  for (const bot of bots) {
    const family = families.find((f) => f.family === bot.family);
    if (family) family.versions.push(bot);
    else families.push({ family: bot.family, versions: [bot] });
  }
  return families;
}

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
