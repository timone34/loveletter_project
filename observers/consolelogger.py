from observers import Observer
from cards import Guard, Priest, Baron, Handmaid, Prince, King, Countess, Princess
from history import Outcome

class ConsoleLogger(Observer):
  def __init__(self) -> None:
    self.names: list[str] = []

  def on_game_start(self, game):
    self.names = game.players
    print("Starting Love Letter!")
    for seat, (name, strat) in enumerate(zip(game.players, game.strategies)):
      print(f"  Seat {seat+1}: {name} ({strat})")

  def on_round_start(self, game, rnd):
    print(f"\n--- Round {rnd.number} ---")
    print(f"Dealer: {self.names[rnd.dealer]}")
    print(f"Burn card: {rnd.burn.name if rnd.burn is not None else None}")
    print("Starting hands:")
    for seat, card in rnd.starting_hands.items():
      print(f"  {self.names[seat]}: {card.name}")
    

  def on_turn_start(self, game, rnd, turn):
    print(f"\n{turn.cycle}.{turn.seat+1}. {self.names[turn.seat]}:")
    print(f"  Holds {turn.held.name if turn.held else '-'}")
    print(f"  Draws {turn.drawn.name if turn.drawn else '-'}")

  def on_turn_end(self, game, rnd, turn):
    card = turn.played
    if card is None:
      return

    line = f"  Plays {card.name}"

    if turn.outcome is Outcome.NO_TARGET:
      line += ", but there is no valid target."

    elif turn.target is not None:
      target = "themself" if turn.target == turn.seat else self.names[turn.target]
      line += f" on {target}"

      if turn.outcome is Outcome.PROTECTED:
        line += ", who is protected. No effect."
      elif isinstance(card, Guard) and turn.guess is not None:
        result = "Correct!" if turn.outcome is Outcome.CORRECT else "Incorrect."
        line += f", guessing {turn.guess.name}. {result}"
      elif isinstance(card, Priest) and turn.seen is not None:
        line += f" and sees {turn.seen.name}."
      elif isinstance(card, Baron):
        result = {Outcome.WIN: "Wins the comparison.",
                  Outcome.LOSE: "Loses the comparison.",
                  Outcome.DRAW: "The comparison is a draw."}[turn.outcome]
        line += f". {result}"
      elif isinstance(card, Prince) and turn.discarded is not None:
        line += f", who discards {turn.discarded.name}"
        line += f" and redraws {turn.redrawn.name}." if turn.redrawn else "."
      elif isinstance(card, King):
        line += " and swaps hands."

    elif isinstance(card, Handmaid):
      line += " and is now protected."
    elif isinstance(card, Princess):
      line += "."

    print(line)

    for seat in turn.rejected:
      print(f"  {self.names[seat]} is rejected!")

  def on_turn_skipped(self, game, rnd, turn):
    print(f"\n{turn.cycle}.{turn.seat+1}. - ")

  def on_showdown(self, game, rnd, showdown):
    print("\nShowdown!")
    for seat, card in showdown.contender_hands.items():
      print(f"  {self.names[seat]} has {card.name} ({card.value})")

    if showdown.discard_totals:
      print("  Tie on card value. Discard totals:")
      for seat, total in showdown.discard_totals.items():
        print(f"    {self.names[seat]}: {total}")

  def on_round_end(self, game, rnd):
    winners = " and ".join(self.names[seat] for seat in rnd.winners)
    print(f"\n{winners} wins round {rnd.number}!")

    print("Scores:")
    for seat, name in enumerate(self.names):
      wins = sum(seat in r.winners for r in game.rounds)
      print(f"  {name}: {wins}")

  def on_game_end(self, game):
    assert game.winner is not None
    print(f"\n{self.names[game.winner]} wins the game!\nGG!")