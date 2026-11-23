from __future__ import annotations

from cards import Card
from deck import Deck
from history import GameHistory, RoundHistory, ShowdownHistory, TurnHistory
from observers import Observer, Observers
from player import Player
from strategy import Strategy
from view import view_for


class Game:
    def __init__(
        self,
        players: dict[str, Strategy],
        target_round_wins: int = 3,
        observers: Observer | None = None,
    ):
        self.players = [
            Player(seat, name, strategy)
            for seat, (name, strategy) in enumerate(players.items())
        ]
        self.num_players = len(self.players)

        self.obs = observers or Observers()

        self.target_round_wins: int = (
            target_round_wins  # Number of round wins to win the game
        )

        self.dealer = 0
        self.round = 0
        self.winner: Player | None = None

        self.current_round: Round | None = None

        self.history = GameHistory(
            players=[p.name for p in self.players],
            strategies=[p.strategy.id for p in self.players],
        )

    def play(self) -> None:
        self.obs.on_game_start(self.history)

        while self.winner is None:
            self.round += 1

            rnd = Round(
                self, self.players, self.dealer, self.round, self.obs,
                deck=self._new_deck(),
            )
            self.current_round = rnd
            rnd.play()

            self._score(rnd)

            self.history.rounds.append(rnd.history)
            self.obs.on_round_end(self.history, rnd.history)

            self.dealer = self._next_dealer(rnd)

            self.winner = self._check_winner()

        self.history.winner = self.winner.seat
        self.history.scores = {p.seat: p.round_wins for p in self.players}
        self.obs.on_game_end(self.history)

    def _new_deck(self) -> Deck | None:
        # None = Round builds and shuffles a fresh deck; override to supply a fixed order (replays)
        return None

    def _score(self, rnd: Round) -> None:
        for player in rnd.winners:
            player.round_wins += 1

    def _check_winner(self) -> Player | None:
        leaders = [p for p in self.players if p.round_wins >= self.target_round_wins]
        if len(leaders) == 1:
            return leaders[0]
        if len(leaders) > 1:
            self.target_round_wins += 1
        return None

    def _next_dealer(self, rnd: Round) -> int:
        # winner starts; on a tied round, the first winner in turn order starts
        first = (self.dealer + 1) % self.num_players
        for i in range(self.num_players):
            seat = (first + i) % self.num_players
            if seat in rnd.history.winners:
                return (seat - 1) % self.num_players
        raise RuntimeError("Round finished without winners.")


class Round:
    def __init__(
        self,
        game: Game,
        players: list[Player],
        dealer: int,
        number: int,
        observers: Observer,
        deck: Deck | None = None,
    ):
        self.game = game
        self.players = players
        self.num_players = len(self.players)
        self.dealer = dealer
        self.rnd_number = number
        self.obs = observers

        self.deck: Deck = deck if deck is not None else Deck()
        if deck is None:
            self.deck.shuffle()

        self.burn_card: Card
        self.turn_count: int = 0

        self.winners: list[Player] = []

        self.history = RoundHistory(
            number=number, dealer=dealer, deck_order=list(self.deck.cards)
        )

    def play(self) -> None:
        for player in self.players:
            player.reset_player()

        self._deal()
        self.obs.on_round_start(self.game.history, self.history)

        seat = (self.dealer + 1) % self.num_players
        while True:
            turn = Turn(game=self.game, round=self, player=self.players[seat])
            turn.play()

            self.history.turns.append(turn.history)
            self.turn_count += 1

            if not self.multiple_alive or self.deck.cards_left == 0:
                break
            seat = (seat + 1) % self.num_players

        if self.multiple_alive:
            self.winners = self._showdown()
        else:
            self.winners = self.alive_players

        self.history.winners = [p.seat for p in self.winners]

    def _deal(self) -> None:
        self.burn_card = self.deck.draw_card()
        self.history.burn = self.burn_card

        for i in range(self.num_players):
            player = self.players[(self.dealer + 1 + i) % self.num_players]
            card = self.deck.draw_card()
            player.hand.append(card)
            self.history.starting_hands[player.seat] = card

    def _showdown(self) -> list[Player]:
        contenders = self.alive_players

        best = max(p.hand[0].value for p in contenders)
        winners = [p for p in contenders if p.hand[0].value == best]

        discard_totals: dict[int, int] = {}
        if len(winners) > 1:
            discard_totals = {p.seat: p.discard_total for p in winners}
            best_total = max(discard_totals.values())
            winners = [p for p in winners if discard_totals[p.seat] == best_total]

        self.history.showdown = ShowdownHistory(
            contender_hands={p.seat: p.hand[0] for p in contenders},
            discard_totals=discard_totals,
            winners=[p.seat for p in winners],
        )
        self.obs.on_showdown(self.game.history, self.history, self.history.showdown)
        return winners

    def eliminate(self, player: Player, turn: Turn):
        player.rejected = True
        player.discard.extend(player.hand)
        player.hand.clear()
        turn.history.rejected.append(player.seat)

    def get_valid_targets(
        self, player: Player, allow_self: bool = False
    ) -> list[Player]:
        valid_targets: list[Player] = []

        for p in self.players:
            if p.rejected:
                continue  # if player is dead, skip
            if p is player and not allow_self:
                continue  # if you aren't allowed to target yourself, skip
            valid_targets.append(p)

        return valid_targets

    def draw_replacement(self) -> Card:
        return self.deck.draw_card() if self.deck.cards_left > 0 else self.burn_card

    @property
    def cycle(self) -> int:
        return self.turn_count // self.num_players + 1

    @property
    def alive_players(self) -> list[Player]:
        return [p for p in self.players if not p.rejected]

    @property
    def multiple_alive(self) -> bool:
        return len(self.alive_players) > 1


class Turn:
    def __init__(self, game: Game, round: Round, player: Player):
        self.game = game
        self.rnd = round
        self.player = player
        self.history = TurnHistory(cycle=self.rnd.cycle, seat=self.player.seat)

    def play(self) -> None:
        if self.player.rejected:
            self.rnd.obs.on_turn_skipped(
                self.game.history, self.rnd.history, self.history
            )
            return

        self.player.protected = False

        held = self.player.hand[0]
        drawn = self.rnd.deck.draw_card()
        self.history.held = held
        self.history.drawn = drawn
        self.player.hand.append(drawn)
        self.player.view = view_for(self.player, self.rnd)

        self.rnd.obs.on_turn_start(self.game.history, self.rnd.history, self.history)

        playable = self.player.playable_cards
        card = self.player.strategy.choose_card(self.player, playable)
        if card not in playable:
            raise ValueError(f"{self.player.strategy.name} chose an illegal card.")

        self.history.played = card
        self.player.hand.remove(card)
        self.player.discard.append(card)

        card.resolve(self.player, self.rnd, self)

        self.rnd.obs.on_turn_end(self.game.history, self.rnd.history, self.history)
