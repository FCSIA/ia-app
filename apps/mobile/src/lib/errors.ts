export function errorMessage(error: unknown, fallback = "Try again.") {
  return error instanceof Error ? error.message : fallback;
}
