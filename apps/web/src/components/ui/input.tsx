"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useShape } from "@/lib/shape-context"

type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  size?: "sm" | "md" | "lg"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = "md", ...props }, ref) => {
    const shape = useShape()
    return (
      <input
        type={type}
        className={cn(
          "flex w-full border border-input bg-transparent px-3 py-1 text-sm pointer-coarse:min-h-11 pointer-coarse:text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "h-7" : size === "lg" ? "h-9" : "h-8",
          shape.input,
          className
        )}
        ref={ref}
        suppressHydrationWarning
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
