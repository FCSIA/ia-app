'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePaginatedQuery, useQuery } from '@/lib/convex-react';
import { BookOpen, Search, SlidersHorizontal } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { HeroBand, HeroStat, PageFrame, Panel } from '@/components/layout/page-frame';
import { CourseMeta } from '@/components/courses/course-meta';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import type { CourseSummary } from '@/components/courses/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { useCurrentUser } from '@/lib/auth';
import { api } from '~/apps/convex/src/_generated/api';

function pathwayLabel(pathway?: CourseSummary['pathway']) {
  if (!pathway) return 'All pathways';
  if (pathway === 'HEALTH_SCIENCE') return 'Health Science';
  if (pathway === 'INFORMATION_TECHNOLOGY') return 'Information Technology';
  return 'Engineering';
}

type CoursePathway = NonNullable<CourseSummary['pathway']>;

function isCoursePathway(value: string): value is CoursePathway {
  return (
    value === 'ENGINEERING' ||
    value === 'INFORMATION_TECHNOLOGY' ||
    value === 'HEALTH_SCIENCE'
  );
}

export default function CoursesPage() {
  const user = useCurrentUser();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [pathway, setPathway] = useState<CoursePathway | 'ALL'>('ALL');
  const [grade, setGrade] = useState('ALL');
  const deferredSearch = useDeferredValue(search);

  const parsedGrade = grade === 'ALL' ? undefined : Number.parseInt(grade, 10);
  const {
    results: courses,
    status: coursesStatus,
    loadMore: loadMoreCourses,
  } = usePaginatedQuery(
    api.courses.catalog.listPage,
    {
      q: deferredSearch.trim() || undefined,
      department: department === 'ALL' ? undefined : department,
      pathway: pathway === 'ALL' ? undefined : pathway,
      gradeLevel: parsedGrade,
    },
    { initialNumItems: 40 },
  );
  const isLoading = coursesStatus === 'LoadingFirstPage';
  const catalogMetadata = useQuery(api.courses.catalog.listDepartments, {});
  const departments = catalogMetadata?.departments ?? [];

  const apCourseCount = useMemo(
    () => courses.filter((course) => course.catalogSource !== 'COURSE_CATALOG').length,
    [courses],
  );

  return (
    <AppShell>
      <PageFrame>
        <HeroBand
          badge={
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground">
              Course Catalog
            </span>
          }
          title="Browse every seeded IA class from the 2026-2027 catalogs."
          aside={
            <>
              <HeroStat label="Courses" value={courses.length} />
              <HeroStat label="Departments" value={departments.length} />
              <HeroStat label="AP / Merged" value={apCourseCount} />
            </>
          }
        />

        <Panel
          title="Find a course"
          action={
            user?.gradeLevel ? (
              <Button
                variant="tertiary"
                className="rounded-2xl"
                onClick={() => setGrade(String(user.gradeLevel))}
              >
                Show my grade ({user.gradeLevel})
              </Button>
            ) : null
          }
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, code, or department"
                className="rounded-2xl pl-10"
              />
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="rounded-2xl" placeholder="Department" />
              <SelectContent>
                <SelectItem index={0} value="ALL">All departments</SelectItem>
                {departments.map((entry) => (
                  <SelectItem index={0} key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={pathway}
              onValueChange={(value) => setPathway(isCoursePathway(value) ? value : 'ALL')}
            >
              <SelectTrigger className="rounded-2xl" placeholder="Pathway" />
              <SelectContent>
                <SelectItem index={0} value="ALL">All pathways</SelectItem>
                <SelectItem index={0} value="ENGINEERING">Engineering</SelectItem>
                <SelectItem index={0} value="INFORMATION_TECHNOLOGY">Information Technology</SelectItem>
                <SelectItem index={0} value="HEALTH_SCIENCE">Health Science</SelectItem>
              </SelectContent>
            </Select>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger className="rounded-2xl" placeholder="Grade" />
              <SelectContent>
                <SelectItem index={0} value="ALL">All grades</SelectItem>
                {[9, 10, 11, 12].map((entry) => (
                  <SelectItem index={0} key={entry} value={String(entry)}>
                    Grade {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Panel>

        <Panel
          title="Catalog results"
          description={
            isLoading
              ? 'Loading courses...'
              : `${courses.length} loaded matching class${courses.length === 1 ? '' : 'es'}`
          }
          action={
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="size-3.5" />
              {pathwayLabel(pathway === 'ALL' ? undefined : pathway)}
            </div>
          }
        >
          {courses.length > 0 ? (
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                {courses.map((course) => (
                  <Link key={course.id} href={`/courses/${course.slug}`}>
                    <Card className="h-full rounded-[1.75rem] border-border/70 bg-background/90">
                      <CardContent className="space-y-4 p-5">
                        <div className="space-y-2">
                          <p className="text-lg font-semibold tracking-tight text-foreground">
                            {course.title}
                          </p>
                          <CourseMeta course={course} />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <BookOpen className="size-4" />
                          Open class details
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              {coursesStatus !== 'Exhausted' ? (
                <div className="flex justify-center">
                  <Button
                    variant="tertiary"
                    onClick={() => loadMoreCourses(40)}
                    disabled={coursesStatus !== 'CanLoadMore'}
                    className="rounded-full"
                  >
                    {coursesStatus === 'LoadingMore' ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <Empty frame="dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpen />
                </EmptyMedia>
                <EmptyTitle>No courses matched this filter set</EmptyTitle>
                <EmptyDescription>
                  Try clearing one filter or searching by a course number instead of a full title.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </Panel>
      </PageFrame>
    </AppShell>
  );
}
