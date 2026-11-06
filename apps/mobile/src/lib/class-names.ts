export function joinClassNames(...names: Array<string | undefined>) {
  return names.filter(Boolean).join(" ");
}
