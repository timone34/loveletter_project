import type { CSSProperties } from "react";
import { Card } from "../../components/Card";
import { GAME_CARDS } from "../../components/cardData";

import { Header, Footer } from "../../components/Header";
import "./Play.css";


export default function Play() {
  return (
    <div className="page">
      <Header />

      <main className="preview">
        <section>
          <h2 className="preview__title">All cards</h2>
          <div className="preview__grid">
            {GAME_CARDS.map((c) => (
              <Card key={c.id} id={c.id} width="200px" className={c.id}/>
            ))}
            <Card faceDown width="200px" className="face-down" />
          </div>
        </section>

        <section>
          <h2 className="preview__title">At the table (scaling test)</h2>
          <div className="table">
            <div className="table__opponents">
              {[-8, 0, 8].map((deg) => (
                <Card
                  key={deg}
                  faceDown
                  width="110px"
                  className="table__back"
                  style={{ "--tilt": `${deg}deg` } as CSSProperties}
                />
              ))}
            </div>

            <div className="table__hand">
              <Card id="countess" width="200px" className="table__card" />
              <Card id="prince" width="200px" className="table__card" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}