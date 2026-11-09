from history import GameHistory, RoundHistory, TurnHistory, ShowdownHistory

class Observer:
  def on_game_start(self, game: GameHistory) -> None: pass
  def on_game_end(self, game: GameHistory) -> None: pass
  def on_round_start(self, game:GameHistory, rnd: RoundHistory) -> None: pass
  def on_round_end(self, game:GameHistory, rnd: RoundHistory) -> None: pass
  def on_turn_start(self, game:GameHistory, rnd: RoundHistory, turn: TurnHistory) -> None: pass
  def on_turn_end(self, game:GameHistory, rnd: RoundHistory, turn: TurnHistory) -> None: pass
  def on_turn_skipped(self, game:GameHistory, rnd: RoundHistory, turn: TurnHistory) -> None: pass
  def on_showdown(self, game:GameHistory, rnd: RoundHistory, showdown: ShowdownHistory) -> None: pass

class Observers(Observer):
  def __init__(self, *observers: Observer):
    self._observers = list(observers)

  def on_game_start(self, game):
    for o in self._observers: o.on_game_start(game)
  def on_game_end(self, game):
    for o in self._observers: o.on_game_end(game)
  def on_round_start(self, game, rnd):
    for o in self._observers: o.on_round_start(game, rnd)
  def on_round_end(self, game, rnd):
    for o in self._observers: o.on_round_end(game, rnd)
  def on_turn_start(self, game, rnd, turn):
      for o in self._observers: o.on_turn_start(game, rnd, turn)
  def on_turn_end(self, game, rnd, turn):
    for o in self._observers: o.on_turn_end(game, rnd, turn)
  def on_turn_skipped(self, game, rnd, turn):
    for o in self._observers: o.on_turn_skipped(game, rnd, turn)
  def on_showdown(self, game, rnd, showdown):
    for o in self._observers: o.on_showdown(game, rnd, showdown)

