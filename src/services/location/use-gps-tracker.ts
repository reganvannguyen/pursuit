import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import * as Location from 'expo-location';

import {
  appendTrackingLocations,
  beginTrackingSession,
  clearTrackingSession,
  markTrackingSessionInterrupted,
  readTrackingSession,
  setTrackingSessionMode,
  setTrackingSessionWarning,
} from '@/database/storage';
import {
  clearPendingLocationBatch,
  isBackgroundLocationTaskRegistered,
  startBackgroundLocationTask,
  stopBackgroundLocationTask,
  subscribeToBackgroundLocationUpdates,
} from './background-location-task';
import type { LocationSample, SampleRejectionReason } from './distance-processor';
import {
  modeForBackgroundPermission,
  reconcileTrackingSession,
  type TrackingMode,
  type TrackingSessionSnapshot,
  type TrackedRoutePoint,
} from './tracking-session';

type TrackerState = {
  distanceMeters: number;
  accuracyMeters: number | null;
  lastAcceptedAccuracyMeters: number | null;
  acceptedSamples: number;
  rejectedSamples: number;
  route: TrackedRoutePoint[];
  mode: TrackingMode;
  lastLocationAt: number | null;
  warning: string | null;
  isStarting: boolean;
  isTracking: boolean;
  error: string | null;
};

const INITIAL_STATE: TrackerState = {
  distanceMeters: 0,
  accuracyMeters: null,
  lastAcceptedAccuracyMeters: null,
  acceptedSamples: 0,
  rejectedSamples: 0,
  route: [],
  mode: 'idle',
  lastLocationAt: null,
  warning: null,
  isStarting: false,
  isTracking: false,
  error: null,
};

const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 3,
};

function formatRejectionReason(reason: SampleRejectionReason): string {
  switch (reason) {
    case 'invalid_sample':
      return 'invalid coordinates or timestamp';
    case 'out_of_order_timestamp':
      return 'sample timestamp was not newer than the last accepted sample';
    case 'impossible_speed':
      return 'sample implied an impossible travel speed';
  }
}

function stateFromSession(
  session: TrackingSessionSnapshot,
  isTracking: boolean,
  overrides: Partial<TrackerState> = {},
): TrackerState {
  const acceptedAccuracy = session.lastAcceptedSample?.accuracy;
  return {
    distanceMeters: session.distanceMeters,
    accuracyMeters: session.accuracyMeters,
    lastAcceptedAccuracyMeters:
      typeof acceptedAccuracy === 'number' && Number.isFinite(acceptedAccuracy)
        ? acceptedAccuracy
        : null,
    acceptedSamples: session.acceptedSamples,
    rejectedSamples: session.rejectedSamples,
    route: session.route,
    mode: session.mode,
    lastLocationAt: session.lastLocationAt,
    warning: session.warning,
    isStarting: false,
    isTracking,
    error: null,
    ...overrides,
  };
}

