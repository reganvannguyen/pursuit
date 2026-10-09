import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import {
  appendTrackingLocations,
  markTrackingSessionInterrupted,
  readTrackingSession,
  setTrackingSessionWarning,
} from '@/database/storage';
import { isSQLiteBusyError } from '@/database/sqlite-errors';
import type { LocationSample } from './distance-processor';
import type { ProcessedLocationBatch, TrackingSessionSnapshot } from './tracking-session';

export const BACKGROUND_LOCATION_TASK = 'pursuit-background-location';

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

type TrackingUpdateListener = (snapshot: TrackingSessionSnapshot | null) => void;

const listeners = new Set<TrackingUpdateListener>();
let pendingSamples: LocationSample[] = [];

function toSample(location: Location.LocationObject): LocationSample {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

async function publishSnapshot(): Promise<void> {
  const snapshot = await readTrackingSession();
  for (const listener of listeners) listener(snapshot);
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<LocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    try {
      if (error) {
        const warning = `Background GPS task failed: ${error.message}`;
        pendingSamples = [];
        console.error('[GPS tracker] Background task failed', error);
        await markTrackingSessionInterrupted(warning);
        await publishSnapshot();
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => undefined);
        return;
      }

      const samples = [...pendingSamples, ...(data.locations?.map(toSample) ?? [])];
      let batch: ProcessedLocationBatch | null;
      try {
        batch = await appendTrackingLocations(samples);
        pendingSamples = [];
      } catch (writeError) {
        if (!isSQLiteBusyError(writeError)) throw writeError;
        pendingSamples = samples;
        console.warn(
          '[GPS tracker] SQLite is busy; keeping this GPS batch for the next task call.',
        );
        try {
          await setTrackingSessionWarning(
            'GPS storage is temporarily busy. The current location batch will be retried.',
          );
          await publishSnapshot();
        } catch (warningError) {
          console.warn('[GPS tracker] Could not save the temporary SQLite warning', warningError);
        }
        return;
      }

      for (const rejection of batch?.rejections ?? []) {
        console.warn('[GPS tracker] Rejected background sample', rejection);
      }
      if (batch) {
        try {
          await publishSnapshot();
        } catch (readError) {
          if (!isSQLiteBusyError(readError)) throw readError;
          console.warn('[GPS tracker] SQLite is busy while refreshing the saved route.');
        }
      }
    } catch (taskError) {
      if (isSQLiteBusyError(taskError)) {
        console.warn(
          '[GPS tracker] SQLite is busy; leaving background tracking active.',
          taskError,
        );
        return;
      }

      const message = taskError instanceof Error ? taskError.message : 'Unknown storage error.';
      pendingSamples = [];
      console.error('[GPS tracker] Could not process a background location batch', taskError);
      try {
        await markTrackingSessionInterrupted(`Background GPS update failed: ${message}`);
        await publishSnapshot();
      } catch (storageError) {
        console.error('[GPS tracker] Could not save the background task error', storageError);
      }
    }
  });
}

export function subscribeToBackgroundLocationUpdates(listener: TrackingUpdateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function isBackgroundLocationTaskRegistered(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

export async function startBackgroundLocationTask(): Promise<void> {
  if (await isBackgroundLocationTaskRegistered()) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 3,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    ...(Platform.OS === 'ios' ? { showsBackgroundLocationIndicator: true } : {}),
    ...(Platform.OS === 'android'
      ? {
          foregroundService: {
            notificationTitle: 'Pursuit is tracking your route',
            notificationBody: 'GPS tracking is active. Tap to return to your run.',
          },
        }
      : {}),
  });
}

export function clearPendingLocationBatch(): void {
  pendingSamples = [];
}

export async function stopBackgroundLocationTask(): Promise<void> {
  if (await isBackgroundLocationTaskRegistered()) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
