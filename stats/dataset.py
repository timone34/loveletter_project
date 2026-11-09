from __future__ import annotations
from typing import TYPE_CHECKING

import pandas as pd
from dataclasses import dataclass

if TYPE_CHECKING:
  from history import GameHistory

@dataclass
class Dataset:
  games: pd.DataFrame
  rounds: pd.DataFrame
  turns: pd.DataFrame
  rejections: pd.DataFrame

  @classmethod
  def from_histories(cls, ghs: list[GameHistory]) -> Dataset:
    games, rounds, turns, rejections = [], [], [], []

    for g, gh in enumerate(ghs):
      names = gh.players
      for seat, name in enumerate(names):
        games.append(dict(
          game=g, player=name, seat=seat, 
          won=(gh.winner == seat), round_wins=gh.scores[seat]
          ))

      for rnd in gh.rounds:
        rejected_at: dict[int, int] = {}

        for t in rnd.turns:
          if t.held is None or t.drawn is None or t.played is None: continue
          turns.append(dict(
            game=g, round=rnd.number, cycle=t.cycle, player=names[t.seat],
            held=t.held.name, drawn=t.drawn.name, played=t.played.name,
            target=names[t.target] if t.target is not None else None,
            guess=t.guess.name if t.guess else None,
            outcome=t.outcome.name,
          ))

          for victim in t.rejected:
            rejected_at[victim] = t.cycle
            rejections.append(dict(
              game=g, round=rnd.number, cycle=t.cycle,
              victim=names[victim], attacker=names[t.seat],
              cause=t.played.name, self_inflicted=(victim == t.seat),
            ))

        for seat, name in enumerate(names):
          rounds.append(dict(
            game=g, round=rnd.number, player=name, seat=seat,
            dealer=(rnd.dealer == seat), start_card=rnd.starting_hands[seat].name,
            won=(seat in rnd.winners), rejected_cycle=rejected_at.get(seat),
          ))



    return cls(*(pd.DataFrame(rows) for rows in (games, rounds, turns, rejections)))