import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ContentType, ReportStatus } from '@prisma/client';

@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── Keyword Rules ─────────────────────────────────────────────────────────

  async getKeywords() {
    return this.prisma.keywordRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addKeyword(keyword: string, actorId: string) {
    const rule = await this.prisma.keywordRule.upsert({
      where: { keyword: keyword.toLowerCase() },
      update: { isActive: true },
      create: { keyword: keyword.toLowerCase(), addedById: actorId },
    });
    await this.audit.log({
      actorId,
      action: 'KEYWORD_ADDED',
      entityType: 'KeywordRule',
      entityId: rule.id,
      meta: { keyword },
    });
    return rule;
  }

  async removeKeyword(id: string, actorId: string) {
    await this.prisma.keywordRule.update({ where: { id }, data: { isActive: false } });
    await this.audit.log({
      actorId,
      action: 'KEYWORD_REMOVED',
      entityType: 'KeywordRule',
      entityId: id,
    });
    return { success: true };
  }

  async scanContent(
    text: string,
    contentType: ContentType,
    contentId: string,
    fieldName: 'announcementId' | 'eventId',
  ): Promise<string[]> {
    const keywords = await this.getKeywords();
    const lower = text.toLowerCase();
    const matches: string[] = [];

    for (const kw of keywords) {
      if (lower.includes(kw.keyword)) {
        matches.push(kw.keyword);
        await this.prisma.keywordMatch.create({
          data: {
            keyword: kw.keyword,
            contentType,
            [fieldName]: contentId,
          },
        });
      }
    }
    return matches;
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  async getReports(status?: ReportStatus) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, uniqueId: true } },
        reportedUser: { select: { id: true, firstName: true, lastName: true, uniqueId: true } },
      },
    });
  }

  async submitReport(
    submitterId: string,
    contentType: ContentType,
    contentId: string,
    reason: string,
    reportedUserId?: string,
  ) {
    const report = await this.prisma.report.create({
      data: {
        submitterId,
        contentType,
        contentId,
        reason,
        reportedUserId,
      },
    });
    await this.audit.log({
      actorId: submitterId,
      action: 'REPORT_SUBMITTED',
      entityType: 'Report',
      entityId: report.id,
      meta: { contentType, contentId },
    });
    return report;
  }

  async updateReportStatus(
    id: string,
    status: ReportStatus,
    reviewNote: string,
    actorId: string,
  ) {
    const report = await this.prisma.report.update({
      where: { id },
      data: { status, reviewNote, reviewedAt: new Date() },
    });
    await this.audit.log({
      actorId,
      action: 'REPORT_REVIEWED',
      entityType: 'Report',
      entityId: id,
      meta: { status },
    });
    return report;
  }

  async getKeywordMatches() {
    return this.prisma.keywordMatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
