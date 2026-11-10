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
