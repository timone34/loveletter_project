import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import type { ModeCardId } from "../../components/cardData";

import { Header, Footer } from "../../components/Header";
import "./Home.css";

const MODES: ModeCardId[] = ["play", "simulate", "stats"];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <Header />

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
          {MODES.map((id, i) => (
            <button
              key={id}
              type="button"
              className="mode-button"
              style={{ "--i": i } as CSSProperties}
              onClick={() => navigate(`/${id}`)}
            >
              <Card id={id} className="mode-button__card"/>
            </button>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}