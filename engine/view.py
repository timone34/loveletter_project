from __future__ import annotations

from dataclasses import dataclass, replace
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .cards import Card
    from .game import Round
    from .history import TurnHistory
    from .player import Player


@dataclass(frozen=True)
class PublicPlayer:
    seat: int
    name: str
    discards: tuple[Card, ...]
    protected: bool
    rejected: bool

@dataclass(frozen=True)
class PlayerView:
    seat: int
    hand: tuple[Card, ...]
    players: tuple[PublicPlayer, ...]
    deck_count: int
    dealer: int
    log: tuple[TurnHistory, ...]


def view_for(player: Player, round: Round) -> PlayerView:
    return PlayerView(
        seat=player.seat,
        hand=tuple(player.hand),
        players=tuple(
            PublicPlayer(p.seat, p.name, tuple(p.discard), p.protected, p.rejected)
            for p in round.players
        ),
        deck_count=round.deck.cards_left,
        dealer=round.dealer,
        log=tuple(redact_turn(t, player.seat) for t in round.history.turns),
    )


def redact_turn(turn: TurnHistory, viewer: int) -> TurnHistory:
    changes = {}
    if turn.seat != viewer:
        if turn.held is not None:
            changes["held"] = None
        if turn.drawn is not None:
            changes["drawn"] = None
        if turn.seen is not None:
            changes["seen"] = None
    if turn.target != viewer:
        if turn.redrawn is not None:
            changes["redrawn"] = None
    if viewer not in (turn.seat, turn.target) and turn.received is not None:
        changes["received"] = None
    if viewer not in (turn.seat, turn.target) and turn.given is not None:
        changes["given"] = None
    if not changes:
        return turn
    copied = replace(turn, rejected=list(turn.rejected))
    return replace(copied, **changes)