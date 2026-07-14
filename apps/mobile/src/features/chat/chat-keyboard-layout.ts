export function chatSafeAreaOffset(bottomInset: number, composerMargin: number) {
  return Math.max(0, bottomInset - composerMargin);
}
