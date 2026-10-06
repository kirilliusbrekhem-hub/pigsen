/** ISO week helpers in UTC: weeks start on Monday 00:00 UTC. */
export interface Week {
  key: string; // yyyy-Www
  start: Date;
  end: Date; // exclusive
}

export function weekOf(date: Date): Week {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (start.getUTCDay() + 6) % 7; // Monday = 0
  start.setUTCDate(start.getUTCDate() - dow);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  // ISO year/week: the week's Thursday decides the year.
  const thu = new Date(start.getTime() + 3 * 86_400_000);
  const yearStart = Date.UTC(thu.getUTCFullYear(), 0, 1);
  const num = Math.floor((thu.getTime() - yearStart) / 86_400_000 / 7) + 1;
  return { key: `${thu.getUTCFullYear()}-W${String(num).padStart(2, "0")}`, start, end };
}

export const currentWeek = () => weekOf(new Date());
export const lastWeek = () => weekOf(new Date(currentWeek().start.getTime() - 86_400_000));
