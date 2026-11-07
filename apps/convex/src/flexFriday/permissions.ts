import {
  FLEX_ATTENDANCE_MANAGER_ROLES,
  FLEX_FRIDAY_CREATOR_ROLES,
  FLEX_MANAGER_ROLES,
  FLEX_SESSION_CREATOR_ROLES,
  hasAnyRole,
  isStudent,
} from "../../../shared/roles";
export function canCreateFlexFriday(roles: readonly string[]) {
  return hasAnyRole(roles, FLEX_FRIDAY_CREATOR_ROLES);
}

export function canCreateFlexSession(roles: readonly string[]) {
  return hasAnyRole(roles, FLEX_SESSION_CREATOR_ROLES);
}

export function canManageExistingFlexSessions(roles: readonly string[]) {
  return hasAnyRole(roles, FLEX_MANAGER_ROLES);
}

export function canAssignFlexStudents(roles: readonly string[]) {
  return hasAnyRole(roles, FLEX_SESSION_CREATOR_ROLES);
}

export function canManageFlexAttendance(roles: readonly string[]) {
  return hasAnyRole(roles, FLEX_ATTENDANCE_MANAGER_ROLES);
}

/**
 * A student for Flex Friday: the stored flag or any student role. The role
 * check already covers the flag; it stays so rows with only the flag still count.
 */
export function isFlexStudent(user: { isStudent: boolean; roles: string[] }) {
  return user.isStudent || isStudent(user);
}

export function isActiveFlexStudent(user: { isActive: boolean; isStudent: boolean; roles: string[] }) {
  return user.isActive && isFlexStudent(user);
}
