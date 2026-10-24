"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  navLayout = "around",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout={navLayout}
      className={cn(
        // The container owns the surface (popover, card or panel); the grid
        // never paints its own background box inside it.
        "group/calendar p-3 [--cell-size:2rem]",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn(
          "grid w-full grid-cols-[1fr_auto_auto_auto_1fr] gap-y-4",
          defaultClassNames.month
        ),
        nav: cn(
          "flex h-(--cell-size) items-center justify-center gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "col-start-2 row-start-1 size-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "col-start-4 row-start-1 size-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "col-start-3 row-start-1 flex h-(--cell-size) items-center justify-center self-center px-1",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "bg-popover absolute inset-0 opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        month_grid: cn(
          "col-span-5 col-start-1 row-start-2 w-full border-collapse",
          defaultClassNames.month_grid
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-xs font-normal",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number
        ),
        // Cells stretch with the grid; the day target inside stays a fixed
        // --cell-size target. Button continues to own its configured shape.
        day: cn(
          "group/day relative flex h-(--cell-size) flex-1 select-none items-center justify-center p-0 text-center",
          defaultClassNames.day
        ),
        // A range is one continuous band on the cells.
        range_start: cn(
          "bg-accent rounded-l-md",
          defaultClassNames.range_start
        ),
        range_middle: cn("bg-accent rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: defaultClassNames.today,
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  meta,
  ...props
}: React.ComponentProps<typeof DayButton> & { meta?: React.ReactNode }) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        // Dense date grids own their target size; generic icon-button touch
        // expansion would force seven 44px columns into narrow calendars.
        // Button's content wrapper is normally relative. The day adapter owns
        // metadata positioning against the whole target, so that one wrapper
        // must not become the absolute slot's containing block.
        "relative size-(--cell-size) min-w-(--cell-size) p-0 pointer-coarse:size-(--cell-size) [&>span:last-child]:static",
        "text-sm font-normal leading-none tabular-nums",
        // Fluid's ghost button owns its text color; state on the table cell
        // cannot override it through inheritance. Apply date states here.
        "text-foreground",
        modifiers.outside && "text-muted-foreground",
        // Selection is the strongest state and uses the primary-control fill
        // (foreground on background) in every theme; white on the orange
        // primary measured 2.6:1. Range middles sit on the cell's band.
        "data-[selected-single=true]:bg-foreground data-[selected-single=true]:text-background data-[range-start=true]:bg-foreground data-[range-start=true]:text-background data-[range-end=true]:bg-foreground data-[range-end=true]:text-background data-[range-middle=true]:bg-transparent",
        "group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50",
        defaultClassNames.day,
        // Today keeps the primary ring in every state, matching the calendar
        // page's month and week headers; unselected it also gets the tint.
        modifiers.today && "font-semibold ring-1 ring-primary",
        modifiers.today && !modifiers.selected && "bg-primary/20",
        className
      )}
      {...props}
    >
      <span>{props.children}</span>
      {meta ? (
        <span
          data-slot="calendar-day-meta"
          className="absolute inset-x-0 bottom-0.5 flex justify-center"
        >
          {meta}
        </span>
      ) : null}
    </Button>
  )
}

export { Calendar, CalendarDayButton }
