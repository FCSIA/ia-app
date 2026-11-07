import { describe, expect, it } from 'vitest';
import { resolveAdminTab, visibleAdminSections } from './admin-sections';

const staff = { isSuperAdmin: false, canManageWrapped: false };
const admin = { isSuperAdmin: false, canManageWrapped: true };
const superAdmin = { isSuperAdmin: true, canManageWrapped: true };
const ids = (access: typeof staff) => visibleAdminSections(access).map((section) => section.id);

describe('admin sections', () => {
  it('shows each role the sections it may use', () => {
    expect(ids(staff)).toEqual(['users', 'moderation', 'audit']);
    expect(ids(admin)).toEqual(['users', 'moderation', 'wrapped', 'audit']);
    expect(ids(superAdmin)).toEqual([
      'users', 'schedule', 'administrator-roster', 'moderation', 'feedback', 'wrapped', 'analytics', 'audit',
    ]);
  });

  it('falls back to Users for sections the viewer cannot see', () => {
    expect(resolveAdminTab('feedback', admin)).toBe('users');
    expect(resolveAdminTab('feedback', superAdmin)).toBe('feedback');
    expect(resolveAdminTab('wrapped', staff)).toBe('users');
  });

  it('maps retired tab names to Users', () => {
    expect(resolveAdminTab('permissions', staff)).toBe('users');
    expect(resolveAdminTab(null, superAdmin)).toBe('users');
  });
});
