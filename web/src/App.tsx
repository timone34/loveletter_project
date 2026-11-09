import { useEffect, useState } from "react";

type GameEvent = { type: string; [key: string]: unknown };

export default function App() {
  const [events, setEvents] = useState<GameEvent[]>([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/spectate");
    ws.onmessage = (e) => setEvents((prev) => [...prev, JSON.parse(e.data)]);
    return () => ws.close();
  }, []);

  return <pre>{events.map((e) => JSON.stringify(e)).join("\n")}</pre>;
}