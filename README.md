# Love Letter Strategy
This is my Love Letter Strategy project. I played (a version of) this game with my friends, and, naturally, we discussed the optimal strategy. 
So, I'm making this to answer the question: How do you play a perfect game of Love Letter?

This is not an easy question to answer by any stretch of the imagination. It raises a bunch of other questions, such as: "What even is perfect play?" or "How much is luck involved?"

### Rules
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
