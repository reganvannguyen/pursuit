import type { TrackingSessionSnapshot } from './tracking-session';

export const BACKGROUND_LOCATION_TASK = 'pursuit-background-location';

export function subscribeToBackgroundLocationUpdates(
  _listener: (snapshot: TrackingSessionSnapshot | null) => void,
): () => void {
  return () => undefined;
}

export async function isBackgroundLocationTaskRegistered(): Promise<boolean> {
  return false;
}

export async function startBackgroundLocationTask(): Promise<void> {
  throw new Error('Background location tracking is available in the iOS and Android app only.');
}

export async function stopBackgroundLocationTask(): Promise<void> {}

export function clearPendingLocationBatch(): void {}
