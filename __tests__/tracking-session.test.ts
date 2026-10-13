import {
  createTrackingSession,
  modeForBackgroundPermission,
  pauseTrackingSession,
  processLocationBatch,
  reconcileTrackingSession,
  resumeTrackingSession,
  type TrackingSessionSnapshot,
} from '@/services/location/tracking-session';
import { elapsedTimeMilliseconds } from '@/services/location/session-metrics';

function sample(latitude: number, longitude: number, timestamp: number) {
  return { latitude, longitude, accuracy: 8, timestamp };
}

describe('tracking session processing', () => {
  it('processes batched locations and continues the saved state when the app returns', () => {
    const firstBatch = processLocationBatch(createTrackingSession('background'), [
      sample(49, -123, 1_000),
      sample(49, -122.9999, 11_000),
    ]);

    const savedSnapshot: TrackingSessionSnapshot = {
      ...firstBatch.session,
      route: firstBatch.acceptedPoints,
    };
    const resumedBatch = processLocationBatch(savedSnapshot, [sample(49, -122.9998, 21_000)]);

    expect(firstBatch.acceptedPoints).toHaveLength(2);
    expect(firstBatch.session.movingTimeMilliseconds).toBe(10_000);
    expect(resumedBatch.acceptedPoints).toHaveLength(1);
    expect(resumedBatch.session.acceptedSamples).toBe(3);
    expect(resumedBatch.session.distanceMeters).toBeGreaterThan(firstBatch.session.distanceMeters);
    expect(resumedBatch.session.movingTimeMilliseconds).toBe(20_000);
  });

  it('keeps background batches separate across gaps over 30 seconds', () => {
    const first = processLocationBatch(createTrackingSession('background'), [
      sample(49, -123, 1_000),
      sample(49, -122.9999, 11_000),
    ]);
    const resumed = processLocationBatch(first.session, [sample(49, -122, 42_000)]);

    expect(resumed.acceptedPoints[0]).toMatchObject({ segmentIndex: 1 });
    expect(resumed.session.distanceMeters).toBeCloseTo(first.session.distanceMeters, 2);
    expect(resumed.session.movingTimeMilliseconds).toBe(10_000);
    expect(resumed.session.warning).toContain('GPS update gap of 31 seconds');
  });

  it('freezes movement while paused and starts a new segment on resume', () => {
    const firstBatch = processLocationBatch(createTrackingSession('background', 500), [
      sample(49, -123, 1_000),
      sample(49, -122.9999, 11_000),
    ]);
    const paused = pauseTrackingSession(firstBatch.session, 12_000);
    const ignored = processLocationBatch(paused, [sample(49.1, -123, 20_000)]);

    expect(ignored.acceptedPoints).toHaveLength(0);
    expect(ignored.session).toEqual(paused);
    expect(elapsedTimeMilliseconds(paused.startedAt, 62_000)).toBe(61_500);

    const resumed = resumeTrackingSession(paused, 'background');
    expect(resumed).toMatchObject({
      mode: 'background',
      pausedAt: null,
      lastAcceptedSample: null,
      lastLocationAt: null,
      segmentIndex: 1,
      distanceMeters: firstBatch.session.distanceMeters,
      movingTimeMilliseconds: 10_000,
    });

    const afterResume = processLocationBatch(resumed, [
      sample(49.1, -123, 21_000),
      sample(49.1, -122.9999, 31_000),
    ]);
    expect(afterResume.acceptedPoints.map(({ segmentIndex }) => segmentIndex)).toEqual([1, 1]);
    expect(afterResume.acceptedPoints[0]?.latitude).toBe(49.1);
    expect(afterResume.session.distanceMeters).toBeGreaterThan(firstBatch.session.distanceMeters);
    expect(afterResume.session.movingTimeMilliseconds).toBe(20_000);
  });

  it('does not count zero-distance samples or gaps longer than 30 seconds as moving time', () => {
    const first = processLocationBatch(createTrackingSession('background', 0), [
      sample(49, -123, 1_000),
      sample(49, -123, 11_000),
    ]);
    const afterGap = processLocationBatch(first.session, [sample(49, -122.999, 42_000)]);

    expect(first.session.movingTimeMilliseconds).toBe(0);
    expect(afterGap.session.movingTimeMilliseconds).toBe(0);
  });

  it('uses foreground-only mode when background permission is declined', () => {
    expect(modeForBackgroundPermission(false)).toBe('foreground-only');
    expect(modeForBackgroundPermission(true)).toBe('background');
  });

  it('marks a missing background task as interrupted without recovering the session', () => {
    const session = processLocationBatch(createTrackingSession('background'), [
      sample(49, -123, 1_000),
    ]);
    const snapshot: TrackingSessionSnapshot = {
      ...session.session,
      route: session.acceptedPoints,
    };

    expect(reconcileTrackingSession(snapshot, false, 2_000)).toMatchObject({
      mode: 'interrupted',
      warning: expect.stringContaining('no longer registered'),
      route: snapshot.route,
    });
  });

  it('warns about a stale sample without adding a distance bridge', () => {
    const session = processLocationBatch(createTrackingSession('background'), [
      sample(49, -123, 1_000),
    ]);
    const snapshot: TrackingSessionSnapshot = {
      ...session.session,
      route: session.acceptedPoints,
    };

    expect(reconcileTrackingSession(snapshot, true, 32_000).warning).toContain('No GPS update for');
  });
});
