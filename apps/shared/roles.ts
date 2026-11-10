/**
 * Account roles and the role sets each policy uses. The server enforces most of
 * these sets; clients use the same ones to decide what to show. Sets marked
 * "client only" have no server check. Sets that look alike but answer different
 * questions keep separate names.
 */
export const APP_ROLES = [
  "STUDENT",
  "STUDENT_LEADER",
  "STUDENT_ADMIN",
  "TEACHER",
  "SPONSOR",
  "SUPPORT_STAFF",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

type RoleSet = readonly AppRole[];
type RoleSubject =
  | readonly string[]
  | { readonly roles?: readonly string[] | null }
  | null
  | undefined;

function rolesOf(subject: RoleSubject): readonly string[] {
  if (!subject) return [];
  if (isRoleList(subject)) return subject;
  return subject.roles ?? [];
}

function isRoleList(subject: NonNullable<RoleSubject>): subject is readonly string[] {
  return Array.isArray(subject);
}

export function hasAnyRole(subject: RoleSubject, allowed: RoleSet): boolean {
  const allowedRoles: readonly string[] = allowed;
  return rolesOf(subject).some((role) => allowedRoles.includes(role));
}

export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const satisfies RoleSet;
export const SUPER_ADMIN_ROLES = ["SUPER_ADMIN"] as const satisfies RoleSet;
/** School staff with the admin workspace: audit, moderation, approvals. */
export const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"] as const satisfies RoleSet;

/** Anyone with a student account, student admins included. */
export const STUDENT_ROLES = ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"] as const satisfies RoleSet;
/**
 * The stored `isStudent` flag and the "students" user group. Student admins
 * are their own group, so this set leaves STUDENT_ADMIN out.
 */
export const STUDENT_GROUP_ROLES = ["STUDENT", "STUDENT_LEADER"] as const satisfies RoleSet;
/** The stored `isTeacherStaff` flag and the "teachers" user group. */
export const TEACHER_GROUP_ROLES = ["TEACHER", "SPONSOR"] as const satisfies RoleSet;

export const CLUB_CREATION_ROLES = [
  "ADMIN",
  "SUPER_ADMIN",
  "SUPPORT_STAFF",
  "TEACHER",
] as const satisfies RoleSet;
/** Client only: roles offered as sponsor when a club is created. */
export const CLUB_SPONSOR_ELIGIBLE_ROLES = [
  "TEACHER",
  "SUPPORT_STAFF",
  "ADMIN",
  "SUPER_ADMIN",
] as const satisfies RoleSet;

export const ANNOUNCEMENT_AUTHOR_ROLES = [
  "ADMIN",
  "SUPER_ADMIN",
  "TEACHER",
  "STUDENT_ADMIN",
] as const satisfies RoleSet;
/** Read every announcement regardless of targeting, and review pending ones. */
export const ANNOUNCEMENT_REVIEWER_ROLES = ["ADMIN", "SUPER_ADMIN", "TEACHER"] as const satisfies RoleSet;
/** Client only: who sees content-moderation alerts and the profile moderation section. */
export const MODERATION_ALERT_ROLES = [
  "ADMIN",
  "SUPER_ADMIN",
  "TEACHER",
  "STUDENT_ADMIN",
] as const satisfies RoleSet;
/** Who may list content reports; acting on them needs STAFF_ROLES. */
export const MODERATION_READER_ROLES = [
  "ADMIN",
  "SUPER_ADMIN",
  "SUPPORT_STAFF",
  "TEACHER",
] as const satisfies RoleSet;

/** Who manages school events on the server (create, edit, cancel any). */
export const EVENT_MANAGER_ROLES = [
  "ADMIN",
  "SUPER_ADMIN",
  "SUPPORT_STAFF",
  "STUDENT_ADMIN",
] as const satisfies RoleSet;

/**
 * Client only: who sees the "create general event" button. Narrower than
 * EVENT_MANAGER_ROLES, which also lets student admins (kept as is; deferred).
 */
export const EVENT_GENERAL_CREATOR_ROLES = STAFF_ROLES;
/** Client only, mobile: who sees "cancel" on any event. */
export const EVENT_CANCEL_ANY_ROLES = STAFF_ROLES;
/** Client only, web: who sees "cancel" on any event; mobile uses EVENT_CANCEL_ANY_ROLES. */
export const EVENT_CANCEL_ANY_WEB_ROLES = ADMIN_ROLES;

export const FLEX_FRIDAY_CREATOR_ROLES = ["ADMIN", "SUPER_ADMIN", "STUDENT_ADMIN"] as const satisfies RoleSet;
/** Create sessions and assign students to workshops. */
export const FLEX_SESSION_CREATOR_ROLES = [
  "TEACHER",
  "ADMIN",
  "SUPER_ADMIN",
  "STUDENT_ADMIN",
] as const satisfies RoleSet;
/** Edit existing sessions and workshops. */
export const FLEX_MANAGER_ROLES = ["TEACHER", "ADMIN", "SUPER_ADMIN"] as const satisfies RoleSet;
/** Take attendance for any workshop. */
export const FLEX_ATTENDANCE_MANAGER_ROLES = [
  "ADMIN",
  "SUPER_ADMIN",
  "SUPPORT_STAFF",
  "STUDENT_ADMIN",
] as const satisfies RoleSet;
/**
 * Client only: who sees attendance tools: the attendance managers plus teachers, whom the
 * server limits to their own workshops.
 */
export const FLEX_ATTENDANCE_ROLES = [
  "TEACHER",
  ...FLEX_ATTENDANCE_MANAGER_ROLES,
] as const satisfies RoleSet;

/** Client only: who has a schedule page: students and the admins who manage bell schedules. */
export const SCHEDULE_ROLES = ["STUDENT", "ADMIN", "SUPER_ADMIN"] as const satisfies RoleSet;
/** Client only: who keeps a personal schedule and uses Friends. */
export const SCHEDULE_OWNER_ROLES = ["STUDENT"] as const satisfies RoleSet;
/** Client only: who the command palette loads schedule results for. Wider than SCHEDULE_ROLES (student leaders and student admins); deferred. */
export const SCHEDULE_PALETTE_ROLES = [...STUDENT_ROLES, ...ADMIN_ROLES] as const satisfies RoleSet;

/** Client only: roles that approve other people's work keep the dashboard queue visible when empty. */
export const DASHBOARD_REVIEWER_ROLES = [
  "SPONSOR",
  "TEACHER",
  "ADMIN",
  "SUPER_ADMIN",
  "SUPPORT_STAFF",
] as const satisfies RoleSet;

export function isAdmin(subject: RoleSubject): boolean {
  return hasAnyRole(subject, ADMIN_ROLES);
}

export function isSuperAdmin(subject: RoleSubject): boolean {
  return hasAnyRole(subject, SUPER_ADMIN_ROLES);
}

export function isStaff(subject: RoleSubject): boolean {
  return hasAnyRole(subject, STAFF_ROLES);
}

export function isStudent(subject: RoleSubject): boolean {
  return hasAnyRole(subject, STUDENT_ROLES);
}

/** Accounts that only a super admin may manage, impersonate or grant. */
export function isPrivilegedAccount(subject: RoleSubject): boolean {
  return hasAnyRole(subject, ADMIN_ROLES);
}

/** Admins manage accounts; privileged accounts need a super admin. */
export function canManageUser(actor: RoleSubject, target: RoleSubject): boolean {
  return isPrivilegedAccount(target) ? isSuperAdmin(actor) : isAdmin(actor);
}

/** Support staff may also reset student passwords. */
export function canResetUserPassword(actor: RoleSubject, target: RoleSubject): boolean {
  return (
    canManageUser(actor, target) ||
    (hasAnyRole(actor, ["SUPPORT_STAFF"]) && isStudent(target))
  );
}

/** Only a super admin may grant ADMIN or SUPER_ADMIN. */
export function canGrantRole(actorIsSuperAdmin: boolean, role: string): boolean {
  return actorIsSuperAdmin || !(ADMIN_ROLES as readonly string[]).includes(role);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  STUDENT: "Student",
  STUDENT_LEADER: "Student leader",
  STUDENT_ADMIN: "Student admin",
  TEACHER: "Teacher",
  SPONSOR: "Sponsor",
  SUPPORT_STAFF: "Support staff",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};
