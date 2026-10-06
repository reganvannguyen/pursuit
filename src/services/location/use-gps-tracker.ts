import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import {
  DistanceProcessor,
  type RoutePoint,
  type SampleRejectionReason,
} from './distance-processor';

type TrackerState = {
  distanceMeters: number;
  accuracyMeters: number | null;
  lastAcceptedAccuracyMeters: number | null;
  acceptedSamples: number;
  rejectedSamples: number;
  route: RoutePoint[];
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

export function useGpsTracker() {
  const [state, setState] = useState(INITIAL_STATE);
  const processorRef = useRef<DistanceProcessor | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const startingRef = useRef(false);
  const trackingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      trackingRef.current = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    trackingRef.current = false;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setState((current) => ({ ...current, isStarting: false, isTracking: false }));
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || trackingRef.current) return;

    startingRef.current = true;
    setState({ ...INITIAL_STATE, isStarting: true });

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mountedRef.current) return;

      if (permission.status !== 'granted') {
        const message = permission.canAskAgain
          ? 'Location permission was not granted. Allow access to track a route.'
          : 'Location access is off. Enable it for Pursuit in Settings, then try again.';
        setState({ ...INITIAL_STATE, error: message });
        return;
      }

      const processor = new DistanceProcessor();
      processorRef.current = processor;
      trackingRef.current = true;
      setState({ ...INITIAL_STATE, isStarting: true });

      const subscription = await Location.watchPositionAsync(
        LOCATION_OPTIONS,
        (location) => {
          if (!mountedRef.current || !trackingRef.current) return;

          const sample = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          };
          const accuracyMeters =
            typeof sample.accuracy === 'number' &&
            Number.isFinite(sample.accuracy) &&
            sample.accuracy >= 0
              ? sample.accuracy
              : null;
          const result = processor.process(sample);

          if (!result.accepted) {
            console.warn('[GPS tracker] Rejected sample', {
              reason: formatRejectionReason(result.rejectionReason),
              segmentDistanceMeters: result.segmentDistanceMeters,
              speedMetersPerSecond: result.speedMetersPerSecond,
              accuracyMeters,
            });
            setState((current) => ({
              ...current,
              accuracyMeters,
              rejectedSamples: current.rejectedSamples + 1,
            }));
            return;
          }

          setState((current) => ({
            ...current,
            distanceMeters: result.totalDistanceMeters,
            accuracyMeters,
            lastAcceptedAccuracyMeters: accuracyMeters,
            acceptedSamples: current.acceptedSamples + 1,
            route: [
              ...current.route,
              {
                latitude: sample.latitude,
                longitude: sample.longitude,
              },
            ],
          }));
        },
        (reason) => {
          console.error('[GPS tracker] Location update failed', reason);
          if (!mountedRef.current) return;
          trackingRef.current = false;
          subscriptionRef.current?.remove();
          subscriptionRef.current = null;
          setState((current) => ({
            ...current,
            isStarting: false,
            isTracking: false,
            error: `Location updates stopped: ${reason}`,
          }));
        },
      );

      if (!mountedRef.current || !trackingRef.current) {
        subscription.remove();
        return;
      }

      subscriptionRef.current = subscription;
      setState((current) => ({ ...current, isStarting: false, isTracking: true }));
    } catch (error) {
      trackingRef.current = false;
      const message = error instanceof Error ? error.message : 'Unknown location error.';
      console.error('[GPS tracker] Could not start location updates', error);
      if (mountedRef.current) {
        setState((current) => ({
          ...current,
          isStarting: false,
          isTracking: false,
          error: `Could not start GPS tracking: ${message}`,
        }));
      }
    } finally {
      startingRef.current = false;
    }
  }, []);

  return { ...state, start, stop };
}