function sampleFromLocation(location: Location.LocationObject): LocationSample {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

async function explainBackgroundPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  return new Promise((resolve) => {
    Alert.alert(
      'Allow background location?',
      'Pursuit needs Always location access to record your route while the phone is locked or the app is in the background. If you continue, iOS or Android will ask for that access next.',
      [
        { text: 'Use foreground only', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: false, onDismiss: () => resolve(false) },
    );
  });
}

export function useGpsTracker() {
  const [state, setState] = useState(INITIAL_STATE);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const startingRef = useRef(false);
  const trackingRef = useRef(false);
  const providerRef = useRef<'background' | 'foreground-only' | null>(null);
  const mountedRef = useRef(true);

  const applyStoredSession = useCallback(async () => {
    if (startingRef.current) return;
    const stored = await readTrackingSession();
    if (!stored) return;

    let session = stored;
    if (session.mode === 'background') {
      const taskRegistered = await isBackgroundLocationTaskRegistered();
      session = reconcileTrackingSession(session, taskRegistered, Date.now());
      if (session.mode === 'interrupted' && stored.mode !== 'interrupted') {
        await markTrackingSessionInterrupted(
          session.warning ?? 'Background tracking was interrupted.',
        );
      } else if (session.warning !== stored.warning && session.warning) {
        await setTrackingSessionWarning(session.warning);
      }
      providerRef.current = taskRegistered && session.mode === 'background' ? 'background' : null;
      trackingRef.current = providerRef.current !== null;
    } else if (session.mode === 'foreground-only') {
      if (!subscriptionRef.current) {
        session = {
          ...session,
          mode: 'interrupted',
          warning:
            'Foreground-only tracking ended while Pursuit was not active. The session was not resumed.',
        };
        await markTrackingSessionInterrupted(
          session.warning ?? 'Foreground-only tracking was interrupted.',
        );
        providerRef.current = null;
        trackingRef.current = false;
      } else {
        session = reconcileTrackingSession(session, false, Date.now());
        if (session.warning !== stored.warning && session.warning) {
          await setTrackingSessionWarning(session.warning);
        }
        providerRef.current = 'foreground-only';
        trackingRef.current = true;
      }
    } else {
      providerRef.current = null;
      trackingRef.current = false;
    }

    if (!mountedRef.current) return;
    setState(stateFromSession(session, trackingRef.current));
  }, []);

  const handleLocation = useCallback(async (sample: LocationSample) => {
    if (!trackingRef.current) return;

    try {
      const batch = await appendTrackingLocations([sample]);
      for (const rejection of batch?.rejections ?? []) {
        console.warn('[GPS tracker] Rejected sample', {
          reason: formatRejectionReason(rejection.reason),
          segmentDistanceMeters: rejection.segmentDistanceMeters,
          speedMetersPerSecond: rejection.speedMetersPerSecond,
          accuracyMeters: sample.accuracy,
        });
      }
      const session = await readTrackingSession();
      if (mountedRef.current && session) {
        setState(stateFromSession(session, trackingRef.current));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error.';
      console.error('[GPS tracker] Could not save a location update', error);
      trackingRef.current = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      void markTrackingSessionInterrupted(`Saving a GPS update failed: ${message}`).catch(
        () => undefined,
      );
      void stopBackgroundLocationTask().catch(() => undefined);
      if (mountedRef.current) {
        setState((current) => ({
          ...current,
          isStarting: false,
          isTracking: false,
          mode: 'interrupted',
          error: `Could not save the GPS update: ${message}`,
        }));
      }
    }
  }, []);

  const stopForegroundWatcher = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  const startForegroundWatcher = useCallback(async () => {
    const subscription = await Location.watchPositionAsync(
      LOCATION_OPTIONS,
      (location) => void handleLocation(sampleFromLocation(location)),
      (reason) => {
        console.error('[GPS tracker] Foreground location update failed', reason);
        trackingRef.current = false;
        stopForegroundWatcher();
        void markTrackingSessionInterrupted(`Foreground GPS updates stopped: ${reason}`).catch(
          () => undefined,
        );
        if (mountedRef.current) {
          setState((current) => ({
            ...current,
            isStarting: false,
            isTracking: false,
            mode: 'interrupted',
            warning: `Foreground GPS updates stopped: ${reason}`,
          }));
        }
      },
    );

    if (!mountedRef.current || !trackingRef.current) {
      subscription.remove();
      return;
    }

    subscriptionRef.current = subscription;
  }, [handleLocation, stopForegroundWatcher]);

  const start = useCallback(async () => {
    if (startingRef.current || trackingRef.current) return;

    startingRef.current = true;
    setState({ ...INITIAL_STATE, isStarting: true });

    try {
      const foregroundPermission = await Location.requestForegroundPermissionsAsync();
      if (!mountedRef.current) return;

      if (foregroundPermission.status !== 'granted') {
        const message = foregroundPermission.canAskAgain
          ? 'Location permission was not granted. Allow access to track a route.'
          : 'Location access is off. Enable it for Pursuit in Settings, then try again.';
        setState({ ...INITIAL_STATE, error: message });
        return;
      }

      const existingBackgroundPermission = await Location.getBackgroundPermissionsAsync();
      let backgroundPermissionGranted = existingBackgroundPermission.status === 'granted';
      let backgroundWarning: string | null = null;

      if (!backgroundPermissionGranted && existingBackgroundPermission.canAskAgain) {
        const continueToSystemPrompt = await explainBackgroundPermission();
        if (continueToSystemPrompt) {
          const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
          backgroundPermissionGranted = backgroundPermission.status === 'granted';
          if (!backgroundPermissionGranted) {
            backgroundWarning =
              'Background location was not granted. Foreground-only tracking may pause while the phone is locked or Pursuit is in the background.';
          }
        } else {
          backgroundWarning =
            'Background location was skipped. Foreground-only tracking may pause while the phone is locked or Pursuit is in the background.';
        }
      } else if (!backgroundPermissionGranted) {
        backgroundWarning =
          'Background location is off. Enable Always location for Pursuit in Settings; tracking will stay foreground only for this session.';
      }

      const mode = modeForBackgroundPermission(backgroundPermissionGranted);
      const initialWarning = backgroundWarning;

      await stopBackgroundLocationTask().catch(() => undefined);
      clearPendingLocationBatch();
      stopForegroundWatcher();
      await beginTrackingSession(mode);
      if (initialWarning) await setTrackingSessionWarning(initialWarning);

      trackingRef.current = true;
      providerRef.current = mode;

      if (mode === 'background') {
        try {
          await startBackgroundLocationTask();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown location error.';
          const warning = `Background GPS could not start (${message}). Tracking is foreground only.`;
          console.warn('[GPS tracker] Falling back to foreground location', error);
          await stopBackgroundLocationTask().catch(() => undefined);
          await setTrackingSessionMode('foreground-only');
          await setTrackingSessionWarning(warning);
          providerRef.current = 'foreground-only';
          await startForegroundWatcher();
        }
      } else {
        await startForegroundWatcher();
      }

      const session = await readTrackingSession();
      if (mountedRef.current && session) {
        setState(
          stateFromSession(session, trackingRef.current, {
            isStarting: false,
            isTracking: trackingRef.current,
          }),
        );
      }
    } catch (error) {
      trackingRef.current = false;
      providerRef.current = null;
      stopForegroundWatcher();
      void stopBackgroundLocationTask().catch(() => undefined);
      const message = error instanceof Error ? error.message : 'Unknown location error.';
      console.error('[GPS tracker] Could not start location updates', error);
      if (mountedRef.current) {
        setState((current) => ({
          ...current,
          isStarting: false,
          isTracking: false,
          mode: 'idle',
          error: `Could not start GPS tracking: ${message}`,
        }));
      }
    } finally {
      startingRef.current = false;
    }
  }, [startForegroundWatcher, stopForegroundWatcher]);

  const stop = useCallback(async () => {
    trackingRef.current = false;
    providerRef.current = null;
    stopForegroundWatcher();

    let finalSession: TrackingSessionSnapshot | null = null;
    let stopError: string | null = null;
    try {
      await stopBackgroundLocationTask();
    } catch (error) {
      stopError = error instanceof Error ? error.message : 'Unknown stop error.';
    }
    clearPendingLocationBatch();

    try {
      finalSession = await readTrackingSession();
    } catch (error) {
      stopError ??= error instanceof Error ? error.message : 'Unknown storage error.';
    }

    try {
      await clearTrackingSession();
    } catch (error) {
      stopError ??= error instanceof Error ? error.message : 'Unknown storage error.';
    }

    if (mountedRef.current) {
      setState(
        finalSession
          ? stateFromSession(finalSession, false, {
              mode: 'idle',
              isStarting: false,
              warning: stopError
                ? `Stopped, but session cleanup failed: ${stopError}`
                : finalSession.warning,
              error: stopError ? `Could not fully stop GPS tracking: ${stopError}` : null,
            })
          : {
              ...INITIAL_STATE,
              error: stopError ? `Could not stop GPS tracking: ${stopError}` : null,
            },
      );
    }
  }, [stopForegroundWatcher]);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeToBackgroundLocationUpdates((snapshot) => {
      if (!mountedRef.current || !snapshot) return;
      const isTracking = snapshot.mode === 'background';
      trackingRef.current = isTracking;
      providerRef.current = isTracking ? 'background' : null;
      setState(stateFromSession(snapshot, isTracking));
    });
    const appStateSubscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') void applyStoredSession();
    });
    void applyStoredSession().catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown storage error.';
      console.error('[GPS tracker] Could not restore tracking state', error);
      if (mountedRef.current) {
        setState((current) => ({
          ...current,
          error: `Could not read the saved route: ${message}`,
        }));
      }
    });

    return () => {
      mountedRef.current = false;
      if (providerRef.current === 'foreground-only') {
        trackingRef.current = false;
        stopForegroundWatcher();
      }
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [applyStoredSession, stopForegroundWatcher]);

  return { ...state, start, stop };
}
