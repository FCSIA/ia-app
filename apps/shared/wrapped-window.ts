export type WrappedAvailability = {
  open: boolean;
  schoolYear: number;
  opensAt: Date;
  closesAt: Date;
};

/**
 * Wrapped opens for the whole of May. Outside that window this names the next
 * opening so a countdown can show. Uses the runtime's own zone (UTC on Convex,
 * the device's zone in clients), so a client gate can differ from the server's
 * for a few hours at the edges; the server stays the authority.
 */
export function wrappedAvailability(now: Date = new Date()): WrappedAvailability {
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
