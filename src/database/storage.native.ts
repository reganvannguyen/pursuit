import * as SQLite from 'expo-sqlite';

import { migrateDatabase } from './migrations';
import { isSQLiteBusyError } from './sqlite-errors';
import type { ProbeRecord } from './storage';
import {
  createTrackingSession,
  pauseTrackingSession as pauseSession,
  processLocationBatch,
  resumeTrackingSession as resumeSession,
  type ActiveTrackingMode,
  type ProcessedLocationBatch,
  type TrackingSessionCore,
  type TrackingSessionSnapshot,
  type TrackedRoutePoint,
} from '@/services/location/tracking-session';
import type { LocationSample } from '@/services/location/distance-processor';

const DATABASE_NAME = 'pursuit.db';
const PROBE_RECORD_ID = 'restart-check';
const SQLITE_BUSY_RETRIES = 3;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let databaseOperationQueue = Promise.resolve();

type TrackingSessionRow = {
  mode: TrackingSessionCore['mode'];
  distance_meters: number;
  moving_time_milliseconds: number;
  started_at: number | null;
  paused_at: number | null;
  accuracy_meters: number | null;
  accepted_samples: number;
  rejected_samples: number;
  last_accepted_latitude: number | null;
  last_accepted_longitude: number | null;
  last_accepted_accuracy: number | null;
  last_accepted_timestamp: number | null;
  last_location_at: number | null;
  segment_index: number;
  warning: string | null;
};

type TrackingPointRow = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  segment_index: number;
};

function rowToSessionCore(row: TrackingSessionRow): TrackingSessionCore {
  const lastAcceptedSample =
    row.last_accepted_latitude === null ||
    row.last_accepted_longitude === null ||
    row.last_accepted_timestamp === null
      ? null
      : {
          latitude: row.last_accepted_latitude,
          longitude: row.last_accepted_longitude,
          accuracy: row.last_accepted_accuracy,
          timestamp: row.last_accepted_timestamp,
        };

  return {
    mode: row.mode,
    distanceMeters: row.distance_meters,
    movingTimeMilliseconds: row.moving_time_milliseconds,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    accuracyMeters: row.accuracy_meters,
    acceptedSamples: row.accepted_samples,
    rejectedSamples: row.rejected_samples,
    lastAcceptedSample,
    lastLocationAt: row.last_location_at,
    segmentIndex: row.segment_index,
    warning: row.warning,
  };
}

function rowToRoutePoint(row: TrackingPointRow): TrackedRoutePoint {
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    timestamp: row.timestamp,
    segmentIndex: row.segment_index,
  };
}

function enqueueDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = databaseOperationQueue.then(() => retrySQLiteBusy(operation));
  databaseOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function retrySQLiteBusy<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSQLiteBusyError(error) || attempt >= SQLITE_BUSY_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

      try {
        await database.execAsync('PRAGMA busy_timeout = 1500;');
        await database.execAsync('PRAGMA journal_mode = WAL;');
        await migrateDatabase(database);
        return database;
      } catch (error) {
        await database.closeAsync().catch(() => undefined);
        throw error;
      }
    })().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export function initializeDatabase(): Promise<void> {
  return enqueueDatabaseOperation(async () => {
    await openDatabase();
  });
}

export function saveProbeRecord(value: string): Promise<void> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    await database.runAsync(
      'INSERT OR REPLACE INTO storage_probe (id, value) VALUES (?, ?)',
      PROBE_RECORD_ID,
      value,
    );
  });
}

export function readProbeRecord(): Promise<ProbeRecord | null> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    return database.getFirstAsync<ProbeRecord>(
      'SELECT id, value FROM storage_probe WHERE id = ?',
      PROBE_RECORD_ID,
    );
  });
}

