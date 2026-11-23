// The letter on a player's avatar: the first letter of the name, skipping a
// leading "The" ("The Countess" -> "C"). Empty names get the fallback.
export function initial(name: string, fallback = "?"): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const word = words.length > 1 && words[0].toLowerCase() === "the" ? words[1] : words[0];
  return word ? word[0].toUpperCase() : fallback;
}
