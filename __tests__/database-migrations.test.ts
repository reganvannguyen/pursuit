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
  it('migrates v1 to v2 without losing the v1 probe, and is safe to repeat', async () => {
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
    } finally {
      database.close();
    }
  });
});
