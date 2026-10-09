import {
  DistanceProcessor,
  type LocationSample,
  type SampleRejectionReason,
} from './distance-processor';

export type TrackingMode = 'idle' | 'background' | 'foreground-only' | 'interrupted';
export type ActiveTrackingMode = Exclude<TrackingMode, 'idle' | 'interrupted'>;

export type TrackedRoutePoint = LocationSample & {
  segmentIndex: number;
};

export type TrackingSessionCore = {
  mode: ActiveTrackingMode | 'interrupted';
  distanceMeters: number;
  accuracyMeters: number | null;
  acceptedSamples: number;
  rejectedSamples: number;
  lastAcceptedSample: LocationSample | null;
  lastLocationAt: number | null;
  segmentIndex: number;
  warning: string | null;
};

export type TrackingSessionSnapshot = TrackingSessionCore & {
  route: TrackedRoutePoint[];
};

export type SampleRejection = {
  sample: LocationSample;
  reason: SampleRejectionReason;
  segmentDistanceMeters?: number;
  speedMetersPerSecond?: number;
};

export type ProcessedLocationBatch = {
  session: TrackingSessionCore;
  acceptedPoints: TrackedRoutePoint[];
  rejections: SampleRejection[];
};

export function createTrackingSession(mode: ActiveTrackingMode): TrackingSessionCore {
  return {
    mode,
    distanceMeters: 0,
    accuracyMeters: null,
    acceptedSamples: 0,
    rejectedSamples: 0,
    lastAcceptedSample: null,
    lastLocationAt: null,
    segmentIndex: 0,
    warning: null,
  };
}

export function modeForBackgroundPermission(
  backgroundPermissionGranted: boolean,
): ActiveTrackingMode {
  return backgroundPermissionGranted ? 'background' : 'foreground-only';
}

export function processLocationBatch(
  current: TrackingSessionCore,
  samples: LocationSample[],
): ProcessedLocationBatch {
  const processor = new DistanceProcessor({
    totalDistanceMeters: current.distanceMeters,
    lastAcceptedSample: current.lastAcceptedSample,
    segmentIndex: current.segmentIndex,
  });
  const acceptedPoints: TrackedRoutePoint[] = [];
  const rejections: SampleRejection[] = [];
  let accuracyMeters = current.accuracyMeters;
  let lastLocationAt = current.lastLocationAt;
  let rejectedSamples = current.rejectedSamples;
  let warning = current.warning;

  for (const sample of samples) {
    if (
      typeof sample.accuracy === 'number' &&
      Number.isFinite(sample.accuracy) &&
      sample.accuracy >= 0
    ) {
      accuracyMeters = sample.accuracy;
    }

    if (Number.isFinite(sample.timestamp) && sample.timestamp >= 0) {
      lastLocationAt = Math.max(lastLocationAt ?? 0, sample.timestamp);
    }

    const result = processor.process(sample);
    if (!result.accepted) {
      rejectedSamples += 1;
      rejections.push({
        sample,
        reason: result.rejectionReason,
        segmentDistanceMeters: result.segmentDistanceMeters,
        speedMetersPerSecond: result.speedMetersPerSecond,
      });
      continue;
    }

    acceptedPoints.push({ ...sample, segmentIndex: result.segmentIndex });
    if (warning?.startsWith('No GPS update for')) warning = null;
    if (result.gapMilliseconds !== undefined) {
      warning = `GPS update gap of ${Math.ceil(result.gapMilliseconds / 1000)} seconds; some route distance may be missing.`;
    }
  }

  const processorSnapshot = processor.getSnapshot();
  return {
    session: {
      ...current,
      distanceMeters: processorSnapshot.totalDistanceMeters,
      accuracyMeters,
      acceptedSamples: current.acceptedSamples + acceptedPoints.length,
      rejectedSamples,
      lastAcceptedSample: processorSnapshot.lastAcceptedSample,
      lastLocationAt,
      segmentIndex: processorSnapshot.segmentIndex,
      warning,
    },
    acceptedPoints,
    rejections,
  };
}

export function withTrackingWarning(
  session: TrackingSessionCore,
  warning: string,
  interrupted = false,
): TrackingSessionCore {
  return {
    ...session,
    mode: interrupted ? 'interrupted' : session.mode,
    warning,
  };
}

export function warningForStaleLocation(lastLocationAt: number, now: number): string | null {
  const gapMilliseconds = now - lastLocationAt;
  if (gapMilliseconds <= 30_000) return null;

  return `No GPS update for ${Math.ceil(gapMilliseconds / 1000)} seconds; the route may have a gap.`;
}

export function reconcileTrackingSession(
  session: TrackingSessionSnapshot,
  backgroundTaskRegistered: boolean,
  now: number,
): TrackingSessionSnapshot {
  if (session.mode === 'background' && !backgroundTaskRegistered) {
    return {
      ...session,
      ...withTrackingWarning(
        session,
        'Background location task is no longer registered. Tracking was interrupted and was not resumed.',
        true,
      ),
    };
  }

  if (session.lastLocationAt !== null) {
    const staleWarning = warningForStaleLocation(session.lastLocationAt, now);
    if (staleWarning) {
      return { ...session, ...withTrackingWarning(session, staleWarning) };
    }
  }

  return session;
}
