import type { CSSProperties } from "react";
import { CARD_BY_ID, type CardId } from "./cardData";
import "./Card.css";

type Props = {
    id?: CardId;
    faceDown?: boolean;
    width?: string;
    className?: string;
    style?: CSSProperties;
}

export function Card({ id, faceDown, width, className = "", style }: Props) {
    const css = { ...(width ? { "--card-w": width } : {}), ...style } as CSSProperties;

    if (faceDown || !id) {
        return (
            <div className={`card ${className}`} style={css}>
                <div className="card__backface">
                    <span className="card__backtext">Love Letter</span>
                </div>
            </div>
        );
    }

    const info = CARD_BY_ID[id];
    const isLowercase = info.letter === info.letter.toLowerCase();

    return (
        <div className={`card ${className}`} style={css}>
            <div className="card__face">
                <div className="card__portrait">
                    <span className="card__value">{info.value}</span>
                    <span className={isLowercase ? "card__letter-raised" : "card__letter"}>
                        {info.letter}
                    </span>
                </div>

                <div className="card__body">
                    <div className="card__head">
                        <h3 className="card__name">{info.name}</h3>

                        {/* one tick per copy in the deck: Guard has 5, Princess has 1 */}
                        <div className="card__ticks" aria-label={`${info.copies} in the deck`}>
                            {Array.from({ length: info.copies }, (_, i) => (
                                <span key={i} className="card__tick" />
                            ))}
                        </div>
                    </div>
                    <p className="card__text">{info.text}</p>
                </div>
            </div>
        </div>
    )
}