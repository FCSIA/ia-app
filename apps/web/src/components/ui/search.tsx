"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type SearchInputSize = "sm" | "default" | "lg"

const searchInputSizeStyles: Record<
  SearchInputSize,
  {
    group: string
    icon: string
    input: string
  }
> = {
  sm: {
    group: "h-8 rounded-lg",
    icon: "size-3.5",
    input: "text-sm",
  },
  default: {
    group: "rounded-xl",
    icon: "size-4",
    input: "",
  },
  lg: {
    group: "h-11 rounded-xl",
    icon: "size-4",
    input: "text-base",
  },
}

type SearchInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "className" | "onChange" | "size" | "type" | "value"
> & {
  className?: string
  value: string
  onValueChange: (value: string) => void
  inputClassName?: string
  clearLabel?: string
  hideClearButton?: boolean
  onClear?: () => void
  size?: SearchInputSize
}

function SearchInput({
  className,
  inputClassName,
  value,
  onValueChange,
  clearLabel = "Clear search",
  hideClearButton = false,
  onClear,
  size = "default",
  ...props
}: SearchInputProps) {
  const styles = searchInputSizeStyles[size]

  return (
    <div className={cn("relative flex items-center", styles.group, className)}>
      <Search className={cn("pointer-events-none absolute left-3 text-muted-foreground", styles.icon)} />
      <Input
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("min-w-0 px-9", styles.input, inputClassName)}
        {...props}
      />
      {!hideClearButton && value ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="absolute right-1 text-muted-foreground hover:text-foreground"
          onClick={() => {
            onValueChange("")
            onClear?.()
          }}
          aria-label={clearLabel}
        >
          <X className={styles.icon} />
        </Button>
      ) : null}
    </div>
  )
}

function SearchToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("space-y-3", className)} {...props} />
}

function SearchToolbarRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-3 md:flex-row md:items-center", className)}
      {...props}
    />
  )
}

function SearchToolbarFilters({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />
  )
}

export { SearchInput, SearchToolbar, SearchToolbarFilters, SearchToolbarRow }
