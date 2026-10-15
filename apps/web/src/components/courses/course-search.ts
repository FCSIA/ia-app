const WORDS = /[\p{L}\p{N}]+/gu;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function words(value: string) {
  return normalize(value).match(WORDS) ?? [];
}

function maximumTypos(length: number) {
  if (length < 4) return 0;
  if (length < 7) return 1;
  return 2;
}

function isTypoMatch(query: string, candidate: string) {
  const maximum = maximumTypos(query.length);
  if (maximum === 0 || Math.abs(query.length - candidate.length) > maximum) {
    return false;
  }

  let previous = Array.from({ length: candidate.length + 1 }, (_, index) => index);
  for (let row = 1; row <= query.length; row++) {
    const current = [row];
    let smallest = current[0];

    for (let column = 1; column <= candidate.length; column++) {
      const cost = query[row - 1] === candidate[column - 1] ? 0 : 1;
      const value = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost,
      );
      current.push(value);
      smallest = Math.min(smallest, value);
    }

    if (smallest > maximum) return false;
    previous = current;
  }

  return previous[candidate.length] <= maximum;
}

/** Returns a lower score for a stronger course search match. */
export function rankCourseSearch(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalize(query).trim();
  if (!normalizedQuery) return 0;

  const searchableValues = values.filter((value): value is string => Boolean(value));
  const normalizedValues = searchableValues.map(normalize);
  if (normalizedValues.some((value) => value === normalizedQuery)) return 0;
  if (normalizedValues.some((value) => value.includes(normalizedQuery))) return 1;

  const queryWords = words(normalizedQuery);
  const candidateWords = normalizedValues.flatMap(words);
  if (
    queryWords.every((queryWord) =>
      candidateWords.some((candidate) => candidate.includes(queryWord)),
    )
  ) {
    return 1;
  }

  return queryWords.every((queryWord) =>
    candidateWords.some((candidate) => isTypoMatch(queryWord, candidate)),
  )
    ? 2
    : null;
}
