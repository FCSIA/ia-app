import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Pathway } from '@prisma/client';
import { CoursesService } from './courses.service';

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('department') department?: string,
    @Query('pathway') pathway?: Pathway,
    @Query('gradeLevel') gradeLevel?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedGradeLevel = gradeLevel ? Number.parseInt(gradeLevel, 10) : undefined;
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;

    return this.coursesService.list({
      q,
      department,
      pathway,
      gradeLevel: Number.isFinite(parsedGradeLevel) ? parsedGradeLevel : undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Get(':slug')
  getOne(@Param('slug') slug: string) {
    return this.coursesService.getOne(slug);
  }
}
