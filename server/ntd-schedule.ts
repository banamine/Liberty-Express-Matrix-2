export function getNyParts(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = parseInt(part.value, 10);
    }
    return acc;
  }, {} as Record<string, number>);
}

export function slotToUtcMs(year: number, month: number, day: number, hour: number, minute: number, second: number): number {
  // Rough approximation for now
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}-04:00`;
  return new Date(dateStr).getTime();
}

export function computeNextBroadcastShow(now: Date) {
  // Returns mock data to simulate calculation of the next window
  return {
    msUntilPreFire: 2 * 60 * 1000, // 2 minutes
    msUntilShow: 15 * 60 * 1000 // 15 minutes
  };
}
