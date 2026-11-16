export type BotOption = {
  id: string;
  name: string;
  description: string;
};

export type SimulationResult = {
  run: {
    games: number;
    targetRoundWins: number;
    rotateSeats: boolean;
    seed: number | null;
    durationMs: number;
    players: { seat: number; name: string; botId: string; botName: string }[];
  };
  summary: {
    games: number;
    rounds: number;
    turns: number;
    rejections: number;
    guardAttempts: number;
    guardCorrect: number;
  };
  leaderboard: {
    player: string;
    wins: number;
    games: number;
    winrate: number;
    ciLow: number;
    ciHigh: number;
    roundWins: number;
    rounds: number;
    roundWinrate: number | null;
  }[];
  rejections: {
    byCause: { category: string; count: number; share: number }[];
    byCycle: { cycle: number; count: number; share: number }[];
    byAttacker: { attacker: string; count: number; share: number }[];
    byVictim: { victim: string; count: number; share: number }[];
    selfInflicted: { self_inflicted: boolean; count: number; share: number }[];
  };
  guards: {
    player: string;
    attempts: number;
    correct: number;
    incorrect: number;
    accuracy: number;
  }[];
  barons: {
    player: string;
    attempts: number;
    wins: number;
    ties: number;
    losses: number;
    win_rate: number;
    tie_rate: number;
    loss_rate: number;
  }[];
  showdowns: {
    player: string;
    showdowns: number;
    wins: number;
    ties: number;
    losses: number;
    win_rate: number;
    tie_rate: number;
    loss_rate: number;
  }[];
  princeSuicides: { player: string; count: number }[];
  cardUsage: { card: string; count: number; share: number }[];
  cardsDrawn: { card: string; count: number; share: number }[];
  seatWinrates: {
    player: string;
    seat: number;
    round_wins: number;
    rounds: number;
    winrate: number;
  }[];
  dealerWinrates: {
    player: string;
    dealer_round_wins: number;
    dealer_rounds: number;
    winrate: number;
  }[];
  winrateHistory: {
    gameCount: number;
    player: string;
    wins: number;
    winrate: number;
  }[];
};
