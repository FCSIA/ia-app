import { Injectable, NotFoundException } from '@nestjs/common';
import { Pathway, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly summarySelect = {
    id: true,
    slug: true,
    title: true,
    courseNumbers: true,
    department: true,
    pathway: true,
    catalogSource: true,
    term: true,
    gradeText: true,
    minGrade: true,
    maxGrade: true,
  } satisfies Prisma.CourseSelect;

  private readonly detailSelect = {
    ...this.summarySelect,
    prerequisitesText: true,
    summary: true,
    majorTopics: true,
    essentialSkills: true,
    studentWorkload: true,
    teacherWorkload: true,
  } satisfies Prisma.CourseSelect;

  private matchesGradeLevel(
    course: { minGrade: number | null; maxGrade: number | null },
    gradeLevel?: number,
  ) {
    if (!gradeLevel) return true;
    if (course.minGrade != null && gradeLevel < course.minGrade) return false;
    if (course.maxGrade != null && gradeLevel > course.maxGrade) return false;
    return true;
  }

  private matchesSearch(
    course: { title: string; department: string; slug: string; courseNumbers: string[] },
    search: string,
  ) {
    if (!search) return true;

    const haystack = [
      course.title,
      course.department,
      course.slug,
      ...course.courseNumbers,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(search);
  }

  async list(params: {
    q?: string;
    department?: string;
    pathway?: Pathway;
    gradeLevel?: number;
    limit?: number;
  }) {
    const search = params.q?.trim().toLowerCase() ?? '';
    const take = params.limit ? Math.min(Math.max(params.limit, 1), 200) : undefined;

    const courses = await this.prisma.course.findMany({
      where: {
        department: params.department?.trim() || undefined,
        pathway: params.pathway,
      },
      select: this.summarySelect,
      orderBy: [{ department: 'asc' }, { title: 'asc' }],
    });

    const filtered = courses.filter(
      (course) =>
        this.matchesGradeLevel(course, params.gradeLevel) &&
        this.matchesSearch(course, search),
    );

    return take ? filtered.slice(0, take) : filtered;
  }

  async getOne(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      select: this.detailSelect,
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }
}
