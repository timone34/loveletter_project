# Love Letter Strategy
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

All cards get shortened to a letter, just like pieces in chess notation.
| Card | Letter |
| :-------- | :-------: |
| Guard | g |
| Priest | p |
| Baron | B |
| Handmaid | H |
| Prince | P |
| King | K |
| Countess | C |  
| Princess | Q |


Every game of Love Letter is determined most of all by the order of the deck. I've come up with a system that uses this to its advantage.
At the very start of a round, the deck is shuffled. Its order is saved in a string of 16 card letters. For example: CBpBQgpgggHPgPKH. Cards at the front of the string represent the top of the deck.
Thus we can immediately see the discarded card is the Countess.
If we know who is dealing this round, the starting hands are determined as well. The player who is after the dealer in rotation receives the second card in the deck string, the next player the third, etc.

```[Version "LLN 1.0"]
[Players "Alice" "Bob" "Charlie" "Diane"]

[Round 1]
[Dealer "Alice"]
[Deck "CBpBQgpgggHPgPKH"]
[Result "W3"] 

1.1. g4:H  // Bob speelt een Guard tegen speler 4 (Alice) en raadt een Handmaid, dit is fout. Iedereen weet dat Alice GEEN Handmaid heeft.
1.2. p1:-  // Charlie speelt een Priest tegen speler 1 (Bob) en weet nu dat Bob een Baron heeft. - omdat het af te leiden is, kan ook B staan, dan hoeven we niet terug te rekenen.
1.3. g4:Q#  // Diane speelt Guard tegen Alice en raadt Princess, een goeie gok! Alice is (#) afgewezen. Iedereen weet dat Alice een Princess had.
1.4. -  // Geen beurt voor de afgewezen Alice.
2.1. g2:H // Bob zit in de penarie, Charlie weet dat hij een Baron heeft. Echter heeft hij een Guard gepakt en wil niet vergelijken. Hij speelt de Guard en hoopt dat hij het goed heeft. Dat heeft hij niet.
2.2. g1:B# // Helaas voor Bob trekt Charlie een Guard. Hij gebruikt zijn kennis en wijst Bob af. Iedereen weet dat Bob een Baron had.
2.3. H3:- // Diane trekt een Handmaid en speelt deze gelijk. Ze is beschermd. - omdat Handmaid geen target heeft
2.4. -
3.1. -
3.2. p3:-?  // Charlie speelt Priest op de beschermde (?) Diane.
3.3. g2:K // Diane speelt een Guard tegen Charlie en raadt een King. Niet de meest waarschijnlijke kaart (Prins, daar zijn er nog 2 van), en het is tevens fout.
3.4. -
4.1. -
4.2. P3:- // Charlie heeft nu twee Prinsen en speelt er een op zichzelf en legt zijn andere Prins af, hopend op een Countess (waarvan hij niet weet dat die is afgelegd aan het begin). Hij trekt de King (de hoogste kaart nog in het spel)!
4.3. B2:-- // Diane trekt de laatste kaart van de stapel, en heeft nu een Baron en een Handmaid op hand. De hoogste kaart die ze heeft is een Handmaid (value 4), dus ze speelt haar Baron. De Baron zorgt voor een showdown (die er anders toch was gekomen) en Diane verliest (##)
W3```