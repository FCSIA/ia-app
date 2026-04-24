import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ContentType, ReportStatus } from '@prisma/client';
import * as glinProfanity from 'glin-profanity';

export type ModeratedTextResult = {
  original: string;
  masked: string;
  wasFiltered: boolean;
  matchedWords: string[];
};

@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private readonly fallbackTestWords = ['crap'];

  private normalizeWords(words: string[]) {
    return Array.from(
      new Set(
        words
          .map((word) => word.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }

  private getConfiguredTestWords() {
    const envWords = process.env.PROFANITY_TEST_WORDS
      ?.split(',')
      .map((word) => word.trim())
      .filter(Boolean);
    return this.normalizeWords(envWords && envWords.length > 0 ? envWords : this.fallbackTestWords);
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private applyWordMask(input: string, words: string[]) {
    if (!input || words.length === 0) {
      return { masked: input, matchedWords: [] as string[] };
    }

    const matchedWords = new Set<string>();
    const masked = words.reduce((acc, word) => {
      const pattern = new RegExp(`\\b${this.escapeRegExp(word)}\\b`, 'gi');
      return acc.replace(pattern, (match) => {
        matchedWords.add(word);
        return '*'.repeat(match.length);
      });
    }, input);

    return { masked, matchedWords: Array.from(matchedWords) };
  }

  // Use glin-profanity's Filter.checkProfanity() to detect built-in profanity
  // words. Combine detected words with extraWords (our custom/test list) and
  // mask all of them.
  private applyGlinFilter(input: string, extraWords: string[]): string {
    try {
      const FilterClass = (glinProfanity as any).Filter;
      if (!FilterClass) {
        // Fallback: only mask the extra (custom) words
        return extraWords.length > 0 ? this.applyWordMask(input, extraWords).masked : input;
      }

      const filter = new FilterClass();
      const result = filter.checkProfanity(input);
      const detectedWords: string[] = result?.profaneWords ?? [];

      // Union of glin-detected words and our custom word list
      const allWords = Array.from(new Set([...detectedWords, ...extraWords]));
      if (allWords.length === 0) return input;

      return this.applyWordMask(input, allWords).masked;
    } catch {
      // Fallback: mask only the custom words
      return extraWords.length > 0 ? this.applyWordMask(input, extraWords).masked : input;
    }
  }

  async maskProfanity(text: string): Promise<ModeratedTextResult> {
    const activeRules = await this.getKeywords();
    const activeRuleWords = activeRules.map((rule) => rule.keyword);
    const testWords = this.getConfiguredTestWords();
    const allCustomWords = this.normalizeWords([...activeRuleWords, ...testWords]);

    // Step 1: always mask our custom keyword rules + configured test words
    const keywordResult = this.applyWordMask(text, allCustomWords);

    // Step 2: run glin-profanity on the already-masked text, injecting our
    //         custom words so the library also detects them.
    const glinMasked = this.applyGlinFilter(keywordResult.masked, testWords);

    const wasFiltered = glinMasked !== text;

    return {
      original: text,
      masked: glinMasked,
      wasFiltered,
      matchedWords: keywordResult.matchedWords,
    };
  }

  /**
   * Filter profanity from a Plate.js / Slate.js rich-body JSON tree.
   * Recursively walks every node and applies the same word masking to any
   * leaf node that has a `text` string property.
   */
  async maskRichBody(richBody: unknown): Promise<any> {
    if (!Array.isArray(richBody) || richBody.length === 0) return richBody;

    const activeRules = await this.getKeywords();
    const activeRuleWords = activeRules.map((rule) => rule.keyword);
    const testWords = this.getConfiguredTestWords();
    const allCustomWords = this.normalizeWords([...activeRuleWords, ...testWords]);

    const filterNode = (node: unknown): unknown => {
      if (!node || typeof node !== 'object') return node;
      const n = node as Record<string, unknown>;

      // Leaf node — has a `text` string property
      if (typeof n['text'] === 'string') {
        const step1 = this.applyWordMask(n['text'], allCustomWords);
        const step2 = this.applyGlinFilter(step1.masked, testWords);
        return { ...n, text: step2 };
      }

      // Element node — recurse into children
      if (Array.isArray(n['children'])) {
        return { ...n, children: (n['children'] as unknown[]).map(filterNode) };
      }

      return node;
    };

    return richBody.map(filterNode);
  }

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

  /**
   * Creates an automated report when profanity is detected.
   * This ensures the event shows up in the Admin Panel's moderation queue.
   */
  async createAutomatedReport(
    contentType: ContentType,
    contentId: string,
    authorId: string,
    matchedWords: string[] = [],
  ) {
    const reason = `Automated: Profanity Filtered${
      matchedWords.length > 0 ? ` (${matchedWords.join(', ')})` : ''
    }`;

    const report = await this.prisma.report.create({
      data: {
        submitterId: authorId, // We use the author as the submitter for automated flags
        reportedUserId: authorId,
        contentType,
        contentId,
        reason,
      },
    });

    await this.audit.log({
      actorId: authorId,
      action: 'AUTO_MODERATION_FLAGGED',
      entityType: 'Report',
      entityId: report.id,
      meta: { contentType, contentId, matchedWords },
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
