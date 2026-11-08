from history import GameHistory, RoundHistory, TurnHistory, ShowdownHistory

class Observer:
  def on_game_start(self, game: GameHistory) -> None: pass
  def on_round_start(self, rnd: RoundHistory) -> None: pass
  def on_turn(self, rnd: RoundHistory, turn: TurnHistory) -> None: pass
  def on_showdown(self, rnd: RoundHistory, showdown: ShowdownHistory) -> None: pass
  def on_round_end(self, rnd: RoundHistory) -> None: pass
  def on_game_end(self, game: GameHistory) -> None: pass

class Observers(Observer):
  def __init__(self, *observers: Observer):
    self._observers = list(observers)

  def on_game_start(self, game):
    for o in self._observers: o.on_game_start(game)
  def on_round_start(self, rnd):
    for o in self._observers: o.on_round_start(rnd)
  def on_turn(self, rnd, turn):
    for o in self._observers: o.on_turn(rnd, turn)
  def on_showdown(self, rnd, showdown):
    for o in self._observers: o.on_showdown(rnd, showdown)
  def on_round_end(self, rnd):
    for o in self._observers: o.on_round_end(rnd)
  def on_game_end(self, game):
    for o in self._observers: o.on_game_end(game)

class ConsoleLogger(Observer):
  def on_game_start(self, game):
    print("test")