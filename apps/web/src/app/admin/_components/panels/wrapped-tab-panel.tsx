'use client';

import { WrappedSnapshotsTab } from '../wrapped-snapshots-tab';
import { useAdminWrapped } from '../../_hooks/use-admin-wrapped';

type WrappedTabPanelProps = {
  canManageWrapped: boolean;
};

export function WrappedTabPanel({ canManageWrapped }: WrappedTabPanelProps) {
  const wrapped = useAdminWrapped('wrapped', canManageWrapped);

  return (
    <WrappedSnapshotsTab
      wrappedSchoolYear={wrapped.wrappedSchoolYear}
      onWrappedSchoolYearChange={wrapped.setWrappedSchoolYear}
      wrappedYearOptions={wrapped.wrappedYearOptions}
      status={wrapped.status}
      isLoading={wrapped.isLoading}
      isError={wrapped.isError}
      error={wrapped.error}
      generateMutation={wrapped.generateMutation}
    />
  );
}
