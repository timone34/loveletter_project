import type { ReactNode } from "react";

// "01 Seats   a note ...   [action]": the numbered heading above each part of a
// setup page. Styles: .section-title in components/common.css.
export function SectionTitle({ n, title, note, action }: { n: number; title: string; note?: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>
        <span className="section-title__n">0{n}</span> {title}
      </h2>
      {note && <p className="section-title__note">{note}</p>}
      {action && <div className="section-title__action">{action}</div>}
    </div>
  );
}
