import {
  createTrackingSession,
  modeForBackgroundPermission,
  processLocationBatch,
  reconcileTrackingSession,
  type TrackingSessionSnapshot,
} from '@/services/location/tracking-session';

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
    expect(resumedBatch.acceptedPoints).toHaveLength(1);
    expect(resumedBatch.session.acceptedSamples).toBe(3);
    expect(resumedBatch.session.distanceMeters).toBeGreaterThan(firstBatch.session.distanceMeters);
  });

  it('keeps background batches separate across gaps over 30 seconds', () => {
    const first = processLocationBatch(createTrackingSession('background'), [
      sample(49, -123, 1_000),
      sample(49, -122.9999, 11_000),
    ]);
    const resumed = processLocationBatch(first.session, [sample(49, -122, 42_000)]);

    expect(resumed.acceptedPoints[0]).toMatchObject({ segmentIndex: 1 });
    expect(resumed.session.distanceMeters).toBeCloseTo(first.session.distanceMeters, 2);
    expect(resumed.session.warning).toContain('GPS update gap of 31 seconds');
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
