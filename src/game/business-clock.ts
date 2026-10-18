import { DAY_SECONDS } from './data';

export const BUSINESS_OPEN_HOUR = 8;
export const BUSINESS_HOURS = 12;

/** Saved simulation seconds mapped to the 12-hour trading day, held at closing. */
export function businessElapsedMinutes(seconds: number): number {
  const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return Math.floor(Math.min(1, elapsed / DAY_SECONDS) * BUSINESS_HOURS * 60);
}

export const businessClockMinutes = (seconds: number) => BUSINESS_OPEN_HOUR * 60 + businessElapsedMinutes(seconds);

function hoursAndMinutes(minutes: number, padHours = false): string {
  const hours = String(Math.floor(minutes / 60));
  return `${padHours ? hours.padStart(2, '0') : hours}:${String(minutes % 60).padStart(2, '0')}`;
}

export const formatBusinessClock = (seconds: number) => hoursAndMinutes(businessClockMinutes(seconds), true);
export const formatBusinessDuration = (seconds: number) => hoursAndMinutes(businessElapsedMinutes(seconds));
