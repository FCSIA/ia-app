"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/springs";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsePanel, CollapsibleTrigger } from "@/components/ui/collapsible";

/** An independently expandable section with optional summary metadata. */
export function DisclosureSection({ title, meta, children }: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const reduceMotion = useReducedMotion();
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">{title}</span>
            <span className="flex shrink-0 items-center gap-2">
              {meta != null ? <span className="text-xs tabular-nums text-muted-foreground">{meta}</span> : null}
              <motion.span animate={{ rotate: open ? 180 : 0 }} initial={false} transition={reduceMotion ? { duration: 0 } : spring.fast}>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </motion.span>
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsePanel open={open} className="px-4 pb-4">{children}</CollapsePanel>
      </section>
    </Collapsible>
  );
}
