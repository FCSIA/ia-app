import { displayName, nameSearchValues } from '~/apps/shared/user-name';
export type AnnouncementFilter = "all" | "unread" | "saved";

type AnnouncementAuthor = {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  isDeveloper?: boolean | null;
};

type AnnouncementClub = {
  name?: string | null;
};

export type SearchableAnnouncement = {
  title?: string | null;
  body?: string | null;
  targetType?: string | null;
  targetGrade?: number | null;
  targetGrades?: number[] | null;
  targetPathway?: string | null;
  targetMajorPathways?: string[] | null;
  targetMinorPathways?: string[] | null;
  author?: AnnouncementAuthor | null;
  club?: AnnouncementClub | null;
  isRead?: boolean | null;
  isBookmarked?: boolean | null;
};

export function announcementAudience(announcement: SearchableAnnouncement) {
  if (announcement.club?.name) return announcement.club.name;
  if (announcement.targetType === "GRADE") {
    const grades = Array.from(
      new Set(
        [announcement.targetGrade, ...(announcement.targetGrades ?? [])].filter(
          (grade): grade is number => typeof grade === "number",
        ),
      ),
    );
    if (grades.length === 1) return `Grade ${grades[0]}`;
    if (grades.length > 1) return `Grades ${grades.join(", ")}`;
    return "Grade";
  }
  if (announcement.targetType === "PATHWAY") return "Pathway";
  if (announcement.targetType === "CLUB") return "Club";
  if (announcement.targetType === "INTERSECTION") return "Student group";
  return "School";
}

export function filterAnnouncements<T extends SearchableAnnouncement>(
  announcements: readonly T[],
  filter: AnnouncementFilter,
  query: string,
) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);

  return announcements.filter((announcement) => {
    if (filter === "unread" && announcement.isRead) return false;
    if (filter === "saved" && !announcement.isBookmarked) return false;
    if (!terms.length) return true;

    const author = displayName(announcement.author);
    const searchText = normalizeSearchText(
      [
        announcement.title,
        announcement.body,
        author,
        ...nameSearchValues(announcement.author),
        announcementAudience(announcement),
        announcement.targetPathway,
        ...(announcement.targetMajorPathways ?? []),
        ...(announcement.targetMinorPathways ?? []),
      ]
        .filter(Boolean)
        .join(" "),
    );

    return terms.every((term) => searchText.includes(term));
  });
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}
