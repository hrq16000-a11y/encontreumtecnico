import type { PropsWithChildren } from "react";

/** The fixture never activates the real router or any authenticated route. */
export function Link({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <a href="#gestao-sintetica" className={className}>{children}</a>;
}
