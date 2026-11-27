from bots import NoPrincess, FastCardCounterV2
from engine.cards import *
from engine.history import Outcome
from engine.view import PlayerView


class Action():
    def __init__(self) -> None:
        self.card: Card
        self.target: int | None
        self.guess: Card | None



class PriestKnowledge(NoPrincess):
    def __init__(self) -> None:
        super().__init__()
        self.id = "PriestKnowledge"
        self.family, self.version = "Priest Knowledge", "v1"
        self.name = "Priest Knowledge Bot"
        self.description = "Uses Priest seen info to confirm kills."
        self.debug = False

    def action_from_view(self, view: PlayerView) -> Action:
        action = Action()

        for turn in view.log:
            if turn.seat == view.seat and turn.played is not None:
                if turn.played is Priest() and turn.seen is not None:
                    seen_card = turn.seen


        return action

    def choose_card(self, player, playable):
        assert player.view is not None
        action = self.action_from_view(player.view)

        return super().choose_card(player, playable)
