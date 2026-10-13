import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import * as Location from 'expo-location';

import {
  appendTrackingLocations,
  beginTrackingSession,
  clearTrackingSession,
  markTrackingSessionInterrupted,
  pauseStoredTrackingSession,
  readTrackingSession,
  resumeStoredTrackingSession,
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
  type ActiveTrackingMode,
  type TrackingMode,
  type TrackingSessionSnapshot,
  type TrackedRoutePoint,
} from './tracking-session';
import {
  averagePaceSecondsPerKilometer,
  elapsedTimeMilliseconds,
  livePaceSecondsPerKilometer,
} from './session-metrics';

type TrackerState = {
  distanceMeters: number;
  movingTimeMilliseconds: number;
  startedAt: number | null;
  pausedAt: number | null;
  stoppedAt: number | null;
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
  movingTimeMilliseconds: 0,
  startedAt: null,
  pausedAt: null,
  stoppedAt: null,
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
    movingTimeMilliseconds: session.movingTimeMilliseconds,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    stoppedAt: null,
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
  const [clockNow, setClockNow] = useState(() => Date.now());
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const startingRef = useRef(false);
  const trackingRef = useRef(false);
  const pausedRef = useRef(false);
  const providerRef = useRef<'background' | 'foreground-only' | null>(null);
  const mountedRef = useRef(true);

  const stopForegroundWatcher = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  const applyStoredSession = useCallback(async () => {
    if (startingRef.current) return;
    const stored = await readTrackingSession();
    if (!stored) return;
    setClockNow(Date.now());

    let session = stored;
    if (session.pausedAt !== null) {
      clearPendingLocationBatch();
      stopForegroundWatcher();
      await stopBackgroundLocationTask().catch(() => undefined);
      providerRef.current = null;
      trackingRef.current = false;
      pausedRef.current = true;
    } else if (session.mode === 'background') {
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
      pausedRef.current = false;
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
        pausedRef.current = false;
      } else {
        session = reconcileTrackingSession(session, false, Date.now());
        if (session.warning !== stored.warning && session.warning) {
          await setTrackingSessionWarning(session.warning);
        }
        providerRef.current = 'foreground-only';
        trackingRef.current = true;
        pausedRef.current = false;
      }
    } else {
      providerRef.current = null;
      trackingRef.current = false;
      pausedRef.current = false;
    }

    if (!mountedRef.current) return;
    setState(stateFromSession(session, trackingRef.current));
  }, [stopForegroundWatcher]);

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
      pausedRef.current = false;
      providerRef.current = null;
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

  const startForegroundWatcher = useCallback(async () => {
    const subscription = await Location.watchPositionAsync(
      LOCATION_OPTIONS,
      (location) => void handleLocation(sampleFromLocation(location)),
      (reason) => {
        console.error('[GPS tracker] Foreground location update failed', reason);
        trackingRef.current = false;
        pausedRef.current = false;
        providerRef.current = null;
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

  const startLocationProvider = useCallback(
    async (requestedMode: ActiveTrackingMode): Promise<ActiveTrackingMode> => {
      let mode = requestedMode;
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
          mode = 'foreground-only';
        }
      }

      if (mode === 'foreground-only') await startForegroundWatcher();
      providerRef.current = mode;
      return mode;
    },
    [startForegroundWatcher],
  );

  const start = useCallback(async () => {
    if (startingRef.current || trackingRef.current || pausedRef.current) return;

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
      await beginTrackingSession(mode, Date.now());
      if (initialWarning) await setTrackingSessionWarning(initialWarning);
      pausedRef.current = false;
      await startLocationProvider(mode);

      const session = await readTrackingSession();
      if (mountedRef.current && session) {
        setClockNow(Date.now());
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
  }, [startLocationProvider, stopForegroundWatcher]);

  const pause = useCallback(async () => {
    if (startingRef.current || !trackingRef.current) return;

    startingRef.current = true;
    if (mountedRef.current) {
      setState((current) => ({ ...current, isStarting: true, error: null }));
    }

    const pausedAt = Date.now();
    try {
      await pauseStoredTrackingSession(pausedAt);
      trackingRef.current = false;
      pausedRef.current = true;
      providerRef.current = null;
      stopForegroundWatcher();
      clearPendingLocationBatch();

      let stopError: string | null = null;
      try {
        await stopBackgroundLocationTask();
      } catch (error) {
        stopError = error instanceof Error ? error.message : 'Unknown location error.';
      }

      const session = await readTrackingSession();
      pausedRef.current = session !== null && session.pausedAt !== null;
      if (mountedRef.current && session) {
        setState(
          stateFromSession(session, false, {
            isStarting: false,
            warning: stopError
              ? `Paused, but the location service did not stop cleanly: ${stopError}`
              : session.warning,
            error: null,
          }),
        );
      } else if (mountedRef.current) {
        setState((current) => ({
          ...current,
          isStarting: false,
          isTracking: false,
          error: 'The tracking session ended before it could be paused.',
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error.';
      if (mountedRef.current) {
        setState((current) => ({
          ...current,
          isStarting: false,
          error: `Could not pause tracking: ${message}`,
        }));
      }
    } finally {
      startingRef.current = false;
    }
  }, [stopForegroundWatcher]);

  const resume = useCallback(async () => {
    if (startingRef.current || !pausedRef.current) return;

    startingRef.current = true;
    if (mountedRef.current) {
      setState((current) => ({ ...current, isStarting: true, error: null }));
    }

    try {
      const session = await readTrackingSession();
      if (!session || session.pausedAt === null || session.mode === 'interrupted') {
        throw new Error('The paused session is unavailable. Start a new session instead.');
      }

      const foregroundPermission = await Location.getForegroundPermissionsAsync();
      if (foregroundPermission.status !== 'granted') {
        throw new Error('Location access is off. Enable it for Pursuit in Settings, then resume.');
      }

      let mode: ActiveTrackingMode =
        session.mode === 'background' ? 'background' : 'foreground-only';
      let permissionWarning: string | null = null;
      if (mode === 'background') {
        const backgroundPermission = await Location.getBackgroundPermissionsAsync();
        if (backgroundPermission.status !== 'granted') {
          mode = 'foreground-only';
          permissionWarning =
            'Background location is no longer enabled. This session resumed in foreground-only mode.';
        }
      }

      clearPendingLocationBatch();
      await resumeStoredTrackingSession(mode);
      if (permissionWarning) await setTrackingSessionWarning(permissionWarning);
      pausedRef.current = false;
      await startLocationProvider(mode);

      const resumedSession = await readTrackingSession();
      if (mountedRef.current && resumedSession) {
        setClockNow(Date.now());
        setState(
          stateFromSession(resumedSession, trackingRef.current, {
            isStarting: false,
            isTracking: trackingRef.current,
          }),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown location error.';
      if (!pausedRef.current) {
        trackingRef.current = false;
        providerRef.current = null;
        stopForegroundWatcher();
        clearPendingLocationBatch();
        await stopBackgroundLocationTask().catch(() => undefined);
        await pauseStoredTrackingSession(Date.now()).catch(() => undefined);
        pausedRef.current = true;
      }
      const pausedSession = await readTrackingSession().catch(() => null);
      if (mountedRef.current) {
        setState(
          pausedSession
            ? stateFromSession(pausedSession, false, {
                isStarting: false,
                error: `Could not resume tracking: ${message}`,
              })
            : {
                ...state,
                isStarting: false,
                isTracking: false,
                error: `Could not resume tracking: ${message}`,
              },
        );
      }
    } finally {
      startingRef.current = false;
    }
  }, [startLocationProvider, state, stopForegroundWatcher]);

  const stop = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    if (mountedRef.current) {
      setState((current) => ({ ...current, isStarting: true, error: null }));
    }

    trackingRef.current = false;
    pausedRef.current = false;
    providerRef.current = null;
    stopForegroundWatcher();

    const stoppedAt = Date.now();
    setClockNow(stoppedAt);

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
              pausedAt: null,
              stoppedAt,
              isStarting: false,
              warning: stopError
                ? `Stopped, but session cleanup failed: ${stopError}`
                : finalSession.warning,
              error: stopError ? `Could not fully stop GPS tracking: ${stopError}` : null,
            })
          : {
              ...state,
              mode: 'idle',
              pausedAt: null,
              stoppedAt,
              isStarting: false,
              isTracking: false,
              warning: stopError
                ? `Stopped, but session cleanup failed: ${stopError}`
                : state.warning,
              error: stopError ? `Could not stop GPS tracking: ${stopError}` : null,
            },
      );
    }
    startingRef.current = false;
  }, [state, stopForegroundWatcher]);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeToBackgroundLocationUpdates((snapshot) => {
      if (!mountedRef.current || !snapshot) return;
      const isPaused = snapshot.pausedAt !== null;
      const isTracking = snapshot.mode === 'background' && !isPaused;
      trackingRef.current = isTracking;
      pausedRef.current = isPaused;
      providerRef.current = isTracking ? 'background' : null;
      setState(stateFromSession(snapshot, isTracking));
    });
    const appStateSubscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        setClockNow(Date.now());
        void applyStoredSession();
      }
    });
    const initialRestore = setTimeout(() => {
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
    }, 0);

    return () => {
      mountedRef.current = false;
      if (providerRef.current === 'foreground-only') {
        trackingRef.current = false;
        stopForegroundWatcher();
      }
      unsubscribe();
      appStateSubscription.remove();
      clearTimeout(initialRestore);
    };
  }, [applyStoredSession, stopForegroundWatcher]);

  useEffect(() => {
    if (state.startedAt === null || state.stoppedAt !== null) return;

    const timer = setInterval(() => setClockNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [state.startedAt, state.stoppedAt]);

  const elapsedMilliseconds = elapsedTimeMilliseconds(state.startedAt, clockNow, state.stoppedAt);
  const averagePace = averagePaceSecondsPerKilometer(
    state.distanceMeters,
    state.movingTimeMilliseconds,
  );
  const livePace = livePaceSecondsPerKilometer(state.route, clockNow);

  return {
    ...state,
    isPaused: state.pausedAt !== null && state.stoppedAt === null,
    elapsedTimeMilliseconds: elapsedMilliseconds,
    averagePaceSecondsPerKilometer: averagePace,
    livePaceSecondsPerKilometer: livePace,
    start,
    pause,
    resume,
    stop,
  };
}
