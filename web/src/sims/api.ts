import { useCallback, useEffect, useState } from "react";
import { isActive, type RunConfig, type RunRecord } from "./types";

// Talking to /api/simulations (server.py). Every call goes through the Vite
// proxy to FastAPI, like /api/bots.

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!r.ok) {
    // FastAPI puts the reason in "detail" (e.g. "Every player needs a different name.")
    const detail = await r.json().then((b) => b?.detail).catch(() => null);
    throw new Error(typeof detail === "string" ? detail : `HTTP ${r.status}`);
  }
  return (r.status === 204 ? null : r.json()) as Promise<T>;
}

export const startRun = (config: RunConfig) =>
  call<RunRecord>("/api/simulations", { method: "POST", body: JSON.stringify(config) });

export const renameRun = (id: string, name: string) =>
  call<RunRecord>(`/api/simulations/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });

export const deleteRun = (id: string) => call<null>(`/api/simulations/${id}`, { method: "DELETE" });

export const llnUrl = (id: string) => `/api/simulations/${id}/lln`;

const POLL_MS = 500; // how often to ask for news while something is running

// One run. While it's queued or running, it's fetched again every POLL_MS,
// so its stats fill in live.
export function useRun(id: string | undefined) {
  const [run, setRun] = useState<RunRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: number | undefined;
    const load = () =>
      call<RunRecord>(`/api/simulations/${id}`)
        .then((r) => {
          if (cancelled) return;
          setRun(r);
          setError(null);
          if (isActive(r)) timer = window.setTimeout(load, POLL_MS);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message === "HTTP 500" ? "Can't reach the game server." : e.message);
        });
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id]);

  return { run, error, setRun };
}

// Every run, newest first. Polls while any of them is still going.
export function useRuns() {
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bump to fetch again now

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = () =>
      call<RunRecord[]>("/api/simulations")
        .then((list) => {
          if (cancelled) return;
          setRuns(list);
          setError(null);
          if (list.some(isActive)) timer = window.setTimeout(load, POLL_MS * 2);
        })
        .catch(() => {
          if (!cancelled) setError("Can't reach the game server.");
        });
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { runs, error, reload };
}
