# Love Letter Strategy v1
This is my Love Letter Strategy project. I played (a version of) this game with my friends, and, naturally, we discussed the optimal strategy. 
So, I'm making this to answer the question: How do you play a perfect game of Love Letter?

This is not an easy question to answer by any stretch of the imagination. It raises a bunch of other questions, such as: "What even is perfect play?" or "How much is luck involved?"

## Rules
In Love Letter, your objective is to get your letter to the princess. To do this you pass your letter to different members of the court, represented by cards.

Every player gets dealt a starting card, valued 1-8. Another card is put aside, face-down.
On a player's turn, they take a second card into their hand and play one of the two.
Once there are no cards remaining, the players compare hands. The player with the highest value card wins the round.

The following are the possible cards (starting at value 1, ending at value 8), and their effects.

- Guard (5): Guess another player's hand (you can't guess a Guard). If you're correct, the other player is rejected.
- Priest (2): Look at another player's hand.
- Baron (2): Compare your hand with another player's. The player with the lowest hand is rejected.
- Handmaid (2): You are protected for this turn. No player can target you with a card effect.
- Prince (2): Choose a player (including yourself), this player discards his hand.
- King (1): Trade hands with another player.
- Countess (1): If you have this card and another card valued 5 or higher, you must play this card.
- Princess (1): If you play or discard this card, you are rejected.

## Love Letter Notation (LLN)
In this project, I'll be using my system for saving games of Love Letter called Love Letter Notation (or LLN for short).
It's inspired by PGN and FEN, chess notation systems.

All cards get shortened to a letter, just like pieces in chess notation. Some turn results are also stored as symbols.
| Card/Result | Letter |
| :-------- | :-------: |
| Guard | g |
| Priest | p |
| Baron | B |
| Handmaid | H |
| Prince | P |
| King | K |
| Countess | C |  
| Princess | Q |
| Player rejected | - |
| Turn results in rejection of target | # |
| Player wins Baron comparison | > |
| Player loses Baron comparison | < |
| Baron comparison ends with tie | = |
| Target protected by Handmaid | ? |


Every game of Love Letter is determined most of all by the order of the deck. I've come up with a system that uses this to its advantage.
At the very start of a round, the deck is shuffled. Its order is saved in a string of 16 card letters. For example: "CBpBQgpgggHPgPKH". Cards at the front of the string represent the top of the deck.
Thus we can immediately see the discarded card is the Countess.
If we know who is dealing this round, the starting hands are determined as well. The player who is after the dealer in rotation receives the second card in the deck string, the next player the third, etc.

What does a round of Love Letter look like in LLN?

```
[Seat1: Alice, Random Strategy]
[Seat2: Bob, Random Strategy]
[Seat3: Charlie, Random Strategy]
[Seat4: Diane, Random Strategy]
[Score: 0-0-1-0]

[Round 1]
[Dealer: Alice]
[Deck: CBpBQgpgggHPgPKH]
[Result: W3]

1.2. g1:H
1.3. p2
1.4. g1:Q#
1.1. -

2.2. g3:H
2.3. g2:B#
2.4. H
2.1. -

3.2. -
3.3. p4*
3.4. g3:K
3.1. -

4.2. -
4.3. P3
4.4. B3<#
W3
```

## Statistics
To compare strategies with each other, we need a way of looking at the game data.
Various statistics can help us in our journey to find the way to perfect play.
These different stats can be split into multiple categories

### 1. Outcome stats
Did the bot win, and how? 
These stats are important for observing which bot performs best.
- Game winrate (%)
- Round winrate (%)
- Rejection stats (cause, timing, who did it)
- Seat and dealer specific effects

### 2. Play stats
What did the bot actually do?
These stats are important for telling us what to improve.
- Guard accuracy (%)
- Baron results (x% win,y% tie, z% loss)
- Information usage (card counting accuracy)

### 3. Context
How far can we trust these numbers?
Maybe the least important, but still useful for our purposes.
- Luck analysis
- Drawn cards
- Comparison setup (head-to-head, rating, confidence interval)

## Running web simulations

Start the API from the repository root with `uvicorn server:app --port 8000`, then start the web app in a second terminal with `cd web` and `npm run dev`. The Simulate page loads strategy options from the `bots` package, runs the configured matches through the experiment and dataset pipeline, and opens the generated metrics on the Stats page. The API can also be started with `uvicorn server:app --reload --port 8000` during development.
