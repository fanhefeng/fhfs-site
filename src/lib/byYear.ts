/**
 * The rule every year-bucketed index on this site shares: /blog and its tag
 * pages, the secrets index, and the board.
 *
 * It was written three times over — once per index, and the copies had already
 * started to differ in how they found the year (a field, or four characters of
 * an ISO date). The year is what the caller knows, so it hands one over; the
 * bucketing is what they all agree on, so it lives here.
 *
 * Consecutive runs only: the list arrives newest-first and stays that way, so
 * a year that reappeared after another one would open a second bucket rather
 * than be merged into the first. That is the honest rendering of a list that
 * is not sorted the way it claims, and it is what all three copies did.
 */
export type YearGroup<T> = { year: string; items: T[] };

export function groupByYear<T>(
  items: readonly T[],
  yearOf: (item: T) => string
): YearGroup<T>[] {
  const groups: YearGroup<T>[] = [];
  for (const item of items) {
    const year = yearOf(item);
    const last = groups.at(-1);
    if (last?.year === year) last.items.push(item);
    else groups.push({ year, items: [item] });
  }
  return groups;
}

/** The year of a `YYYY-MM-DD` day, read off the string rather than through a
 *  `Date` — parsing one would move the day by the server's zone. */
export const yearOfDate = (row: { date: string }): string => row.date.slice(0, 4);
