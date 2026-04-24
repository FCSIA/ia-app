export type SearchValue = string | number | null | undefined

export function normalizeSearchQuery(query: string) {
  return query.trim().toLowerCase()
}

export function buildSearchText(values: readonly SearchValue[]) {
  return values
    .filter((value): value is string | number => value !== null && value !== undefined)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function matchesSearchQuery(query: string, values: readonly SearchValue[]) {
  const normalizedQuery = normalizeSearchQuery(query)
  if (!normalizedQuery) return true

  return buildSearchText(values).includes(normalizedQuery)
}

export function filterBySearchQuery<T>(
  items: readonly T[],
  query: string,
  getValues: (item: T) => readonly SearchValue[],
) {
  const normalizedQuery = normalizeSearchQuery(query)
  if (!normalizedQuery) return [...items]

  return items.filter((item) => buildSearchText(getValues(item)).includes(normalizedQuery))
}
