'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { ArrowLeft, BookOpen, GraduationCap, LibraryBig } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { HeroBand, HeroStat, PageFrame, Panel } from '@/components/layout/page-frame';
import { CourseMeta, formatCourseNumbers } from '@/components/courses/course-meta';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { api } from '~/apps/convex/src/_generated/api';

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const courseQuery = useQuery(api.courses.getOne, { slug });
  const course = courseQuery;
  const isLoading = courseQuery === undefined;

  if (!isLoading && !course) {
    return (
      <AppShell>
        <PageFrame>
          <Empty className="rounded-[1.75rem] border border-dashed border-border/70 bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>Course not found</EmptyTitle>
              <EmptyDescription>
                This class was not found in the seeded course catalog.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </PageFrame>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageFrame>
        <div>
          <Link href="/courses">
            <Button variant="ghost" className="-ml-3 rounded-2xl">
              <ArrowLeft className="mr-2 size-4" />
              Back to catalog
            </Button>
          </Link>
        </div>

        {course ? (
          <>
            <HeroBand
              badge={<CourseMeta course={course} />}
              title={course.title}
              description={
                course.summary ||
                'This class is available in the seeded IA catalog and can be selected directly from schedule editing.'
              }
              aside={
                <>
                  <HeroStat
                    label="Course Numbers"
                    value={formatCourseNumbers(course) || 'Catalog listing'}
                    icon={LibraryBig}
                  />
                  <HeroStat
                    label="Grade Band"
                    value={course.gradeText || 'See counselor'}
                    icon={GraduationCap}
                  />
                </>
              }
            />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <Panel
                title="Class meta"
              >
                <div className="space-y-5">
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Summary
                    </h3>
                    <p className="text-sm leading-7 text-foreground/90">
                      {course.summary || 'No summary is currently available for this class.'}
                    </p>
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Major topics
                    </h3>
                    <p className="text-sm leading-7 text-foreground/90">
                      {course.majorTopics || 'No major-topics summary is currently available.'}
                    </p>
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Prerequisites
                    </h3>
                    <p className="text-sm leading-7 text-foreground/90">
                      {course.prerequisitesText || 'No prerequisite text is listed for this class.'}
                    </p>
                  </section>
                </div>
              </Panel>

              <div className="space-y-6">
                <Panel title="Essential skills">
                  <p className="text-sm leading-7 text-foreground/90">
                    {course.essentialSkills ||
                      'This catalog entry does not list a separate essential-skills section.'}
                  </p>
                </Panel>
                <Panel title="Workload">
                  <div className="space-y-3 text-sm text-foreground/90">
                    <p>
                      <span className="font-medium text-foreground">Student reported:</span>{' '}
                      {course.studentWorkload || 'Not listed'}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Teacher reported:</span>{' '}
                      {course.teacherWorkload || 'Not listed'}
                    </p>
                  </div>
                </Panel>
              </div>
            </div>
          </>
        ) : (
          <Empty className="rounded-[1.75rem] border border-dashed border-border/70 bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>Loading class details</EmptyTitle>
              <EmptyDescription>
                Pulling the catalog record for this course.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </PageFrame>
    </AppShell>
  );
}
