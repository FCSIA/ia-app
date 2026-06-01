'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CourseMeta, formatCourseNumbers } from './course-meta';
import type { CourseSummary } from './types';

type CoursePickerProps = {
  courses: CourseSummary[];
  selectedCourseId?: string | null;
  onChange: (course: CourseSummary | null) => void;
  placeholder: string;
  preferredGradeLevel?: number;
  disabled?: boolean;
  className?: string;
  iconOnly?: boolean;
};

export function CoursePicker({
  courses,
  selectedCourseId,
  onChange,
  placeholder,
  preferredGradeLevel,
  disabled,
  className,
  iconOnly,
}: CoursePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

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

      if (leftMatchesGrade !== rightMatchesGrade) return leftMatchesGrade ? -1 : 1;
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {iconOnly ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={disabled}
            className={cn("h-6 w-6 p-0 rounded bg-muted/50 hover:bg-muted font-normal text-muted-foreground", className)}
          >
            <ChevronsUpDown className="size-3.5" />
          </Button>
        ) : (
          <Button
            variant="tertiary"
            type="button"
            disabled={disabled}
            className={cn(
              "w-full justify-between text-left",
              className || "h-auto min-h-11 rounded-2xl border-border/70 bg-background/80 px-4 py-3 shadow-sm"
            )}
          >
            <div className="min-w-0 flex-1 truncate">
              <span className="truncate text-sm font-medium text-foreground">
                {selectedCourse ? selectedCourse.title : placeholder}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl border-border/70 p-0">
        <Command shouldFilter={false}>
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search by title, code, or department"
              className="pl-9"
            />
          </div>
          <CommandList className="max-h-[22rem]">
            <CommandEmpty>No courses found.</CommandEmpty>
            <CommandGroup className="p-2">
              {selectedCourse ? (
                <CommandItem
                  value="clear-course"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="mb-1 rounded-xl px-3 py-2 text-sm text-muted-foreground"
                >
                  <X className="mr-2 size-4" />
                  Clear selection
                </CommandItem>
              ) : null}
              {filteredCourses.map((course) => {
                const isSelected = course.id === selectedCourseId;
                return (
                  <CommandItem
                    key={course.id}
                    value={`${course.title} ${formatCourseNumbers(course)}`}
                    onSelect={() => {
                      onChange(course);
                      setOpen(false);
                    }}
                    className="rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{course.title}</p>
                      <CourseMeta course={course} className="mt-1 gap-1.5" />
                    </div>
                    <Check
                      className={cn(
                        'ml-3 size-4 shrink-0 text-orange-600 transition-opacity',
                        isSelected ? 'opacity-100' : 'opacity-0',
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
