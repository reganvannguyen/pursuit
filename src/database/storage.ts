import {
  createTrackingSession,
  processLocationBatch,
  withTrackingWarning,
  type ActiveTrackingMode,
  type ProcessedLocationBatch,
  type TrackingSessionSnapshot,
} from '@/services/location/tracking-session';
import type { LocationSample } from '@/services/location/distance-processor';

export type ProbeRecord = {
  id: string;
  value: string;
};

let webTrackingSession: TrackingSessionSnapshot | null = null;

function unsupportedStorageError() {
  return new Error('The SQLite storage check is available on iOS and Android only.');
}

export async function initializeDatabase(): Promise<void> {
  throw unsupportedStorageError();
}

export async function saveProbeRecord(_value: string): Promise<void> {
  throw unsupportedStorageError();
}

export async function readProbeRecord(): Promise<ProbeRecord | null> {
  throw unsupportedStorageError();
}

export async function beginTrackingSession(mode: ActiveTrackingMode): Promise<void> {
  webTrackingSession = { ...createTrackingSession(mode), route: [] };
}

export async function setTrackingSessionMode(mode: ActiveTrackingMode): Promise<void> {
  if (webTrackingSession) webTrackingSession = { ...webTrackingSession, mode };
}

export async function setTrackingSessionWarning(warning: string): Promise<void> {
  if (webTrackingSession) webTrackingSession = { ...webTrackingSession, warning };
}

export async function markTrackingSessionInterrupted(warning: string): Promise<void> {
  if (!webTrackingSession) return;
  webTrackingSession = {
    ...webTrackingSession,
    ...withTrackingWarning(webTrackingSession, warning, true),
    route: webTrackingSession.route,
  };
}

export async function appendTrackingLocations(
  samples: LocationSample[],
): Promise<ProcessedLocationBatch | null> {
  if (!webTrackingSession || samples.length === 0) return null;

  const processed = processLocationBatch(webTrackingSession, samples);
  webTrackingSession = {
    ...processed.session,
    route: [...webTrackingSession.route, ...processed.acceptedPoints],
  };
  return processed;
}

export async function readTrackingSession(): Promise<TrackingSessionSnapshot | null> {
  return webTrackingSession;
}

export async function clearTrackingSession(): Promise<void> {
  webTrackingSession = null;
}
