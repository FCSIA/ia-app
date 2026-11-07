export function eventStatusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

/** Badge classes for an event's status in the events list. */
export function eventStatusClass(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/25';
    case 'PENDING_APPROVAL':
      return 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25';
    case 'CANCELLED':
      return 'bg-red-500/15 text-red-500 border-red-500/30 hover:bg-red-500/25';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
