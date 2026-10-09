import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import {
  appendTrackingLocations,
  beginTrackingSession,
  clearTrackingSession,
  readTrackingSession,
} from '@/database/storage.native';

let mockSqliteDatabase: ReturnType<typeof createExpoDatabaseAdapter>;

type ExpoTransactionAdapter = {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, ...params: SQLInputValue[]) => Promise<unknown>;
  getFirstAsync: <T>(sql: string, ...params: SQLInputValue[]) => Promise<T | null>;
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => mockSqliteDatabase,
}));

function createExpoDatabaseAdapter(database: DatabaseSync) {
  let busyFailuresRemaining = 0;
  const transaction: ExpoTransactionAdapter = {
    execAsync: async (sql: string) => database.exec(sql),
    runAsync: async (sql: string, ...params: SQLInputValue[]) =>
      database.prepare(sql).run(...params),
    getFirstAsync: async <T>(sql: string, ...params: SQLInputValue[]) =>
      (database.prepare(sql).get(...params) as T | undefined) ?? null,
  };

  return {
    execAsync: transaction.execAsync,
    runAsync: transaction.runAsync,
    getFirstAsync: transaction.getFirstAsync,
    getAllAsync: async <T>(sql: string, ...params: SQLInputValue[]) =>
      database.prepare(sql).all(...params) as T[],
    withTransactionAsync: async (callback: () => Promise<void>) => {
      database.exec('BEGIN');
      try {
        await callback();
        if (busyFailuresRemaining > 0) {
          busyFailuresRemaining -= 1;
          throw new Error('SQLiteErrorException: Error code 5: database is locked');
        }
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    closeAsync: async () => database.close(),
    simulateSQLiteBusyOnNextTransaction: () => {
      busyFailuresRemaining += 1;
    },
  };
}

describe('tracking session storage', () => {
  it('restores batched GPS data after a foreground read and clears it on stop', async () => {
    const database = new DatabaseSync(':memory:');
    mockSqliteDatabase = createExpoDatabaseAdapter(database);

    try {
      await beginTrackingSession('background');
      await appendTrackingLocations([
        { latitude: 49, longitude: -123, accuracy: 8, timestamp: 1_000 },
        { latitude: 49, longitude: -122.9999, accuracy: 7, timestamp: 11_000 },
      ]);
      mockSqliteDatabase.simulateSQLiteBusyOnNextTransaction();
      await Promise.all([
        appendTrackingLocations([
          { latitude: 49, longitude: -122.9998, accuracy: 8, timestamp: 21_000 },
        ]),
        appendTrackingLocations([
          { latitude: 49, longitude: -122.9997, accuracy: 8, timestamp: 31_000 },
        ]),
      ]);

      const returnedToApp = await readTrackingSession();
      expect(returnedToApp).toMatchObject({
        mode: 'background',
        acceptedSamples: 4,
        route: [
          { latitude: 49, longitude: -123, segmentIndex: 0 },
          { latitude: 49, longitude: -122.9999, segmentIndex: 0 },
          { latitude: 49, longitude: -122.9998, segmentIndex: 0 },
          { latitude: 49, longitude: -122.9997, segmentIndex: 0 },
        ],
      });

      await clearTrackingSession();
      expect(await readTrackingSession()).toBeNull();
    } finally {
      database.close();
    }
  });
});
