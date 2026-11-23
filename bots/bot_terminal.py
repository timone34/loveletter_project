from engine.cards import guessable
from engine.strategy import Strategy


def _choose_from_menu(title: str, options: list[str]) -> int:
    while True:
        print(f"\n{title}\n")

        for i, option in enumerate(options, start=1):
            print(f"{i}. {option}")

        try:
            choice = int(input("> "))

            if 1 <= choice <= len(options):
                return choice - 1

        except ValueError:
            pass

        print("Invalid choice.\n")


class TerminalPlayer(Strategy):  # asks for user input regarding all actions.
    human = True  # not a bot: left out of bots.available_bots()

    def __init__(self) -> None:
        self.id = "TerminalPlayer"
        self.name = "Player Input"
        self.description = "This Strategy asks the user for input through the python terminal."

    def choose_card(self, player, playable):
        if len(playable) < len(player.hand):
            print(f"{player.name} must play Countess.")

        chosen_idx = _choose_from_menu(
            f"{player.name}, choose a card to play:",
            [f"{c.name} ({c.value})" for c in playable],
        )
        return playable[chosen_idx]

    def choose_target(self, player, card, targets):
        chosen_idx = _choose_from_menu(
            f"{player.name}, choose a player to target with your {card.name}:",
            [t.name for t in targets],
        )
        return targets[chosen_idx]

    def guard_guess(self, player, target):
        options = guessable()
        chosen_idx = _choose_from_menu(
            f"{player.name}, guess {target.name}'s card:",
            [card.name for card in options],
        )
        return options[chosen_idx]
