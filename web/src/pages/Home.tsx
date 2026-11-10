import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { CardArt, type CardKind } from "../components/CardArt";
import "./Home.css";

export type Mode = "play" | "simulate" | "stats";

type ModeCard = {
  mode: Mode;
  kind: CardKind;
  value: number; // the Love Letter value of the character on the card
  title: string;
  blurb: string;
};

const MODES: ModeCard[] = [
  {
    mode: "play",
    kind: "guard",
    value: 1,
    title: "Play",
    blurb: "Sit down at the table against your own bots.",
  },
  {
    mode: "simulate",
    kind: "prince",
    value: 5,
    title: "Simulate",
    blurb: "Run thousands of games between the bots you pick.",
  },
  {
    mode: "stats",
    kind: "baron",
    value: 3,
    title: "Stats",
    blurb: "Compare win rates and find out why a bot wins.",
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="topbar">
        <span className="wordmark">Love Letter Strategy</span>
        <span className="version">v1.0</span>
        <span className="home-button">Home</span>
        <span className="play-button">Play</span>
        <span className="sim-button">Simulate</span>
        <span className="stats-button">Stats</span>
      </header>

      <main className="hero">
        <div className="hero__text">
          <h1>Find the perfect game of Love Letter.</h1>
          <p className="hero__intro">
            Love Letter is a four-player game of hidden hands and educated
            guesses. This is a workbench for one question: what does perfect
            play look like? Play against bots you wrote, simulate thousands of
            games, and compare strategies by the numbers.
          </p>
          <p className="hero__hint">Pick a card to begin.</p>
        </div>

        <div className="fan">
          {MODES.map((m, i) => (
            <button
              key={m.mode}
              type="button"
              className="card"
              data-kind={m.kind}
              style={{ "--i": i } as CSSProperties}
              onClick={() => navigate(`/${m.mode}`)}
            >
              <span className="card__art">
                <span className="card__value">{m.value}</span>
                <CardArt kind={m.kind} className="card__silhouette" />
              </span>
              <span className="card__body">
                <span className="card__title">{m.title}</span>
                <span className="card__blurb">{m.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </main>

      <footer className="footer">
        made with {"<3"} by timone34
      </footer>
    </div>
  );
}