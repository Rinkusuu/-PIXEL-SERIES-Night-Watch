/**
 * Subsequence fuzzy match. Returns a score, or -1 for no match.
 *
 * Substring matching (`includes`) is the obvious choice and it is the wrong
 * one: it makes you type the words exactly right, which defeats the whole
 * purpose of not having to find the button. "lwt" should still find LEWATI.
 *
 * Consecutive hits and hits at a word boundary score higher, so an acronym
 * ranks the thing it is an acronym OF above a long label that happens to
 * contain the same letters scattered through it.
 */
export function fuzzy(needle: string, haystack: string): number {
  const n = needle.toLowerCase().trim();
  const h = haystack.toLowerCase();
  if (n === '') return 0;

  let score = 0;
  let from = 0;
  let streak = 0;

  for (const ch of n) {
    // Spaces in the query are separators, not characters to find.
    if (ch === ' ') { streak = 0; continue; }
    const at = h.indexOf(ch, from);
    if (at === -1) return -1;

    // A hit immediately after the previous one continues a run. A run is the
    // strongest signal that the user typed part of an actual word.
    if (at === from) streak++;
    else streak = 0;

    score += 1 + streak * 2;
    if (at === 0 || h[at - 1] === ' ') score += 3;

    from = at + 1;
  }

  // Shorter haystacks win ties: a near-exact match on a short label should beat
  // a scattered one inside a long sentence.
  return score - h.length * 0.02;
}
