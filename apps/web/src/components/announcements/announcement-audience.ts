export type AnnouncementAudienceInput = {
  targetType: string;
  targetGrade?: number | null;
  targetGrades?: readonly number[] | null;
  targetPathway?: string | null;
  targetMajorPathways?: readonly string[] | null;
  targetMinorPathways?: readonly string[] | null;
  clubId?: string | null;
  club?: { name: string } | null;
};

export type AnnouncementAudiencePart =
  | { kind: 'grades'; values: number[]; shortLabel: string; label: string }
  | { kind: 'pathways'; values: string[]; labels: string[]; label: string }
  | { kind: 'club'; clubId?: string; label: string }
  | { kind: 'school' | 'unknown'; label: string };

export type AnnouncementAudience = {
  parts: AnnouncementAudiencePart[];
  /** Compact text; distinct parts represent conditions that all apply. */
  label: string;
  /** Complete text that explicitly joins targeting dimensions with AND. */
  accessibleLabel: string;
};

const PATHWAY_LABELS: Record<string, string> = {
  HEALTH_SCIENCE: 'Health Science',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  ENGINEERING: 'Engineering',
};

export function formatAnnouncementPathway(pathway: string): string {
  return PATHWAY_LABELS[pathway] ?? pathway
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function joinAlternatives(values: readonly string[]): string {
  if (values.length < 3) return values.join(' or ');
  return `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`;
}

function gradePart(input: AnnouncementAudienceInput): AnnouncementAudiencePart | null {
  const values = [...new Set([
    ...(input.targetGrade == null ? [] : [input.targetGrade]),
    ...input.targetGrades ?? [],
  ])].sort((left, right) => left - right);
  if (values.length === 0) return null;

  const contiguous = values.length > 1 && values.every((value, index) =>
    index === 0 || value === values[index - 1] + 1);
  const shortLabel = contiguous
    ? `${values[0]}–${values.at(-1)}`
    : joinAlternatives(values.map(String));
  return {
    kind: 'grades',
    values,
    shortLabel,
    label: `${values.length === 1 ? 'Grade' : 'Grades'} ${shortLabel}`,
  };
}

function pathwayPart(input: AnnouncementAudienceInput): AnnouncementAudiencePart | null {
  // The backend matches every legacy/major/minor target against either of the
  // viewer's pathways. These are alternatives, not major-specific restrictions.
  const values = [...new Set([
    ...(input.targetPathway ? [input.targetPathway] : []),
    ...input.targetMajorPathways ?? [],
    ...input.targetMinorPathways ?? [],
  ])].filter(Boolean);
  if (values.length === 0) return null;
  const labels = values.map(formatAnnouncementPathway);
  return { kind: 'pathways', values, labels, label: joinAlternatives(labels) };
}

function clubPart(input: AnnouncementAudienceInput): AnnouncementAudiencePart {
  return {
    kind: 'club',
    ...(input.clubId ? { clubId: input.clubId } : {}),
    label: input.club?.name || 'Club members',
  };
}

export function getAnnouncementAudience(input: AnnouncementAudienceInput): AnnouncementAudience {
  const parts: AnnouncementAudiencePart[] = [];

  if (input.targetType === 'SCHOOL_WIDE' && !input.clubId) {
    parts.push({ kind: 'school', label: 'School-wide' });
  } else if (input.targetType === 'GRADE' && !input.clubId) {
    const grades = gradePart(input);
    if (grades) parts.push(grades);
  } else if (input.targetType === 'PATHWAY' && !input.clubId) {
    const pathways = pathwayPart(input);
    if (pathways) parts.push(pathways);
  } else if (input.targetType === 'CLUB') {
    parts.push(clubPart(input));
  } else if (input.targetType === 'INTERSECTION') {
    const grades = gradePart(input);
    const pathways = pathwayPart(input);
    if (grades) parts.push(grades);
    if (pathways) parts.push(pathways);
    if (input.clubId || input.club?.name) parts.push(clubPart(input));
  }

  if (parts.length === 0) parts.push({ kind: 'unknown', label: 'Targeted audience' });

  return {
    parts,
    label: parts.map((part) => part.label).join(' · '),
    accessibleLabel: parts.map((part) => {
      const label = part.kind === 'club' && part.label !== 'Club members'
        ? `${part.label} members`
        : part.label;
      // Preserve OR grouping when several dimensions are joined with AND.
      return parts.length > 1 && (
        (part.kind === 'grades' && part.values.length > 1)
        || (part.kind === 'pathways' && part.values.length > 1)
      ) ? `(${label})` : label;
    }).join(' and '),
  };
}
