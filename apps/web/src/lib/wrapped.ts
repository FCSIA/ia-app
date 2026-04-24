/**
 * Client-side mirror of the backend Wrapped availability window.
 * Wrapped only opens during May of each calendar year. Outside that window
 * we return the *next* opens-at so the UI can show a countdown. The canonical
 * source is the API; this helper exists to cheaply gate the nav entry and
 * the initial page render without blocking on a network request.
 */
export interface WrappedAvailability {
  open: boolean;
  schoolYear: number;
  opensAt: Date;
  closesAt: Date;
}

export function computeWrappedAvailability(now: Date = new Date()): WrappedAvailability {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (month === 4) {
    return {
      open: true,
      schoolYear: year - 1,
      opensAt: new Date(year, 4, 1),
      closesAt: new Date(year, 4, 31, 23, 59, 59, 999),
    };
  }

  const nextOpensYear = month < 4 ? year : year + 1;
  return {
    open: false,
    schoolYear: nextOpensYear - 1,
    opensAt: new Date(nextOpensYear, 4, 1),
    closesAt: new Date(nextOpensYear, 4, 31, 23, 59, 59, 999),
  };
}

export function schoolYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** "4 months 12 days" / "12 days 3 hours" / "3 hours 14 min". */
export function formatCountdown(target: Date, now: Date = new Date()): string {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'any moment now';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);

  if (months >= 1) {
    const leftoverDays = days - months * 30;
    return `${months} month${months > 1 ? 's' : ''} ${leftoverDays} day${leftoverDays === 1 ? '' : 's'}`;
  }
  if (days >= 1) {
    const leftoverHours = hours - days * 24;
    return `${days} day${days > 1 ? 's' : ''} ${leftoverHours} hour${leftoverHours === 1 ? '' : 's'}`;
  }
  if (hours >= 1) {
    const leftoverMin = minutes - hours * 60;
    return `${hours} hour${hours > 1 ? 's' : ''} ${leftoverMin} min`;
  }
  if (minutes >= 1) {
    return `${minutes} min`;
  }
  return `${seconds} sec`;
}
