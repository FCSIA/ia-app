import {
  FLEX_ATTENDANCE_MANAGER_ROLES,
  FLEX_FRIDAY_CREATOR_ROLES,
  FLEX_MANAGER_ROLES,
  FLEX_SESSION_CREATOR_ROLES,
  hasAnyRole,
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
