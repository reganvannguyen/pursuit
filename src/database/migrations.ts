import type * as SQLite from 'expo-sqlite';

export const DATABASE_VERSION = 3;

type MigrationDatabase = Pick<
  SQLite.SQLiteDatabase,
  'withTransactionAsync' | 'getFirstAsync' | 'execAsync'
>;

export async function migrateDatabase(database: MigrationDatabase): Promise<void> {
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than this app supports (${DATABASE_VERSION}).`,
    );
  }
  if (currentVersion === DATABASE_VERSION) return;

  await database.withTransactionAsync(async () => {
    const currentVersionRow = await database.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    const transactionVersion = currentVersionRow?.user_version ?? 0;

    if (transactionVersion > DATABASE_VERSION) {
      throw new Error(
        `Database version ${transactionVersion} is newer than this app supports (${DATABASE_VERSION}).`,
      );
    }
    if (transactionVersion === DATABASE_VERSION) return;

    if (transactionVersion < 1) {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS storage_probe (
          id TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
    }

    if (transactionVersion < 2) {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS active_tracking_session (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          mode TEXT NOT NULL CHECK (mode IN ('background', 'foreground-only', 'interrupted')),
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

        CREATE TABLE IF NOT EXISTS active_tracking_point (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL,
          timestamp INTEGER NOT NULL,
          segment_index INTEGER NOT NULL
        );
      `);
    }

    if (transactionVersion < 3) {
      await database.execAsync(`
        ALTER TABLE active_tracking_session ADD COLUMN started_at INTEGER;
        ALTER TABLE active_tracking_session ADD COLUMN paused_at INTEGER;
        ALTER TABLE active_tracking_session
          ADD COLUMN moving_time_milliseconds INTEGER NOT NULL DEFAULT 0;
      `);
    }

    await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  });
}
