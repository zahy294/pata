/** Approximate speech length only; real duration is a deferred phone/provider check. */
export const MAX_DIRECTIONS_CHARACTERS = 300;

export function shortenDirections(text: string, limit = MAX_DIRECTIONS_CHARACTERS): string {
  const characters = Array.from(text.trim());
  if (characters.length <= limit) return characters.join("");
  const cut = characters.slice(0, limit).join("").trimEnd();
  const boundary = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  return (boundary > 0 ? cut.slice(0, boundary) : cut).trim();
}
