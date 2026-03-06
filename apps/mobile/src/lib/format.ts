import { format } from 'date-fns';

export function formatEnumLabel(value?: string | null) {
  if (!value) return 'Unknown';
  return value
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function initials(first?: string | null, last?: string | null) {
  return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.trim() || 'IA';
}

export function formatDateTimeRange(start: string, end?: string | null) {
  const startDate = new Date(start);
  const startLabel = format(startDate, 'EEE, MMM d · h:mm a');
  if (!end) return startLabel;

  const endDate = new Date(end);
  if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
    return `${format(startDate, 'EEE, MMM d · h:mm a')} - ${format(endDate, 'h:mm a')}`;
  }

  return `${startLabel} - ${format(endDate, 'EEE, MMM d · h:mm a')}`;
}

export function formatPathway(value?: string | null) {
  if (!value) return 'General';
  if (value === 'INFORMATION_TECHNOLOGY') return 'Information Technology';
  if (value === 'HEALTH_SCIENCE') return 'Health Science';
  if (value === 'ENGINEERING') return 'Engineering';
  return formatEnumLabel(value);
}

export function pathParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
