// Streak rules (pure, unit-tested).
//
// A day "counts" when the chapters read that day reach the goal in force that day.
// One grace day per rolling 7 days: a single missed day does not break the streak,
// as long as no other day in the 6 days before it was also missed (or graced).
// Today never breaks a streak; it only adds to it once the goal is met.

export type ISODate = string; // "YYYY-MM-DD" in the reader's local time zone

export interface DayResult {
  date: ISODate;
  met: boolean;
  graced: boolean;
}

export interface StreakSummary {
  current: number; // days met in the current run (graced days are not counted)
  metToday: boolean;
  days: DayResult[]; // most recent first, covering the current run
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(date: ISODate, n: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

/**
 * @param readsPerDay chapters read on each local date
 * @param goalOn the daily goal in force on a date
 * @param today the reader's local date
 */
export function computeStreak(
  readsPerDay: Record<ISODate, number>,
  goalOn: (date: ISODate) => number,
  today: ISODate,
): StreakSummary {
  const met = (d: ISODate) => (readsPerDay[d] ?? 0) >= goalOn(d);
  const metToday = met(today);
  const days: DayResult[] = [];
  let current = metToday ? 1 : 0;
  if (metToday) days.push({ date: today, met: true, graced: false });

  let lastGrace: ISODate | null = null;
  let date = addDays(today, -1);
  const earliest = Object.keys(readsPerDay).sort()[0];

  while (earliest && date >= earliest) {
    if (met(date)) {
      current++;
      days.push({ date, met: true, graced: false });
    } else {
      const graceAllowed = lastGrace === null || addDays(date, 7) <= lastGrace;
      // A grace day needs a met day before it, or the run has simply started.
      if (!graceAllowed || !met(addDays(date, -1))) break;
      lastGrace = date;
      days.push({ date, met: false, graced: true });
    }
    date = addDays(date, -1);
  }

  return { current, metToday, days };
}
