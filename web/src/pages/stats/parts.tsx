import type { ReactNode } from "react";

// Building blocks of the Stats page (Results.tsx and Performance.tsx).
// Styles: .kpi and .stat-card in Stats.css.

// A big number with a label above it and an optional line below.
export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      {sub && <span className="kpi__sub">{sub}</span>}
    </div>
  );
}

// One chart or table with its title and a note on how to read it.
export function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="stat-card">
      <header className="stat-card__head">
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}
