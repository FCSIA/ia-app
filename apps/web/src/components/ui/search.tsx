"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

type SearchInputSize = "sm" | "default" | "lg"

const searchInputSizeStyles: Record<
  SearchInputSize,
  {
    group: string
    icon: string
    input: string
    clearButton: "icon-xs" | "icon-sm"
  }
> = {
  sm: {
    group: "h-8 rounded-lg",
    icon: "size-3.5",
    input: "text-sm",
    clearButton: "icon-xs",
  },
  default: {
    group: "rounded-xl",
    icon: "size-4",
    input: "",
    clearButton: "icon-xs",
  },
  lg: {
    group: "h-11 rounded-xl",
    icon: "size-4",
    input: "text-base",
    clearButton: "icon-sm",
  },
}

type SearchInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
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
    <InputGroup className={cn(styles.group, className)}>
      <InputGroupAddon className="text-muted-foreground">
        <Search className={styles.icon} />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("min-w-0", styles.input, inputClassName)}
        {...props}
      />
      {!hideClearButton && value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size={styles.clearButton}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              onValueChange("")
              onClear?.()
            }}
            aria-label={clearLabel}
          >
            <X className={styles.icon} />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
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
