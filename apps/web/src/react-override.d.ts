import "react";

declare module "react" {
  // Augment ReactElement to have children
  interface ReactElement<
    P = any,
    T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>
  > {
    children?: ReactNode;
  }
  
  // Augment ReactPortal to not strictly require children
  interface ReactPortal {
    children?: ReactNode;
  }
}
