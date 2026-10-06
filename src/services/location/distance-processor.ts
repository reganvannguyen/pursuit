export type LocationSample = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type RoutePoint = Pick<LocationSample, 'latitude' | 'longitude'>;

export type SampleRejectionReason =
  | 'invalid_sample'
  | 'out_of_order_timestamp'
  | 'impossible_speed';

export type SampleResult =
  | {
      accepted: true;
      addedDistanceMeters: number;
      totalDistanceMeters: number;
    }
  | {
      accepted: false;
      rejectionReason: SampleRejectionReason;
      totalDistanceMeters: number;
      segmentDistanceMeters?: number;
      speedMetersPerSecond?: number;
    };

// This deliberately generous prototype guard catches obvious GPS jumps. Field data
// should guide any later change to the limit.
export const MAX_PLAUSIBLE_SPEED_METERS_PER_SECOND = 25;

const EARTH_RADIUS_METERS = 6_371_000;

export function distanceBetweenPoints(start: RoutePoint, end: RoutePoint): number {
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const latitudeDelta = endLatitude - startLatitude;
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export class DistanceProcessor {
  private lastAcceptedSample: LocationSample | null = null;
  private totalDistanceMeters = 0;

  process(sample: LocationSample): SampleResult {
    if (!isValidSample(sample)) {
      return {
        accepted: false,
        rejectionReason: 'invalid_sample',
        totalDistanceMeters: this.totalDistanceMeters,
      };
    }

    const previous = this.lastAcceptedSample;
    if (previous && sample.timestamp <= previous.timestamp) {
      return {
        accepted: false,
        rejectionReason: 'out_of_order_timestamp',
        totalDistanceMeters: this.totalDistanceMeters,
      };
    }

    const addedDistanceMeters = previous ? distanceBetweenPoints(previous, sample) : 0;
    if (previous) {
      const elapsedSeconds = (sample.timestamp - previous.timestamp) / 1000;
      const speedMetersPerSecond = addedDistanceMeters / elapsedSeconds;

      if (
        !Number.isFinite(speedMetersPerSecond) ||
        speedMetersPerSecond > MAX_PLAUSIBLE_SPEED_METERS_PER_SECOND
      ) {
        return {
          accepted: false,
          rejectionReason: 'impossible_speed',
          totalDistanceMeters: this.totalDistanceMeters,
          segmentDistanceMeters: addedDistanceMeters,
          speedMetersPerSecond,
        };
      }
    }

    this.lastAcceptedSample = sample;
    this.totalDistanceMeters += addedDistanceMeters;

    return {
      accepted: true,
      addedDistanceMeters,
      totalDistanceMeters: this.totalDistanceMeters,
    };
  }
}

function isValidSample(sample: LocationSample): boolean {
  return (
    Number.isFinite(sample.latitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    Number.isFinite(sample.longitude) &&
    sample.longitude >= -180 &&
    sample.longitude <= 180 &&
    Number.isFinite(sample.timestamp) &&
    sample.timestamp >= 0
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