export function beginTrackingSession(
  mode: ActiveTrackingMode,
  startedAt = Date.now(),
): Promise<void> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    const session = createTrackingSession(mode, startedAt);

    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM active_tracking_point');
      await database.runAsync('DELETE FROM active_tracking_session');
      await database.runAsync(
        `INSERT INTO active_tracking_session (
          id, mode, distance_meters, accuracy_meters, accepted_samples, rejected_samples,
          last_accepted_latitude, last_accepted_longitude, last_accepted_accuracy,
          last_accepted_timestamp, last_location_at, segment_index, warning, started_at,
          paused_at, moving_time_milliseconds
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session.mode,
        session.distanceMeters,
        session.accuracyMeters,
        session.acceptedSamples,
        session.rejectedSamples,
        null,
        null,
        null,
        null,
        null,
        session.segmentIndex,
        session.warning,
        session.startedAt,
        session.pausedAt,
        session.movingTimeMilliseconds,
      );
    });
  });
}

export function pauseStoredTrackingSession(pausedAt: number): Promise<void> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    const row = await database.getFirstAsync<TrackingSessionRow>(
      'SELECT * FROM active_tracking_session WHERE id = 1',
    );
    if (!row || row.mode === 'interrupted' || row.paused_at !== null) return;

    const pausedSession = pauseSession(rowToSessionCore(row), pausedAt);
    await database.runAsync(
      'UPDATE active_tracking_session SET paused_at = ? WHERE id = 1',
      pausedSession.pausedAt,
    );
  });
}

export function resumeStoredTrackingSession(mode: ActiveTrackingMode): Promise<void> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    const row = await database.getFirstAsync<TrackingSessionRow>(
      'SELECT * FROM active_tracking_session WHERE id = 1',
    );
    if (!row || row.paused_at === null || row.mode === 'interrupted') return;

    const resumedSession = resumeSession(rowToSessionCore(row), mode);
    await database.runAsync(
      `UPDATE active_tracking_session SET
        mode = ?, paused_at = NULL, last_accepted_latitude = ?, last_accepted_longitude = ?,
        last_accepted_accuracy = ?, last_accepted_timestamp = ?, last_location_at = NULL,
        segment_index = ?, warning = ?
      WHERE id = 1`,
      resumedSession.mode,
      resumedSession.lastAcceptedSample?.latitude ?? null,
      resumedSession.lastAcceptedSample?.longitude ?? null,
      resumedSession.lastAcceptedSample?.accuracy ?? null,
      resumedSession.lastAcceptedSample?.timestamp ?? null,
      resumedSession.segmentIndex,
      resumedSession.warning,
    );
  });
}

export function setTrackingSessionMode(mode: ActiveTrackingMode): Promise<void> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    await database.runAsync('UPDATE active_tracking_session SET mode = ? WHERE id = 1', mode);
  });
}

export function setTrackingSessionWarning(warning: string): Promise<void> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    await database.runAsync('UPDATE active_tracking_session SET warning = ? WHERE id = 1', warning);
  });
}

export function markTrackingSessionInterrupted(warning: string): Promise<void> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    await database.runAsync(
      'UPDATE active_tracking_session SET mode = ?, warning = ? WHERE id = 1',
      'interrupted',
      warning,
    );
  });
}

export function appendTrackingLocations(
  samples: LocationSample[],
): Promise<ProcessedLocationBatch | null> {
  if (samples.length === 0) return Promise.resolve(null);

  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    let processedBatch: ProcessedLocationBatch | null = null;

    await database.withTransactionAsync(async () => {
      const row = await database.getFirstAsync<TrackingSessionRow>(
        'SELECT * FROM active_tracking_session WHERE id = 1',
      );
      if (!row || row.mode === 'interrupted' || row.paused_at !== null) return;

      const processed = processLocationBatch(rowToSessionCore(row), samples);
      for (const point of processed.acceptedPoints) {
        await database.runAsync(
          `INSERT INTO active_tracking_point (latitude, longitude, accuracy, timestamp, segment_index)
           VALUES (?, ?, ?, ?, ?)`,
          point.latitude,
          point.longitude,
          point.accuracy,
          point.timestamp,
          point.segmentIndex,
        );
      }

      const lastAcceptedSample = processed.session.lastAcceptedSample;
      await database.runAsync(
        `UPDATE active_tracking_session SET
          mode = ?, distance_meters = ?, accuracy_meters = ?, accepted_samples = ?, rejected_samples = ?,
          last_accepted_latitude = ?, last_accepted_longitude = ?, last_accepted_accuracy = ?,
          last_accepted_timestamp = ?, last_location_at = ?, segment_index = ?, warning = ?,
          moving_time_milliseconds = ?
        WHERE id = 1`,
        processed.session.mode,
        processed.session.distanceMeters,
        processed.session.accuracyMeters,
        processed.session.acceptedSamples,
        processed.session.rejectedSamples,
        lastAcceptedSample?.latitude ?? null,
        lastAcceptedSample?.longitude ?? null,
        lastAcceptedSample?.accuracy ?? null,
        lastAcceptedSample?.timestamp ?? null,
        processed.session.lastLocationAt,
        processed.session.segmentIndex,
        processed.session.warning,
        processed.session.movingTimeMilliseconds,
      );
      processedBatch = processed;
    });

    return processedBatch;
  });
}

export function readTrackingSession(): Promise<TrackingSessionSnapshot | null> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    const row = await database.getFirstAsync<TrackingSessionRow>(
      'SELECT * FROM active_tracking_session WHERE id = 1',
    );
    if (!row) return null;

    const points = await database.getAllAsync<TrackingPointRow>(
      'SELECT latitude, longitude, accuracy, timestamp, segment_index FROM active_tracking_point ORDER BY sequence ASC',
    );

    const session = rowToSessionCore(row);
    if (session.startedAt === null) {
      session.startedAt = points[0]?.timestamp ?? row.last_location_at ?? Date.now();
      await database.runAsync(
        'UPDATE active_tracking_session SET started_at = ? WHERE id = 1 AND started_at IS NULL',
        session.startedAt,
      );
    }

    return {
      ...session,
      route: points.map(rowToRoutePoint),
    };
  });
}

export function clearTrackingSession(): Promise<void> {
  return enqueueDatabaseOperation(async () => {
    const database = await openDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM active_tracking_point');
      await database.runAsync('DELETE FROM active_tracking_session');
    });
  });
}
