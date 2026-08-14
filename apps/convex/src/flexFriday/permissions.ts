type FlexRole = string;

function hasAnyRole(roles: readonly FlexRole[], allowedRoles: readonly FlexRole[]) {
  return allowedRoles.some((role) => roles.includes(role));
}

export function canCreateFlexFriday(roles: readonly FlexRole[]) {
  return hasAnyRole(roles, ["ADMIN", "SUPER_ADMIN", "STUDENT_ADMIN"]);
}

export function canCreateFlexSession(roles: readonly FlexRole[]) {
  return hasAnyRole(roles, ["TEACHER", "ADMIN", "SUPER_ADMIN", "STUDENT_ADMIN"]);
}

export function canManageExistingFlexSessions(roles: readonly FlexRole[]) {
  return hasAnyRole(roles, ["TEACHER", "ADMIN", "SUPER_ADMIN"]);
}

export function canAssignFlexStudents(roles: readonly FlexRole[]) {
  return hasAnyRole(roles, ["TEACHER", "ADMIN", "SUPER_ADMIN", "STUDENT_ADMIN"]);
}

export function canManageFlexAttendance(roles: readonly FlexRole[]) {
  return hasAnyRole(roles, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF", "STUDENT_ADMIN"]);
}
