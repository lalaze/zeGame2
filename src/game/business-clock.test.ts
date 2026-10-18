import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from './data';
import { businessClockMinutes, businessElapsedMinutes, formatBusinessClock, formatBusinessDuration } from './business-clock';

describe('the shared 08:00–20:00 business clock', () => {
  it.each([
    [0, '08:00', '0:00'],
    [DAY_SECONDS / 4, '11:00', '3:00'],
    [DAY_SECONDS / 2, '14:00', '6:00'],
    [DAY_SECONDS * 3 / 4, '17:00', '9:00'],
    [DAY_SECONDS, '20:00', '12:00'],
  ])('maps %s simulation seconds to the displayed clock and elapsed business hours', (seconds, clock, duration) => {
    expect(formatBusinessClock(seconds)).toBe(clock);
    expect(formatBusinessDuration(seconds)).toBe(duration);
    expect(businessClockMinutes(seconds) - 8 * 60).toBe(businessElapsedMinutes(seconds));
  });

  it('holds the closing time during final deliveries and for overdue legacy saves', () => {
    for (const seconds of [DAY_SECONDS + 30, 33 * 60 + 9]) {
      expect(formatBusinessClock(seconds)).toBe('20:00');
      expect(formatBusinessDuration(seconds)).toBe('12:00');
    }
  });
});
