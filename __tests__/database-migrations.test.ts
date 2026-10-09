import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { DATABASE_VERSION, migrateDatabase } from '@/database/migrations';

function makeMigrationAdapter(database: DatabaseSync) {
  return {
    execAsync: async (sql: string) => database.exec(sql),
    getFirstAsync: async <T>(sql: string, ...params: SQLInputValue[]) =>
      (database.prepare(sql).get(...params) as T | undefined) ?? null,
    async withTransactionAsync(callback: () => Promise<void>) {
      database.exec('BEGIN');
      try {
        await callback();
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

describe('database migrations', () => {
  it('migrates v1 to v3 without losing the probe and is safe to repeat', async () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec(`
        CREATE TABLE storage_probe (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        INSERT INTO storage_probe (id, value) VALUES ('restart-check', 'saved on v1');
        PRAGMA user_version = 1;
      `);
      const adapter = makeMigrationAdapter(database);

      await migrateDatabase(adapter as unknown as Parameters<typeof migrateDatabase>[0]);
      await migrateDatabase(adapter as unknown as Parameters<typeof migrateDatabase>[0]);

      expect(database.prepare('PRAGMA user_version').get()).toEqual({
        user_version: DATABASE_VERSION,
      });
      expect(database.prepare('SELECT id, value FROM storage_probe').get()).toEqual({
        id: 'restart-check',
        value: 'saved on v1',
      });
      expect(
        database
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'active_tracking_point'",
          )
          .get(),
      ).toEqual({ name: 'active_tracking_point' });
      const sessionColumns = database
        .prepare('PRAGMA table_info(active_tracking_session)')
        .all() as { name: string }[];
      expect(sessionColumns.map(({ name }) => name)).toEqual(
        expect.arrayContaining(['started_at', 'paused_at', 'moving_time_milliseconds']),
      );
    } finally {
      database.close();
    }
  });

  it('adds timing fields to a v2 active session without changing its route or totals', async () => {
    const database = new DatabaseSync(':memory:');
    try {
      database.exec(`
        CREATE TABLE active_tracking_session (
          id INTEGER PRIMARY KEY NOT NULL,
          mode TEXT NOT NULL,
          distance_meters REAL NOT NULL DEFAULT 0,
          accuracy_meters REAL,
          accepted_samples INTEGER NOT NULL DEFAULT 0,
          rejected_samples INTEGER NOT NULL DEFAULT 0,
          last_accepted_latitude REAL,
          last_accepted_longitude REAL,
          last_accepted_accuracy REAL,
          last_accepted_timestamp INTEGER,
          last_location_at INTEGER,
          segment_index INTEGER NOT NULL DEFAULT 0,
          warning TEXT
        );
        CREATE TABLE active_tracking_point (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL,
          timestamp INTEGER NOT NULL,
          segment_index INTEGER NOT NULL
        );
        INSERT INTO active_tracking_session (id, mode, distance_meters, accepted_samples)
          VALUES (1, 'background', 123.4, 7);
        INSERT INTO active_tracking_point (latitude, longitude, accuracy, timestamp, segment_index)
          VALUES (49, -123, 8, 1000, 0);
        PRAGMA user_version = 2;
      `);
      const adapter = makeMigrationAdapter(database);

      await migrateDatabase(adapter as unknown as Parameters<typeof migrateDatabase>[0]);

      expect(database.prepare('PRAGMA user_version').get()).toEqual({
        user_version: DATABASE_VERSION,
      });
      expect(
        database
          .prepare(
            'SELECT mode, distance_meters, accepted_samples, moving_time_milliseconds FROM active_tracking_session WHERE id = 1',
          )
          .get(),
      ).toEqual({
        mode: 'background',
        distance_meters: 123.4,
        accepted_samples: 7,
        moving_time_milliseconds: 0,
      });
      expect(
        database.prepare('SELECT latitude, longitude FROM active_tracking_point').get(),
      ).toEqual({
        latitude: 49,
        longitude: -123,
      });
    } finally {
      database.close();
    }
  });
});
