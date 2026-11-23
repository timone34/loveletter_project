import type { ReactNode } from "react";

// One "value  label" row in a tooltip, keyed with a short stroke of the series colour.
export function TipRow({ color, value, label }: { color?: string; value: ReactNode; label: ReactNode }) {
  return (
    <div className="tip__row">
      {color && <span className="tip__key" style={{ background: color }} />}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
