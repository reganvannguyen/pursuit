import {
  averagePaceSecondsPerKilometer,
  elapsedTimeMilliseconds,
  formatDuration,
  formatPace,
  livePaceSecondsPerKilometer,
} from '@/services/location/session-metrics';
import type { TrackedRoutePoint } from '@/services/location/tracking-session';

function point(
  latitude: number,
  longitude: number,
  timestamp: number,
  segmentIndex = 0,
): TrackedRoutePoint {
  return { latitude, longitude, timestamp, accuracy: 5, segmentIndex };
}

describe('session metrics', () => {
  it('counts elapsed wall-clock time through pauses and freezes it when stopped', () => {
    expect(elapsedTimeMilliseconds(1_000, 61_000)).toBe(60_000);
    expect(elapsedTimeMilliseconds(1_000, 90_000, 31_000)).toBe(30_000);
    expect(elapsedTimeMilliseconds(null, 90_000)).toBe(0);
  });

  it('calculates average moving pace and leaves empty or invalid values blank', () => {
    expect(averagePaceSecondsPerKilometer(1_000, 461_000)).toBe(461);
    expect(averagePaceSecondsPerKilometer(0, 10_000)).toBeNull();
    expect(averagePaceSecondsPerKilometer(1_000, 0)).toBeNull();
  });

  it('calculates a live pace from accepted movement in the trailing window only', () => {
    const route = [
      point(0, 0, 0),
      point(0, 0.0001, 10_000),
      point(0, 0.0002, 20_000),
      point(0, 1, 30_000, 1),
    ];

    const livePace = livePaceSecondsPerKilometer(route, 20_000);
    expect(livePace).not.toBeNull();
    expect(livePace).toBeCloseTo(899, 0);
    expect(livePaceSecondsPerKilometer(route, 100_000)).toBeNull();
  });

  it('formats duration and pace for display', () => {
    expect(formatDuration(61_999)).toBe('01:01');
    expect(formatDuration(3_661_000)).toBe('1:01:01');
    expect(formatPace(461)).toBe('7:41 /km');
    expect(formatPace(null)).toBe('—');
  });
});
