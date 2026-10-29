from game import Game
from deck import Deck
from cards import Card, Guard, Priest, Baron, Handmaid, Prince, King, Countess, Princess


LLN_VERSION = "1.0"

CARD_TO_LLN: dict[type[Card], str] = {
    Guard: "g",
    Priest: "p",
    Baron: "B",
    Handmaid: "H",
    Prince: "P",
    King: "K",
    Countess: "C",
    Princess: "Q",
}
LLN_TO_CARD: dict[str, type[Card]] = {
    lln: card for card, lln in CARD_TO_LLN.items()
}


def get_round_order(players: list[str], dealer: str,) -> list[str]:
    # Error Checks
    if len(players) != len(set(players)):
        raise ValueError("Player names not unique!")
    if dealer not in players:
        raise ValueError("Dealer not in players!")

    # Start with player after dealer
    dealer_index = players.index(dealer)
    order = players[dealer_index + 1:] + players[:dealer_index + 1]
    return order
    