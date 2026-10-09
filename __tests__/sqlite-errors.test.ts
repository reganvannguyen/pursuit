import { isSQLiteBusyError } from '@/database/sqlite-errors';

describe('SQLite error classification', () => {
  it('recognizes a wrapped Expo database-locked error', () => {
    const error = new Error('Calling finalizeAsync failed', {
      cause: {
        name: 'SQLiteErrorException',
        message: 'Error code 5: database is locked',
      },
    });

    expect(isSQLiteBusyError(error)).toBe(true);
  });

  it('recognizes a native SQLite error code field', () => {
    expect(isSQLiteBusyError({ code: 5, message: 'SQLite operation failed' })).toBe(true);
  });

  it('leaves unrelated errors classified as fatal', () => {
    expect(isSQLiteBusyError(new Error('Location permission denied'))).toBe(false);
  });
});
