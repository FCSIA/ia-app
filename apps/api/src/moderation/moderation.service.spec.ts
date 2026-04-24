import { ModerationService } from './moderation.service';

describe('ModerationService.maskProfanity', () => {
  const buildService = (keywords: string[] = []) => {
    const prisma: any = {
      keywordRule: {
        findMany: jest.fn().mockResolvedValue(
          keywords.map((keyword, idx) => ({
            id: `kw-${idx}`,
            keyword,
            isActive: true,
            createdAt: new Date(),
          })),
        ),
      },
    };
    const audit: any = { log: jest.fn() };
    return new ModerationService(prisma, audit);
  };

  it('masks configured test words (crap) by default', async () => {
    const service = buildService();
    const result = await service.maskProfanity('This is crap');

    expect(result.masked).toBe('This is ****');
    expect(result.wasFiltered).toBe(true);
    expect(result.matchedWords).toContain('crap');
  });

  it('masks active moderation keywords case-insensitively', async () => {
    const service = buildService(['heck']);
    const result = await service.maskProfanity('Heck and hEcK');

    expect(result.masked).toBe('**** and ****');
    expect(result.wasFiltered).toBe(true);
    expect(result.matchedWords).toEqual(['heck']);
  });
});
