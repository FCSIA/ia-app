"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Check, ChevronsUpDown, PenLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatCourseNumbers } from "./course-meta";
import type { CourseSummary } from "./types";

type CoursePickerProps = {
  courses: CourseSummary[];
  selectedCourseId?: string | null;
  onChange: (course: CourseSummary | null) => void;
  placeholder: string;
  preferredGradeLevel?: number;
  disabled?: boolean;
  className?: string;
  displayValue?: string;
  iconOnly?: boolean;
  actionVisibility?: "always" | "row-interaction";
  onManualEntry?: () => void;
};

export function CoursePicker({
  courses,
  selectedCourseId,
  onChange,
  placeholder,
  preferredGradeLevel,
  disabled,
  className,
  displayValue,
  iconOnly,
  actionVisibility = "always",
  onManualEntry,
}: CoursePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  };

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  const filteredCourses = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase();
    const ranked = [...courses].sort((left, right) => {
      const leftMatchesGrade =
        preferredGradeLevel != null &&
        (left.minGrade == null || preferredGradeLevel >= left.minGrade) &&
        (left.maxGrade == null || preferredGradeLevel <= left.maxGrade);
      const rightMatchesGrade =
        preferredGradeLevel != null &&
        (right.minGrade == null || preferredGradeLevel >= right.minGrade) &&
        (right.maxGrade == null || preferredGradeLevel <= right.maxGrade);

      if (leftMatchesGrade !== rightMatchesGrade)
        return leftMatchesGrade ? -1 : 1;
      return left.title.localeCompare(right.title);
    });

    if (!search) return ranked;

    return ranked.filter((course) =>
      [
        course.title,
        course.department,
        course.gradeText,
        formatCourseNumbers(course),
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search)),
    );
  }, [courses, deferredQuery, preferredGradeLevel]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {iconOnly ? (
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            disabled={disabled}
            aria-label={
              selectedCourse?.title || displayValue
                ? `Change class: ${selectedCourse?.title || displayValue}`
                : placeholder
            }
            className={cn(
              "font-normal text-muted-foreground",
              actionVisibility === "row-interaction" &&
                "pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100",
              className,
            )}
          >
            <ChevronsUpDown />
          </Button>
        ) : (
          <Button
            variant="tertiary"
            type="button"
            disabled={disabled}
            trailingIcon={ChevronsUpDown}
            className={cn(
              "w-full justify-between text-left",
              className ||
                "h-auto min-h-11 rounded-2xl border-border/70 bg-background/80 px-4 py-3 shadow-sm",
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              <span className="truncate text-sm font-medium text-foreground">
                {selectedCourse?.title || displayValue || placeholder}
              </span>
            </span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search by title, code, or department"
          />
          <CommandList className="max-h-[22rem] p-1">
            <CommandEmpty>No courses found.</CommandEmpty>
            <CommandGroup className="p-0">
              {selectedCourse || displayValue ? (
                <CommandItem
                  value="clear-course"
                  onSelect={() => {
                    onChange(null);
                    handleOpenChange(false);
                  }}
                  className="rounded-xl px-3 py-2 text-sm text-muted-foreground"
                >
                  <X />
                  Clear selection
                </CommandItem>
              ) : null}
              {onManualEntry ? (
                <CommandItem
                  value="class-not-in-catalog"
                  onSelect={() => {
                    handleOpenChange(false);
                    onManualEntry();
                  }}
                  className="rounded-xl px-3 py-2 text-sm"
                >
                  <PenLine />
                  Class not in the catalog
                </CommandItem>
              ) : null}
              {filteredCourses.map((course) => {
                const isSelected = course.id === selectedCourseId;
                const metadata = [
                  course.department,
                  formatCourseNumbers(course),
                  course.gradeText ? `Grades ${course.gradeText}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <CommandItem
                    key={course.id}
                    value={`${course.title} ${formatCourseNumbers(course)}`}
                    onSelect={() => {
                      onChange(course);
                      handleOpenChange(false);
                    }}
                    className="min-h-11 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:justify-between sm:gap-4">
                      <p className="truncate text-sm font-medium text-foreground">
                        {course.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground sm:mt-0 sm:max-w-[48%] sm:text-right">
                        {metadata}
                      </p>
                    </div>
                    <Check
                      className={cn(
                        "ml-1 shrink-0 text-orange-600 transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
