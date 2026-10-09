import {
  distanceBetweenPoints,
  MAX_CONTIGUOUS_SAMPLE_GAP_MILLISECONDS,
} from './distance-processor';
import type { TrackedRoutePoint } from './tracking-session';

export const LIVE_PACE_WINDOW_MILLISECONDS = 60_000;

export function elapsedTimeMilliseconds(
  startedAt: number | null,
  now: number,
  stoppedAt: number | null = null,
): number {
  if (startedAt === null) return 0;
  return Math.max(0, (stoppedAt ?? now) - startedAt);
}

export function averagePaceSecondsPerKilometer(
  distanceMeters: number,
  movingTimeMilliseconds: number,
): number | null {
  if (distanceMeters <= 0 || movingTimeMilliseconds <= 0) return null;
  const pace = movingTimeMilliseconds / 1000 / (distanceMeters / 1000);
  return Number.isFinite(pace) && pace > 0 ? pace : null;
}

export function livePaceSecondsPerKilometer(
  route: TrackedRoutePoint[],
  now: number,
  windowMilliseconds = LIVE_PACE_WINDOW_MILLISECONDS,
): number | null {
  const windowStart = now - windowMilliseconds;
  let distanceMeters = 0;
  let movingTimeMilliseconds = 0;

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1]!;
    const current = route[index]!;
    if (previous.segmentIndex !== current.segmentIndex) continue;

    const intervalMilliseconds = current.timestamp - previous.timestamp;
    if (
      intervalMilliseconds <= 0 ||
      intervalMilliseconds > MAX_CONTIGUOUS_SAMPLE_GAP_MILLISECONDS
    ) {
      continue;
    }

    const overlapStart = Math.max(previous.timestamp, windowStart);
    const overlapEnd = Math.min(current.timestamp, now);
    const overlapMilliseconds = overlapEnd - overlapStart;
    if (overlapMilliseconds <= 0) continue;

    const segmentDistanceMeters = distanceBetweenPoints(previous, current);
    if (segmentDistanceMeters <= 0) continue;

    const includedFraction = overlapMilliseconds / intervalMilliseconds;
    distanceMeters += segmentDistanceMeters * includedFraction;
    movingTimeMilliseconds += overlapMilliseconds;
  }

  return averagePaceSecondsPerKilometer(distanceMeters, movingTimeMilliseconds);
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}

export function formatPace(secondsPerKilometer: number | null): string {
  if (secondsPerKilometer === null || !Number.isFinite(secondsPerKilometer)) return '—';
  const totalSeconds = Math.max(0, Math.round(secondsPerKilometer));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}
