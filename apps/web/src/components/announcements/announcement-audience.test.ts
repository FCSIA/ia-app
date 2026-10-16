import { describe, expect, it } from 'vitest';
import { getAnnouncementAudience } from './announcement-audience';

describe('announcement audience', () => {
  it('merges the legacy grade with every array grade without duplicating or mutating inputs', () => {
    const targetGrades = [12, 11, 12];
    const audience = getAnnouncementAudience({ targetType: 'GRADE', targetGrade: 11, targetGrades });
    expect(audience.parts).toEqual([
      { kind: 'grades', values: [11, 12], shortLabel: '11–12', label: 'Grades 11–12' },
    ]);
    expect(audience.label).toBe('Grades 11–12');
    expect(targetGrades).toEqual([12, 11, 12]);
  });

  it('handles array-only grades and does not imply unselected grades in a disjoint set', () => {
    expect(getAnnouncementAudience({ targetType: 'GRADE', targetGrades: [9] }).label).toBe('Grade 9');
    expect(getAnnouncementAudience({ targetType: 'GRADE', targetGrades: [11, 9] }).label).toBe('Grades 9 or 11');
    expect(getAnnouncementAudience({ targetType: 'GRADE', targetGrade: 10, targetGrades: [9, 12] }).label)
      .toBe('Grades 9, 10, or 12');
  });

  it('combines legacy, major, and minor pathways as alternatives, preserving readable names', () => {
    const audience = getAnnouncementAudience({
      targetType: 'PATHWAY',
      targetPathway: 'INFORMATION_TECHNOLOGY',
      targetMajorPathways: ['INFORMATION_TECHNOLOGY', 'ENGINEERING'],
      targetMinorPathways: ['ENGINEERING', 'HEALTH_SCIENCE'],
    });
    expect(audience.parts).toEqual([{
      kind: 'pathways',
      values: ['INFORMATION_TECHNOLOGY', 'ENGINEERING', 'HEALTH_SCIENCE'],
      labels: ['Information Technology', 'Engineering', 'Health Science'],
      label: 'Information Technology, Engineering, or Health Science',
    }]);
    expect(audience.accessibleLabel).toBe('Information Technology, Engineering, or Health Science');
    expect(getAnnouncementAudience({ targetType: 'PATHWAY', targetMinorPathways: ['DIGITAL_MEDIA'] }).label)
      .toBe('Digital Media');
  });

  it('keeps every intersection dimension and makes AND versus OR unambiguous', () => {
    const audience = getAnnouncementAudience({
      targetType: 'INTERSECTION',
      targetGrades: [12, 11],
      targetMajorPathways: ['ENGINEERING'],
      targetMinorPathways: ['INFORMATION_TECHNOLOGY'],
      clubId: 'robotics',
      club: { name: 'Robotics Club' },
    });
    expect(audience.parts.map((part) => part.kind)).toEqual(['grades', 'pathways', 'club']);
    expect(audience.label).toBe('Grades 11–12 · Engineering or Information Technology · Robotics Club');
    expect(audience.accessibleLabel)
      .toBe('(Grades 11–12) and (Engineering or Information Technology) and Robotics Club members');
  });

  it('supports intersections with an omitted dimension and unresolved club names', () => {
    expect(getAnnouncementAudience({
      targetType: 'INTERSECTION', targetGrade: 9, clubId: 'robotics',
    }).label).toBe('Grade 9 · Club members');
    expect(getAnnouncementAudience({
      targetType: 'INTERSECTION', targetMinorPathways: ['ENGINEERING'],
    }).label).toBe('Engineering');
    expect(getAnnouncementAudience({ targetType: 'CLUB', clubId: 'robotics', club: { name: 'Robotics Club' } })
      .accessibleLabel).toBe('Robotics Club members');
  });

  it('only presents fields that the selected target type actually applies', () => {
    expect(getAnnouncementAudience({
      targetType: 'SCHOOL_WIDE', targetGrade: 9, targetPathway: 'ENGINEERING',
    }).label).toBe('School-wide');
    expect(getAnnouncementAudience({
      targetType: 'CLUB', clubId: 'robotics', club: { name: 'Robotics Club' },
      targetGrade: 9, targetMajorPathways: ['ENGINEERING'],
    }).label).toBe('Robotics Club');
    expect(getAnnouncementAudience({ targetType: 'PATHWAY', targetGrade: 9, targetPathway: 'ENGINEERING' }).label)
      .toBe('Engineering');
  });

  it('never invents a school-wide audience when targeting details are missing or unknown', () => {
    for (const targetType of ['GRADE', 'PATHWAY', 'INTERSECTION', 'FUTURE_SCOPE']) {
      expect(getAnnouncementAudience({ targetType })).toEqual({
        parts: [{ kind: 'unknown', label: 'Targeted audience' }],
        label: 'Targeted audience',
        accessibleLabel: 'Targeted audience',
      });
    }
    expect(getAnnouncementAudience({ targetType: 'SCHOOL_WIDE', clubId: 'robotics' }).label)
      .toBe('Targeted audience');
  });
});
