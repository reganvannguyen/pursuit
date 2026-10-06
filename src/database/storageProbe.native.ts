import * as SQLite from 'expo-sqlite';

import type { ProbeRecord } from './storageProbe';

const DATABASE_NAME = 'pursuit.db';
const DATABASE_VERSION = 1;
const PROBE_RECORD_ID = 'restart-check';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrateDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than this app supports (${DATABASE_VERSION}).`,
    );
  }

  if (currentVersion === 0) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS storage_probe (
        id TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  }
}

function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

      try {
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

export async function initializeDatabase(): Promise<void> {
  await openDatabase();
}

export async function saveProbeRecord(value: string): Promise<void> {
  const database = await openDatabase();
  await database.runAsync(
    'INSERT OR REPLACE INTO storage_probe (id, value) VALUES (?, ?)',
    PROBE_RECORD_ID,
    value,
  );
}

export async function readProbeRecord(): Promise<ProbeRecord | null> {
  const database = await openDatabase();
  return database.getFirstAsync<ProbeRecord>(
    'SELECT id, value FROM storage_probe WHERE id = ?',
    PROBE_RECORD_ID,
  );
}
