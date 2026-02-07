/**
 * Format a UTC datetime string as Eastern Time.
 * Always displays ET regardless of user's local timezone.
 *
 * Example: "2026-03-20T16:00:00Z" → "12:00 PM ET"
 */
export function formatET(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET';
}

/**
 * Format as short time without ET suffix (for compact displays like time slot headers).
 *
 * Example: "2026-03-20T16:00:00Z" → "12:00 PM"
 */
export function formatETShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format as "Thu 3/20 · 12:00 PM ET" (for full game datetime display).
 */
export function formatGameDateTime(dateString: string): string {
  const date = new Date(dateString);
  const dayStr = date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
  });
  return `${dayStr} · ${formatET(dateString)}`;
}

/**
 * Format as "Mar 20" (for round date headers/tooltips).
 */
export function formatDateET(dateString: string): string {
  const date = new Date(dateString + (dateString.includes('T') ? '' : 'T00:00:00'));
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format deadline as "Picks lock at 11:55 AM ET".
 */
export function formatDeadlineTime(deadlineDateString: string): string {
  return `Picks lock at ${formatET(deadlineDateString)}`;
}
