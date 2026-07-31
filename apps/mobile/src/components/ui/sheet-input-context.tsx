import { createContext, use, type ReactNode } from "react";

const SheetInputContext = createContext(false);

export function SheetInputProvider({ children }: { children: ReactNode }) {
  return <SheetInputContext value>{children}</SheetInputContext>;
}

export function useSheetInput() {
  return use(SheetInputContext);
}
