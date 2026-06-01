import "react";
import type { ReactNode } from "react";

declare module "react" {
  // Augment ReactElement to have children
  interface ReactElement {
    children?: ReactNode;
  }
  
  // Augment ReactPortal to not strictly require children
  interface ReactPortal {
    children?: ReactNode;
  }
}
